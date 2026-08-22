import { randomBytes, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CorrespondenceMailboxIdentity,
  InterviewCustomerHandoffDetail,
  InterviewCustomerHandoffPreview,
  InterviewCustomerHandoffSummary,
  SendInterviewCustomerHandoffInput,
} from '@project-maker/contracts';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import { RoundQuestionAssessmentOverrideEntity } from '../interviews/round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import {
  CustomerMailBoundaryError,
  type CustomerOutboundMail,
  customerOutboundMailToken,
  immutableOutboundCustomerMessage,
} from '../mail-delivery/customer-mail-boundary';
import {
  customerMailDigest as sha256,
  customerReplyToAddress as plusAddress,
  dedicatedCustomerSender as dedicatedSender,
} from '../mail-delivery/customer-mail-identity';
import { Project } from '../projects/project.entity';
import {
  findCorrespondencesWithCustomerReceiptEvidence,
  hasCustomerReceiptEvidence,
} from '../customer-replies/customer-receipt-evidence';
import { CustomerCorrespondenceEntity } from './customer-correspondence.entity';
import { CustomerOutboundAttemptEntity } from './customer-outbound-attempt.entity';
import { CustomerOutboundCommunicationEntity } from './customer-outbound-communication.entity';
import {
  appendCanonicalOutboundAttempt,
  createCanonicalOutbound,
} from './customer-outbound-persistence';
import { InterviewCustomerHandoffEntity } from './interview-customer-handoff.entity';
import {
  renderHandoff,
  type HandoffProjection,
} from './interview-customer-handoff.renderer';

const sendingLeaseMs = 600_000;

@Injectable()
export class InterviewCustomerHandoffService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(customerOutboundMailToken)
    private readonly mailer: CustomerOutboundMail,
    private readonly config: ConfigService,
  ) {}

  async senderIdentity(
    projectId: string,
    roundId: string,
  ): Promise<CorrespondenceMailboxIdentity> {
    return this.dataSource.transaction(async (manager) => {
      await requireRound(manager, projectId, roundId, false);
      const sender = dedicatedSender(this.config);
      return { name: sender.name, address: sender.address };
    });
  }
  async establishFirstDraft(
    manager: EntityManager,
    projectId: string,
    roundId: string,
  ): Promise<InterviewCustomerHandoffEntity> {
    const repository = manager.getRepository(InterviewCustomerHandoffEntity);
    const existing = await repository.findOne({
      where: { roundId },
      order: { version: 'DESC' },
    });
    return (
      existing ??
      repository.save(newDraft(repository, projectId, roundId, 1, null))
    );
  }
  async requireEditableRound(
    manager: EntityManager,
    round: InterviewRoundEntity,
  ): Promise<void> {
    if (round.status === 'OPEN') return;
    const latest = await manager
      .getRepository(InterviewCustomerHandoffEntity)
      .findOne({ where: { roundId: round.id }, order: { version: 'DESC' } });
    if (!latest || latest.state === 'DRAFT') return;
    throw new ConflictException(
      'Az interjú csak aktív összefoglaló-tervezettel szerkeszthető.',
    );
  }
  async list(
    projectId: string,
    roundId: string,
  ): Promise<readonly InterviewCustomerHandoffSummary[]> {
    return this.dataSource.transaction(async (manager) => {
      await requireRound(manager, projectId, roundId, false);
      await reconcileExpiredSending(manager, projectId, roundId);
      const handoffs = await manager
        .getRepository(InterviewCustomerHandoffEntity)
        .find({ where: { projectId, roundId }, order: { version: 'DESC' } });
      const projections = await loadHandoffMailProjections(manager, handoffs);
      const receiptEvidence =
        await findCorrespondencesWithCustomerReceiptEvidence(
          manager,
          handoffs.flatMap(({ correspondenceId }) =>
            correspondenceId ? [correspondenceId] : [],
          ),
        );
      return Promise.all(
        handoffs.map((handoff) =>
          toSummary(
            manager,
            handoff,
            projections.get(handoff.id),
            handoff.correspondenceId
              ? receiptEvidence.has(handoff.correspondenceId)
              : false,
          ),
        ),
      );
    });
  }
  async get(
    projectId: string,
    roundId: string,
    handoffId: string,
  ): Promise<InterviewCustomerHandoffDetail> {
    return this.dataSource.transaction(async (manager) => {
      await requireRound(manager, projectId, roundId, false);
      return toDetail(
        manager,
        await requireHandoff(manager, projectId, roundId, handoffId, false),
      );
    });
  }

  async startDraft(
    projectId: string,
    roundId: string,
  ): Promise<InterviewCustomerHandoffDetail> {
    return this.dataSource.transaction(async (manager) => {
      const { project, round } = await requireRound(
        manager,
        projectId,
        roundId,
        true,
      );
      requireMutable(project);
      if (round.status !== 'ENDED')
        throw new ConflictException(
          'Új összefoglaló-verzió csak lezárt interjúhoz indítható.',
        );
      await reconcileExpiredSending(manager, projectId, roundId);
      const repository = manager.getRepository(InterviewCustomerHandoffEntity);
      const latest = await repository.findOne({
        where: { roundId },
        order: { version: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!latest)
        return toDetail(
          manager,
          await this.establishFirstDraft(manager, projectId, roundId),
        );
      const canSupersede =
        latest.state === 'SENT' ||
        (latest.state === 'UNKNOWN' &&
          (await hasCustomerReceiptEvidence(manager, latest.correspondenceId)));
      if (!canSupersede)
        throw new ConflictException('Már van aktív összefoglaló-verzió.');
      const draft = await repository.save(
        newDraft(repository, projectId, roundId, latest.version + 1, latest.id),
      );
      await audit(
        manager,
        projectId,
        'INTERVIEW_HANDOFF_REVISION_STARTED',
        draft,
      );
      return toDetail(manager, draft);
    });
  }
  async updateDraft(
    projectId: string,
    roundId: string,
    handoffId: string,
    value: string | null,
  ): Promise<InterviewCustomerHandoffDetail> {
    return this.dataSource.transaction(async (manager) => {
      const { project } = await requireRound(manager, projectId, roundId, true);
      requireMutable(project);
      const handoff = await requireHandoff(
        manager,
        projectId,
        roundId,
        handoffId,
        true,
      );
      if (handoff.state !== 'DRAFT')
        throw new ConflictException('Csak aktív tervezet szerkeszthető.');
      handoff.modificationSummary = normalize(value);
      return toDetail(
        manager,
        await manager
          .getRepository(InterviewCustomerHandoffEntity)
          .save(handoff),
      );
    });
  }
  async preview(
    projectId: string,
    roundId: string,
    handoffId: string,
  ): Promise<InterviewCustomerHandoffPreview> {
    return this.dataSource.transaction(async (manager) => {
      const { project, round } = await requireRound(
        manager,
        projectId,
        roundId,
        false,
      );
      requireMutable(project);
      const handoff = await requireHandoff(
        manager,
        projectId,
        roundId,
        handoffId,
        false,
      );
      if (handoff.state !== 'DRAFT')
        throw new ConflictException('Csak aktív tervezet tekinthető elő.');
      return buildPreview(
        manager,
        project,
        round,
        handoff,
        dedicatedSender(this.config),
      );
    });
  }

  async send(
    projectId: string,
    roundId: string,
    handoffId: string,
    input: SendInterviewCustomerHandoffInput,
  ): Promise<InterviewCustomerHandoffDetail> {
    const prepared = await this.dataSource.transaction(async (manager) => {
      const { project, round } = await requireRound(
        manager,
        projectId,
        roundId,
        true,
      );
      requireMutable(project);
      const handoff = await requireHandoff(
        manager,
        projectId,
        roundId,
        handoffId,
        true,
      );
      if (handoff.state !== 'DRAFT' || handoff.outboundCommunicationId)
        throw new ConflictException(
          'Az összefoglaló nem küldhető ebből az állapotból.',
        );
      const preview = await buildPreview(
        manager,
        project,
        round,
        handoff,
        dedicatedSender(this.config),
      );
      if (
        preview.sourceContentVersion !== input.sourceContentVersion ||
        preview.previewDigest !== input.previewDigest
      )
        throw new ConflictException({
          code: 'PREVIEW_STALE',
          message: 'Az interjú az előnézet óta megváltozott.',
        });
      const token = randomBytes(24).toString('hex');
      const predecessor = handoff.supersedesHandoffId
        ? await manager
            .getRepository(InterviewCustomerHandoffEntity)
            .findOneBy({ id: handoff.supersedesHandoffId })
        : null;
      const { outbound, correspondence } = await createCanonicalOutbound(
        manager,
        {
          projectId,
          sourceType: 'INTERVIEW_HANDOFF',
          sourceId: handoff.id,
          senderName: preview.senderName,
          senderAddress: preview.senderAddress,
          recipientName: preview.recipientName,
          recipientAddress: preview.recipientEmail,
          subject: preview.subject,
          htmlContent: preview.htmlContent,
          textContent: preview.textContent,
          sourceContentVersion: preview.sourceContentVersion,
          previewDigest: preview.previewDigest,
          replyToAddress: plusAddress(
            dedicatedSender(this.config).address,
            token,
          ),
          replyTokenHash: sha256(token),
          predecessorId: predecessor?.correspondenceId ?? null,
        },
      );
      handoff.state = 'SENDING';
      handoff.internalOwnerName = project.internalOwnerName;
      handoff.correspondenceId = correspondence.id;
      handoff.outboundCommunicationId = outbound.id;
      await manager.getRepository(InterviewCustomerHandoffEntity).save(handoff);
      return { handoff, outbound };
    });
    return this.deliver(prepared.handoff, prepared.outbound);
  }
  async retry(
    projectId: string,
    roundId: string,
    handoffId: string,
    acknowledged: boolean,
  ): Promise<InterviewCustomerHandoffDetail> {
    const prepared = await this.dataSource.transaction(async (manager) => {
      const { project } = await requireRound(manager, projectId, roundId, true);
      requireMutable(project);
      const handoff = await requireHandoff(
        manager,
        projectId,
        roundId,
        handoffId,
        true,
      );
      if (await hasCustomerReceiptEvidence(manager, handoff.correspondenceId))
        throw new ConflictException(
          'A Customer válasza igazolja az átvételt; ezt a logikai verziót nem szabad újraküldeni.',
        );
      if (handoff.state === 'UNKNOWN' && !acknowledged)
        throw new BadRequestException(
          'A kettős küldés kockázatát el kell fogadni.',
        );
      if (
        !['FAILED', 'UNKNOWN'].includes(handoff.state) ||
        !handoff.outboundCommunicationId
      )
        throw new ConflictException('Ez a küldés nem próbálható újra.');
      const outbound = await requireOutbound(
        manager,
        handoff.outboundCommunicationId,
      );
      handoff.state = 'SENDING';
      await manager.getRepository(InterviewCustomerHandoffEntity).save(handoff);
      return { handoff, outbound };
    });
    return this.deliver(prepared.handoff, prepared.outbound);
  }
  async resumeEditing(
    projectId: string,
    roundId: string,
    handoffId: string,
  ): Promise<InterviewCustomerHandoffDetail> {
    return this.dataSource.transaction(async (manager) => {
      const { project } = await requireRound(manager, projectId, roundId, true);
      requireMutable(project);
      const handoff = await requireHandoff(
        manager,
        projectId,
        roundId,
        handoffId,
        true,
      );
      if (handoff.state !== 'FAILED')
        throw new ConflictException(
          'Csak ismert hibával meghiúsult küldés nyitható újra.',
        );
      if (handoff.correspondenceId)
        throw new ConflictException(
          'A már átadott logikai verzió változatlan tartalommal próbálható újra.',
        );
      handoff.state = 'DRAFT';
      return toDetail(
        manager,
        await manager
          .getRepository(InterviewCustomerHandoffEntity)
          .save(handoff),
      );
    });
  }
  private async deliver(
    prepared: InterviewCustomerHandoffEntity,
    outbound: CustomerOutboundCommunicationEntity,
  ): Promise<InterviewCustomerHandoffDetail> {
    let state: 'SENT' | 'FAILED' | 'UNKNOWN' = 'SENT';
    let messageReference: string | null = null;
    try {
      const result = await this.mailer.submit(
        immutableOutboundCustomerMessage({
          senderAddress: outbound.senderAddress,
          senderName: outbound.senderName,
          recipientAddress: outbound.recipientAddress,
          replyToAddress: outbound.replyToAddress,
          subject: outbound.subject,
          textContent: outbound.textContent,
          htmlContent: outbound.htmlContent,
        }),
      );
      messageReference = result.messageReference;
      if (result.acceptance === 'REJECTED') state = 'FAILED';
    } catch (error) {
      state =
        error instanceof CustomerMailBoundaryError &&
        error.code !== 'OUTCOME_UNKNOWN'
          ? 'FAILED'
          : 'UNKNOWN';
    }
    return this.dataSource.transaction(async (manager) => {
      const handoff = await requireHandoff(
        manager,
        prepared.projectId,
        prepared.roundId,
        prepared.id,
        true,
      );
      if (
        handoff.state !== 'SENDING' ||
        handoff.outboundCommunicationId !== outbound.id
      )
        throw new ConflictException('A küldési állapot megváltozott.');
      handoff.state = state;
      const saved = await manager
        .getRepository(InterviewCustomerHandoffEntity)
        .save(handoff);
      await appendCanonicalOutboundAttempt(
        manager,
        outbound.id,
        state === 'SENT'
          ? 'ACCEPTED'
          : state === 'FAILED'
            ? 'REJECTED'
            : 'UNKNOWN',
        state === 'FAILED'
          ? 'MAIL_SUBMISSION_FAILED'
          : state === 'UNKNOWN'
            ? 'SUBMISSION_RESULT_UNKNOWN'
            : null,
        messageReference,
      );
      await audit(
        manager,
        prepared.projectId,
        state === 'SENT'
          ? 'INTERVIEW_HANDOFF_SENT'
          : state === 'FAILED'
            ? 'INTERVIEW_HANDOFF_FAILED'
            : 'INTERVIEW_HANDOFF_UNKNOWN',
        saved,
      );
      return toDetail(manager, saved);
    });
  }
}

async function buildPreview(
  manager: EntityManager,
  project: Project,
  round: InterviewRoundEntity,
  handoff: InterviewCustomerHandoffEntity,
  sender: { name: string; address: string },
): Promise<InterviewCustomerHandoffPreview> {
  if (!project.internalOwnerName)
    throw new ConflictException(
      'A küldéshez meg kell adni a belső projektgazda nevét.',
    );
  if (handoff.version > 1 && !normalize(handoff.modificationSummary))
    throw new BadRequestException('A módosítás összefoglalása kötelező.');
  const rendered = renderHandoff(
    await loadProjection(manager, project, round, handoff),
  );
  const previewDigest = sha256(
    [
      rendered.previewDigest,
      sender.name,
      sender.address.toLowerCase(),
      project.customerContactName,
      project.customerContactEmail.toLowerCase(),
    ].join('\n'),
  );
  return {
    handoffId: handoff.id,
    version: handoff.version,
    recipientName: project.customerContactName,
    recipientEmail: project.customerContactEmail,
    senderName: sender.name,
    senderAddress: sender.address,
    ...rendered,
    previewDigest,
    sourceContentVersion: round.contentVersion,
  };
}
async function loadProjection(
  manager: EntityManager,
  project: Project,
  round: InterviewRoundEntity,
  handoff: InterviewCustomerHandoffEntity,
): Promise<HandoffProjection> {
  const snapshots = await manager
    .getRepository(RoundQuestionSnapshotEntity)
    .find({ where: { roundId: round.id }, order: { order: 'ASC' } });
  const ids = snapshots.map(({ id }) => id);
  const answers = ids.length
    ? await manager
        .getRepository(RoundAnswerEntity)
        .find({ where: { roundId: round.id, snapshotId: In(ids) } })
    : [];
  const overrides = ids.length
    ? await manager
        .getRepository(RoundQuestionAssessmentOverrideEntity)
        .find({ where: { roundId: round.id, snapshotId: In(ids) } })
    : [];
  const answersById = new Map(
    answers.map((answer) => [answer.snapshotId, answer.value]),
  );
  const overridesById = new Map(
    overrides.map((override) => [override.snapshotId, override]),
  );
  const superseded = handoff.supersedesHandoffId
    ? await manager
        .getRepository(InterviewCustomerHandoffEntity)
        .findOneBy({ id: handoff.supersedesHandoffId })
    : null;
  return {
    projectName: project.name,
    recipientName: project.customerContactName,
    recipientEmail: project.customerContactEmail,
    internalOwnerName: project.internalOwnerName!,
    roundDate: round.createdAt.toISOString(),
    version: handoff.version,
    supersededVersion: superseded?.version ?? null,
    modificationSummary: handoff.modificationSummary,
    sourceContentVersion: round.contentVersion,
    questions: snapshots.map((snapshot) => {
      const answer = answersById.get(snapshot.id) ?? null;
      const override = overridesById.get(snapshot.id);
      return {
        order: snapshot.order,
        topic: snapshot.topic,
        text: snapshot.text,
        answer,
        status: override?.status ?? (answer === null ? 'Nincs meg' : 'Kész'),
        rationale: override?.rationale ?? null,
      };
    }),
  };
}
async function requireRound(
  manager: EntityManager,
  projectId: string,
  roundId: string,
  lock: boolean,
) {
  const project = await manager.getRepository(Project).findOne({
    where: { id: projectId },
    lock: lock ? { mode: 'pessimistic_write' } : undefined,
  });
  if (!project) throw new NotFoundException('Project not found.');
  const round = await manager.getRepository(InterviewRoundEntity).findOne({
    where: { id: roundId, projectId },
    lock: lock ? { mode: 'pessimistic_write' } : undefined,
  });
  if (!round) throw new NotFoundException('Interview round not found.');
  return { project, round };
}
async function requireHandoff(
  manager: EntityManager,
  projectId: string,
  roundId: string,
  id: string,
  lock: boolean,
) {
  const row = await manager
    .getRepository(InterviewCustomerHandoffEntity)
    .findOne({
      where: { id, projectId, roundId },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
  if (!row)
    throw new NotFoundException('Interview customer handoff not found.');
  return row;
}
async function requireOutbound(manager: EntityManager, id: string) {
  const row = await manager
    .getRepository(CustomerOutboundCommunicationEntity)
    .findOneBy({ id });
  if (!row)
    throw new ConflictException('A tartós kimenő kommunikáció hiányzik.');
  return row;
}
function newDraft(
  repository: Repository<InterviewCustomerHandoffEntity>,
  projectId: string,
  roundId: string,
  version: number,
  supersedesHandoffId: string | null,
) {
  return repository.create({
    id: randomUUID(),
    projectId,
    roundId,
    version,
    supersedesHandoffId,
    state: 'DRAFT',
    modificationSummary: null,
    correspondenceId: null,
    outboundCommunicationId: null,
    internalOwnerName: null,
  });
}
async function reconcileExpiredSending(
  manager: EntityManager,
  projectId: string,
  roundId: string,
) {
  const row = await manager
    .getRepository(InterviewCustomerHandoffEntity)
    .findOne({ where: { projectId, roundId, state: 'SENDING' } });
  if (row && Date.now() - row.updatedAt.getTime() >= sendingLeaseMs) {
    row.state = 'UNKNOWN';
    await manager.getRepository(InterviewCustomerHandoffEntity).save(row);
    if (row.outboundCommunicationId)
      await appendCanonicalOutboundAttempt(
        manager,
        row.outboundCommunicationId,
        'UNKNOWN',
        'DELIVERY_LEASE_EXPIRED',
        null,
      );
  }
}
async function mailProjection(
  manager: EntityManager,
  row: InterviewCustomerHandoffEntity,
): Promise<HandoffMailProjection> {
  const outbound = row.outboundCommunicationId
    ? await manager
        .getRepository(CustomerOutboundCommunicationEntity)
        .findOneBy({ id: row.outboundCommunicationId })
    : null;
  const attempt = outbound
    ? await manager.getRepository(CustomerOutboundAttemptEntity).findOne({
        where: { outboundCommunicationId: outbound.id },
        order: { attemptedAt: 'DESC', id: 'DESC' },
      })
    : null;
  return { outbound, attempt };
}

async function loadHandoffMailProjections(
  manager: EntityManager,
  handoffs: readonly InterviewCustomerHandoffEntity[],
): Promise<ReadonlyMap<string, HandoffMailProjection>> {
  const outboundIds = handoffs.flatMap(({ outboundCommunicationId }) =>
    outboundCommunicationId ? [outboundCommunicationId] : [],
  );
  if (outboundIds.length === 0) {
    return new Map(
      handoffs.map((handoff) => [
        handoff.id,
        { outbound: null, attempt: null },
      ]),
    );
  }
  const outbounds = await manager
    .getRepository(CustomerOutboundCommunicationEntity)
    .createQueryBuilder('outbound')
    .where('outbound.id IN (:...outboundIds)', { outboundIds })
    .getMany();
  const attempts = await manager
    .getRepository(CustomerOutboundAttemptEntity)
    .createQueryBuilder('attempt')
    .distinctOn(['attempt.outboundCommunicationId'])
    .where('attempt.outboundCommunicationId IN (:...outboundIds)', {
      outboundIds,
    })
    .orderBy('attempt.outboundCommunicationId', 'ASC')
    .addOrderBy('attempt.attemptedAt', 'DESC')
    .addOrderBy('attempt.id', 'DESC')
    .getMany();
  const outboundById = new Map(
    outbounds.map((outbound) => [outbound.id, outbound]),
  );
  const attemptByOutboundId = new Map(
    attempts.map((attempt) => [attempt.outboundCommunicationId, attempt]),
  );
  return new Map(
    handoffs.map((handoff) => {
      const outbound = handoff.outboundCommunicationId
        ? (outboundById.get(handoff.outboundCommunicationId) ?? null)
        : null;
      return [
        handoff.id,
        {
          outbound,
          attempt: outbound
            ? (attemptByOutboundId.get(outbound.id) ?? null)
            : null,
        },
      ];
    }),
  );
}
async function toSummary(
  manager: EntityManager,
  row: InterviewCustomerHandoffEntity,
  projection?: HandoffMailProjection,
  knownReceiptEvidence?: boolean,
): Promise<InterviewCustomerHandoffSummary> {
  const { outbound, attempt } =
    projection ?? (await mailProjection(manager, row));
  return {
    id: row.id,
    projectId: row.projectId,
    roundId: row.roundId,
    version: row.version,
    state: row.state,
    modificationSummary: row.modificationSummary,
    supersedesHandoffId: row.supersedesHandoffId,
    recipientName: outbound?.recipientName ?? row.legacyRecipientName,
    recipientEmail: outbound?.recipientAddress ?? row.legacyRecipientEmail,
    senderName: outbound?.senderName ?? row.legacySenderName,
    senderAddress: outbound?.senderAddress ?? row.legacySenderAddress,
    createdAt: row.createdAt.toISOString(),
    attemptedAt:
      row.state === 'SENDING'
        ? row.updatedAt.toISOString()
        : (attempt?.attemptedAt.toISOString() ??
          row.legacyAttemptedAt?.toISOString() ??
          null),
    sentAt:
      row.state === 'SENT'
        ? (attempt?.attemptedAt.toISOString() ??
          row.legacySentAt?.toISOString() ??
          null)
        : null,
    receiptEvidence:
      knownReceiptEvidence ??
      (await hasCustomerReceiptEvidence(manager, row.correspondenceId)),
  };
}
async function toDetail(
  manager: EntityManager,
  row: InterviewCustomerHandoffEntity,
): Promise<InterviewCustomerHandoffDetail> {
  const projection = await mailProjection(manager, row);
  const summary = await toSummary(manager, row, projection);
  const { outbound, attempt } = projection;
  return {
    ...summary,
    internalOwnerName: row.internalOwnerName,
    subject: outbound?.subject ?? row.legacySubject,
    htmlContent: outbound?.htmlContent ?? row.legacyHtmlContent,
    textContent: outbound?.textContent ?? row.legacyTextContent,
    sourceContentVersion:
      outbound?.sourceContentVersion ?? row.legacySourceContentVersion,
    failureCode: attempt?.failureCode ?? row.legacyFailureCode,
    replyToAddress: outbound?.replyToAddress ?? row.legacyReplyToAddress,
    mailSystemAcceptance:
      attempt?.result === 'ACCEPTED'
        ? 'ACCEPTED'
        : attempt?.result === 'REJECTED'
          ? 'REJECTED'
          : row.legacyMailSystemAcceptance,
    messageReference: attempt?.messageReference ?? row.legacyMessageReference,
    correspondenceId: row.correspondenceId,
  };
}

interface HandoffMailProjection {
  readonly outbound: CustomerOutboundCommunicationEntity | null;
  readonly attempt: CustomerOutboundAttemptEntity | null;
}

function normalize(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
function requireMutable(project: Project) {
  if (project.status === 'ARCHIVED')
    throw new ConflictException('Archived projects are read-only.');
}
async function audit(
  manager: EntityManager,
  projectId: string,
  eventType: string,
  row: InterviewCustomerHandoffEntity,
) {
  await manager.getRepository(AuditEvent).save({
    id: randomUUID(),
    projectId,
    eventType,
    payload: {
      roundId: row.roundId,
      handoffId: row.id,
      version: String(row.version),
      state: row.state,
    },
  });
}
