import { randomBytes, randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InterviewCustomerHandoffDetail, InterviewCustomerHandoffPreview, InterviewCustomerHandoffSummary, InterviewHandoffSenderOptions, InterviewHandoffSenderSelection, SendInterviewCustomerHandoffInput } from '@project-maker/contracts';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import { RoundQuestionAssessmentOverrideEntity } from '../interviews/round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { CustomerMailBoundaryError, type CustomerOutboundMail, customerOutboundMailToken, immutableOutboundCustomerMessage } from '../mail-delivery/customer-mail-boundary';
import { Project } from '../projects/project.entity';
import {
  customerMailDigest as sha256,
  customerReplyToAddress as plusAddress,
  dedicatedCustomerSender as dedicatedSender,
  requireCustomerSender,
  resolveCustomerSender as resolveSender,
} from '../mail-delivery/customer-mail-identity';
import { InterviewCustomerHandoffEntity } from './interview-customer-handoff.entity';
import { renderHandoff, type HandoffProjection } from './interview-customer-handoff.renderer';
import { CustomerCorrespondenceEntity } from './customer-correspondence.entity';
import { CustomerOutboundAttemptEntity } from './customer-outbound-attempt.entity';
import { CustomerOutboundCommunicationEntity } from './customer-outbound-communication.entity';

const sendingLeaseMs = 600_000;

@Injectable()
export class InterviewCustomerHandoffService {
  constructor(private readonly dataSource: DataSource, @Inject(customerOutboundMailToken) private readonly mailer: CustomerOutboundMail, private readonly config: ConfigService) {}

  async senderOptions(projectId: string, roundId: string): Promise<InterviewHandoffSenderOptions> {
    return this.dataSource.transaction(async (manager) => {
      const { project } = await requireRound(manager, projectId, roundId, false);
      const dedicated = dedicatedSender(this.config);
      return { dedicatedName: dedicated.name, dedicatedAddress: dedicated.address, lastUsedName: project.lastCustomerSenderName, lastUsedAddress: project.lastCustomerSenderAddress };
    });
  }

  async establishFirstDraft(manager: EntityManager, projectId: string, roundId: string): Promise<InterviewCustomerHandoffEntity> {
    const repository = manager.getRepository(InterviewCustomerHandoffEntity);
    const existing = await repository.findOne({ where: { roundId }, order: { version: 'DESC' } });
    return existing ?? repository.save(newDraft(repository, projectId, roundId, 1, null));
  }

  async requireEditableRound(manager: EntityManager, round: InterviewRoundEntity): Promise<void> {
    if (round.status === 'OPEN') return;
    const latest = await manager.getRepository(InterviewCustomerHandoffEntity).findOne({ where: { roundId: round.id }, order: { version: 'DESC' } });
    if (!latest || latest.state === 'DRAFT') return;
    throw new ConflictException('Az interjú csak aktív összefoglaló-tervezettel szerkeszthető.');
  }

  async list(projectId: string, roundId: string): Promise<readonly InterviewCustomerHandoffSummary[]> {
    return this.dataSource.transaction(async (manager) => {
      await requireRound(manager, projectId, roundId, false);
      await reconcileExpiredSending(manager, projectId, roundId);
      return (await manager.getRepository(InterviewCustomerHandoffEntity).find({ where: { projectId, roundId }, order: { version: 'DESC' } })).map(toSummary);
    });
  }

  async get(projectId: string, roundId: string, handoffId: string): Promise<InterviewCustomerHandoffDetail> {
    return this.dataSource.transaction(async (manager) => {
      await requireRound(manager, projectId, roundId, false);
      return toDetail(await requireHandoff(manager, projectId, roundId, handoffId, false));
    });
  }

  async startDraft(projectId: string, roundId: string): Promise<InterviewCustomerHandoffDetail> {
    return this.dataSource.transaction(async (manager) => {
      const { project, round } = await requireRound(manager, projectId, roundId, true);
      requireMutable(project);
      if (round.status !== 'ENDED') throw new ConflictException('Új összefoglaló-verzió csak lezárt interjúhoz indítható.');
      await reconcileExpiredSending(manager, projectId, roundId);
      const repository = manager.getRepository(InterviewCustomerHandoffEntity);
      const latest = await repository.findOne({ where: { roundId }, order: { version: 'DESC' }, lock: { mode: 'pessimistic_write' } });
      if (!latest) return toDetail(await this.establishFirstDraft(manager, projectId, roundId));
      if (latest.state !== 'SENT') throw new ConflictException('Már van aktív összefoglaló-verzió.');
      const draft = await repository.save(newDraft(repository, projectId, roundId, latest.version + 1, latest.id));
      await audit(manager, projectId, 'INTERVIEW_HANDOFF_REVISION_STARTED', draft);
      return toDetail(draft);
    });
  }

  async updateDraft(projectId: string, roundId: string, handoffId: string, value: string | null): Promise<InterviewCustomerHandoffDetail> {
    return this.dataSource.transaction(async (manager) => {
      const { project } = await requireRound(manager, projectId, roundId, true);
      requireMutable(project);
      const handoff = await requireHandoff(manager, projectId, roundId, handoffId, true);
      if (handoff.state !== 'DRAFT') throw new ConflictException('Csak aktív tervezet szerkeszthető.');
      handoff.modificationSummary = normalize(value);
      clearPrepared(handoff);
      return toDetail(await manager.getRepository(InterviewCustomerHandoffEntity).save(handoff));
    });
  }

  async preview(projectId: string, roundId: string, handoffId: string, selection: InterviewHandoffSenderSelection): Promise<InterviewCustomerHandoffPreview> {
    return this.dataSource.transaction(async (manager) => {
      const { project, round } = await requireRound(manager, projectId, roundId, false);
      requireMutable(project);
      const handoff = await requireHandoff(manager, projectId, roundId, handoffId, false);
      if (handoff.state !== 'DRAFT') throw new ConflictException('Csak aktív tervezet tekinthető elő.');
      return buildPreview(manager, project, round, handoff, resolveSender(selection, this.config));
    });
  }

  async send(projectId: string, roundId: string, handoffId: string, input: SendInterviewCustomerHandoffInput): Promise<InterviewCustomerHandoffDetail> {
    const prepared = await this.dataSource.transaction(async (manager) => {
      const { project, round } = await requireRound(manager, projectId, roundId, true);
      requireMutable(project);
      const handoff = await requireHandoff(manager, projectId, roundId, handoffId, true);
      if (handoff.state !== 'DRAFT') throw new ConflictException('Az összefoglaló nem küldhető ebből az állapotból.');
      const sender = handoff.senderAddress && handoff.senderName
        ? { address: handoff.senderAddress, name: handoff.senderName }
        : null;
      if (sender) throw new ConflictException('Ehhez a verzióhoz már rögzítettük a levelezési azonosságot.');
      const preview = await buildPreview(manager, project, round, handoff, senderFromDigestInput(input));
      if (preview.sourceContentVersion !== input.sourceContentVersion || preview.previewDigest !== input.previewDigest) {
        throw new ConflictException({ code: 'PREVIEW_STALE', message: 'Az interjú az előnézet óta megváltozott.' });
      }
      const token = randomBytes(32).toString('base64url');
      const replyToAddress = plusAddress(dedicatedSender(this.config).address, token);
      const predecessor = handoff.supersedesHandoffId
        ? await manager.getRepository(InterviewCustomerHandoffEntity).findOneBy({ id: handoff.supersedesHandoffId })
        : null;
      const outbound = await manager.getRepository(CustomerOutboundCommunicationEntity).save({ id: randomUUID(), projectId, sourceType: 'INTERVIEW_HANDOFF', sourceId: handoff.id, senderName: preview.senderName, senderAddress: preview.senderAddress, recipientName: preview.recipientName, recipientAddress: preview.recipientEmail, subject: preview.subject, htmlContent: preview.htmlContent, textContent: preview.textContent, sourceContentVersion: preview.sourceContentVersion, previewDigest: preview.previewDigest, replyToAddress, replyTokenHash: sha256(token) });
      const correspondence = await manager.getRepository(CustomerCorrespondenceEntity).save({ id: randomUUID(), projectId, outboundCommunicationId: outbound.id, predecessorId: predecessor?.correspondenceId ?? null, status: 'Válaszra vár', unreadMessageCount: 0 });
      Object.assign(handoff, { state: 'SENDING', recipientName: preview.recipientName, recipientEmail: preview.recipientEmail, senderName: preview.senderName, senderAddress: preview.senderAddress, replyToAddress, replyTokenHash: sha256(token), correspondenceId: correspondence.id, outboundCommunicationId: outbound.id, internalOwnerName: project.internalOwnerName, subject: preview.subject, htmlContent: preview.htmlContent, textContent: preview.textContent, previewDigest: preview.previewDigest, sourceContentVersion: preview.sourceContentVersion, attemptedAt: new Date(), failureCode: null, mailSystemAcceptance: null, messageReference: null });
      return manager.getRepository(InterviewCustomerHandoffEntity).save(handoff);
    });
    return this.deliver(prepared);
  }

  async retry(projectId: string, roundId: string, handoffId: string, acknowledged: boolean): Promise<InterviewCustomerHandoffDetail> {
    const prepared = await this.dataSource.transaction(async (manager) => {
      const { project } = await requireRound(manager, projectId, roundId, true);
      requireMutable(project);
      const handoff = await requireHandoff(manager, projectId, roundId, handoffId, true);
      if (handoff.state === 'UNKNOWN' && !acknowledged) throw new BadRequestException('A kettős küldés kockázatát el kell fogadni.');
      if (!['FAILED', 'UNKNOWN'].includes(handoff.state)) throw new ConflictException('Ez a küldés nem próbálható újra.');
      if (!handoff.subject || !handoff.textContent || !handoff.htmlContent || !handoff.recipientEmail) throw new ConflictException('Nincs újraküldhető rögzített tartalom.');
      handoff.state = 'SENDING'; handoff.attemptedAt = new Date(); handoff.failureCode = null;
      return manager.getRepository(InterviewCustomerHandoffEntity).save(handoff);
    });
    return this.deliver(prepared);
  }

  async resumeEditing(projectId: string, roundId: string, handoffId: string): Promise<InterviewCustomerHandoffDetail> {
    return this.dataSource.transaction(async (manager) => {
      const { project } = await requireRound(manager, projectId, roundId, true); requireMutable(project);
      const handoff = await requireHandoff(manager, projectId, roundId, handoffId, true);
      if (handoff.state !== 'FAILED') throw new ConflictException('Csak ismert hibával meghiúsult küldés nyitható újra.');
      if (handoff.correspondenceId) throw new ConflictException('A már átadott logikai verzió változatlan tartalommal próbálható újra.');
      handoff.state = 'DRAFT'; handoff.failureCode = null; clearPrepared(handoff);
      return toDetail(await manager.getRepository(InterviewCustomerHandoffEntity).save(handoff));
    });
  }

  private async deliver(prepared: InterviewCustomerHandoffEntity): Promise<InterviewCustomerHandoffDetail> {
    let state: 'SENT' | 'FAILED' | 'UNKNOWN' = 'SENT';
    let acceptance: 'ACCEPTED' | 'REJECTED' | null = null;
    let messageReference: string | null = null;
    try { const result = await this.mailer.submit(immutableOutboundCustomerMessage({ senderAddress: prepared.senderAddress!, senderName: prepared.senderName!, recipientAddress: prepared.recipientEmail!, replyToAddress: prepared.replyToAddress!, subject: prepared.subject!, textContent: prepared.textContent!, htmlContent: prepared.htmlContent! })); acceptance = result.acceptance; messageReference = result.messageReference; if (result.acceptance === 'REJECTED') state = 'FAILED'; }
    catch (error) { state = error instanceof CustomerMailBoundaryError && error.code !== 'OUTCOME_UNKNOWN' ? 'FAILED' : 'UNKNOWN'; }
    return this.dataSource.transaction(async (manager) => {
      const handoff = await requireHandoff(manager, prepared.projectId, prepared.roundId, prepared.id, true);
      if (handoff.state !== 'SENDING') throw new ConflictException('A küldési állapot megváltozott.');
      handoff.state = state; handoff.sentAt = state === 'SENT' ? new Date() : null; handoff.failureCode = state === 'FAILED' ? 'MAIL_SUBMISSION_FAILED' : state === 'UNKNOWN' ? 'SUBMISSION_RESULT_UNKNOWN' : null; handoff.mailSystemAcceptance = acceptance; handoff.messageReference = messageReference;
      const saved = await manager.getRepository(InterviewCustomerHandoffEntity).save(handoff);
      if (!handoff.outboundCommunicationId) throw new ConflictException('A tartós kimenő kommunikáció hiányzik.');
      await manager.getRepository(CustomerOutboundAttemptEntity).save({ id: randomUUID(), outboundCommunicationId: handoff.outboundCommunicationId, result: state === 'SENT' ? 'ACCEPTED' : state === 'FAILED' ? 'REJECTED' : 'UNKNOWN', failureCode: handoff.failureCode, messageReference });
      if (state === 'SENT') {
        const project = await manager.getRepository(Project).findOneByOrFail({ id: prepared.projectId });
        project.lastCustomerSenderName = handoff.senderName;
        project.lastCustomerSenderAddress = handoff.senderAddress;
        await manager.getRepository(Project).save(project);
      }
      await audit(manager, prepared.projectId, state === 'SENT' ? 'INTERVIEW_HANDOFF_SENT' : state === 'FAILED' ? 'INTERVIEW_HANDOFF_FAILED' : 'INTERVIEW_HANDOFF_UNKNOWN', saved);
      return toDetail(saved);
    });
  }
}

async function buildPreview(manager: EntityManager, project: Project, round: InterviewRoundEntity, handoff: InterviewCustomerHandoffEntity, sender: { name: string; address: string }): Promise<InterviewCustomerHandoffPreview> {
  if (!project.internalOwnerName) throw new ConflictException('A küldéshez meg kell adni a belső PO/PM nevét.');
  if (handoff.version > 1 && !normalize(handoff.modificationSummary)) throw new BadRequestException('A módosítás összefoglalása kötelező.');
  const projection = await loadProjection(manager, project, round, handoff);
  const rendered = renderHandoff(projection);
  const previewDigest = sha256([rendered.previewDigest, sender.name, sender.address.toLowerCase(), project.customerContactName, project.customerContactEmail.toLowerCase()].join('\n'));
  return { handoffId: handoff.id, version: handoff.version, recipientName: project.customerContactName, recipientEmail: project.customerContactEmail, senderName: sender.name, senderAddress: sender.address, ...rendered, previewDigest, sourceContentVersion: round.contentVersion };
}

async function loadProjection(manager: EntityManager, project: Project, round: InterviewRoundEntity, handoff: InterviewCustomerHandoffEntity): Promise<HandoffProjection> {
  const snapshots = await manager.getRepository(RoundQuestionSnapshotEntity).find({ where: { roundId: round.id }, order: { order: 'ASC' } });
  const ids = snapshots.map(({ id }) => id);
  const answers = ids.length ? await manager.getRepository(RoundAnswerEntity).find({ where: { roundId: round.id, snapshotId: In(ids) } }) : [];
  const overrides = ids.length ? await manager.getRepository(RoundQuestionAssessmentOverrideEntity).find({ where: { roundId: round.id, snapshotId: In(ids) } }) : [];
  const answerMap = new Map(answers.map((answer) => [answer.snapshotId, answer.value]));
  const overrideMap = new Map(overrides.map((override) => [override.snapshotId, override]));
  const superseded = handoff.supersedesHandoffId ? await manager.getRepository(InterviewCustomerHandoffEntity).findOneBy({ id: handoff.supersedesHandoffId }) : null;
  return { projectName: project.name, recipientName: project.customerContactName, recipientEmail: project.customerContactEmail, internalOwnerName: project.internalOwnerName!, roundDate: round.createdAt.toISOString(), version: handoff.version, supersededVersion: superseded?.version ?? null, modificationSummary: handoff.modificationSummary, sourceContentVersion: round.contentVersion, questions: snapshots.map((snapshot) => { const answer = answerMap.get(snapshot.id) ?? null; const override = overrideMap.get(snapshot.id); return { order: snapshot.order, topic: snapshot.topic, text: snapshot.text, answer, status: override?.status ?? (answer === null ? 'Nincs meg' : 'Kész'), rationale: override?.rationale ?? null }; }) };
}

async function requireRound(manager: EntityManager, projectId: string, roundId: string, lock: boolean) {
  const project = await manager.getRepository(Project).findOne({ where: { id: projectId }, lock: lock ? { mode: 'pessimistic_write' } : undefined });
  if (!project) throw new NotFoundException('Project not found.');
  const round = await manager.getRepository(InterviewRoundEntity).findOne({ where: { id: roundId, projectId }, lock: lock ? { mode: 'pessimistic_write' } : undefined });
  if (!round) throw new NotFoundException('Interview round not found.');
  return { project, round };
}

async function requireHandoff(manager: EntityManager, projectId: string, roundId: string, id: string, lock: boolean) {
  const row = await manager.getRepository(InterviewCustomerHandoffEntity).findOne({ where: { id, projectId, roundId }, lock: lock ? { mode: 'pessimistic_write' } : undefined });
  if (!row) throw new NotFoundException('Interview customer handoff not found.');
  return row;
}

function newDraft(repository: Repository<InterviewCustomerHandoffEntity>, projectId: string, roundId: string, version: number, supersedesHandoffId: string | null) {
  return repository.create({ id: randomUUID(), projectId, roundId, version, supersedesHandoffId, state: 'DRAFT', modificationSummary: null, recipientName: null, recipientEmail: null, senderName: null, senderAddress: null, replyToAddress: null, replyTokenHash: null, mailSystemAcceptance: null, messageReference: null, correspondenceId: null, outboundCommunicationId: null, internalOwnerName: null, subject: null, htmlContent: null, textContent: null, previewDigest: null, sourceContentVersion: null, failureCode: null, attemptedAt: null, sentAt: null });
}

async function reconcileExpiredSending(manager: EntityManager, projectId: string, roundId: string) {
  const row = await manager.getRepository(InterviewCustomerHandoffEntity).findOne({ where: { projectId, roundId, state: 'SENDING' } });
  if (row?.attemptedAt && Date.now() - row.attemptedAt.getTime() >= sendingLeaseMs) { row.state = 'UNKNOWN'; row.failureCode = 'DELIVERY_LEASE_EXPIRED'; await manager.getRepository(InterviewCustomerHandoffEntity).save(row); }
}

function clearPrepared(row: InterviewCustomerHandoffEntity) { Object.assign(row, { recipientName: null, recipientEmail: null, senderName: null, senderAddress: null, replyToAddress: null, replyTokenHash: null, mailSystemAcceptance: null, messageReference: null, correspondenceId: null, outboundCommunicationId: null, internalOwnerName: null, subject: null, htmlContent: null, textContent: null, previewDigest: null, sourceContentVersion: null, attemptedAt: null, sentAt: null }); }
function normalize(value: string | null) { const trimmed = value?.trim(); return trimmed ? trimmed : null; }
function requireMutable(project: Project) { if (project.status === 'ARCHIVED') throw new ConflictException('Archived projects are read-only.'); }
function toSummary(row: InterviewCustomerHandoffEntity): InterviewCustomerHandoffSummary { return { id: row.id, projectId: row.projectId, roundId: row.roundId, version: row.version, state: row.state, modificationSummary: row.modificationSummary, supersedesHandoffId: row.supersedesHandoffId, recipientName: row.recipientName, recipientEmail: row.recipientEmail, senderName: row.senderName, senderAddress: row.senderAddress, createdAt: row.createdAt.toISOString(), attemptedAt: row.attemptedAt?.toISOString() ?? null, sentAt: row.sentAt?.toISOString() ?? null }; }
function toDetail(row: InterviewCustomerHandoffEntity): InterviewCustomerHandoffDetail { return { ...toSummary(row), internalOwnerName: row.internalOwnerName, subject: row.subject, htmlContent: row.htmlContent, textContent: row.textContent, sourceContentVersion: row.sourceContentVersion, failureCode: row.failureCode, replyToAddress: row.replyToAddress, mailSystemAcceptance: row.mailSystemAcceptance, messageReference: row.messageReference, correspondenceId: row.correspondenceId }; }
async function audit(manager: EntityManager, projectId: string, eventType: string, row: InterviewCustomerHandoffEntity) { await manager.getRepository(AuditEvent).save({ id: randomUUID(), projectId, eventType, payload: { roundId: row.roundId, handoffId: row.id, version: String(row.version), state: row.state } }); }

function senderFromDigestInput(input: SendInterviewCustomerHandoffInput): { name: string; address: string } {
  return requireCustomerSender(input.senderName, input.senderAddress);
}
