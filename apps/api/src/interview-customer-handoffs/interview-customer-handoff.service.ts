import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { InterviewCustomerHandoffDetail, InterviewCustomerHandoffPreview, InterviewCustomerHandoffSummary, SendInterviewCustomerHandoffInput } from '@project-maker/contracts';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import { RoundQuestionAssessmentOverrideEntity } from '../interviews/round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { customerMailerToken, type CustomerMailer, SmtpDeliveryError } from '../mail-delivery/smtp-mailer.service';
import { Project } from '../projects/project.entity';
import { InterviewCustomerHandoffEntity } from './interview-customer-handoff.entity';
import { renderHandoff, type HandoffProjection } from './interview-customer-handoff.renderer';

const sendingLeaseMs = 600_000;

@Injectable()
export class InterviewCustomerHandoffService {
  constructor(private readonly dataSource: DataSource, @Inject(customerMailerToken) private readonly mailer: CustomerMailer) {}

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

  async preview(projectId: string, roundId: string, handoffId: string): Promise<InterviewCustomerHandoffPreview> {
    return this.dataSource.transaction(async (manager) => {
      const { project, round } = await requireRound(manager, projectId, roundId, false);
      requireMutable(project);
      const handoff = await requireHandoff(manager, projectId, roundId, handoffId, false);
      if (handoff.state !== 'DRAFT') throw new ConflictException('Csak aktív tervezet tekinthető elő.');
      return buildPreview(manager, project, round, handoff);
    });
  }

  async send(projectId: string, roundId: string, handoffId: string, input: SendInterviewCustomerHandoffInput): Promise<InterviewCustomerHandoffDetail> {
    const prepared = await this.dataSource.transaction(async (manager) => {
      const { project, round } = await requireRound(manager, projectId, roundId, true);
      requireMutable(project);
      const handoff = await requireHandoff(manager, projectId, roundId, handoffId, true);
      if (handoff.state !== 'DRAFT') throw new ConflictException('Az összefoglaló nem küldhető ebből az állapotból.');
      const preview = await buildPreview(manager, project, round, handoff);
      if (preview.sourceContentVersion !== input.sourceContentVersion || preview.previewDigest !== input.previewDigest) {
        throw new ConflictException({ code: 'PREVIEW_STALE', message: 'Az interjú az előnézet óta megváltozott.' });
      }
      Object.assign(handoff, { state: 'SENDING', recipientName: preview.recipientName, recipientEmail: preview.recipientEmail, internalOwnerName: project.internalOwnerName, subject: preview.subject, htmlContent: preview.htmlContent, textContent: preview.textContent, previewDigest: preview.previewDigest, sourceContentVersion: preview.sourceContentVersion, attemptedAt: new Date(), failureCode: null });
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
      handoff.state = 'DRAFT'; handoff.failureCode = null; clearPrepared(handoff);
      return toDetail(await manager.getRepository(InterviewCustomerHandoffEntity).save(handoff));
    });
  }

  private async deliver(prepared: InterviewCustomerHandoffEntity): Promise<InterviewCustomerHandoffDetail> {
    let state: 'SENT' | 'FAILED' | 'UNKNOWN' = 'SENT';
    try { await this.mailer.send({ to: prepared.recipientEmail!, subject: prepared.subject!, text: prepared.textContent!, html: prepared.htmlContent! }); }
    catch (error) { state = error instanceof SmtpDeliveryError ? 'FAILED' : 'UNKNOWN'; }
    return this.dataSource.transaction(async (manager) => {
      const handoff = await requireHandoff(manager, prepared.projectId, prepared.roundId, prepared.id, true);
      if (handoff.state !== 'SENDING') throw new ConflictException('A küldési állapot megváltozott.');
      handoff.state = state; handoff.sentAt = state === 'SENT' ? new Date() : null; handoff.failureCode = state === 'FAILED' ? 'SMTP_SEND_FAILED' : state === 'UNKNOWN' ? 'DELIVERY_RESULT_UNKNOWN' : null;
      const saved = await manager.getRepository(InterviewCustomerHandoffEntity).save(handoff);
      await audit(manager, prepared.projectId, state === 'SENT' ? 'INTERVIEW_HANDOFF_SENT' : state === 'FAILED' ? 'INTERVIEW_HANDOFF_FAILED' : 'INTERVIEW_HANDOFF_UNKNOWN', saved);
      return toDetail(saved);
    });
  }
}

async function buildPreview(manager: EntityManager, project: Project, round: InterviewRoundEntity, handoff: InterviewCustomerHandoffEntity): Promise<InterviewCustomerHandoffPreview> {
  if (!project.internalOwnerName) throw new ConflictException('A küldéshez meg kell adni a belső PO/PM nevét.');
  if (handoff.version > 1 && !normalize(handoff.modificationSummary)) throw new BadRequestException('A módosítás összefoglalása kötelező.');
  const projection = await loadProjection(manager, project, round, handoff);
  const rendered = renderHandoff(projection);
  return { handoffId: handoff.id, version: handoff.version, recipientName: project.customerContactName, recipientEmail: project.customerContactEmail, ...rendered, sourceContentVersion: round.contentVersion };
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
  return repository.create({ id: randomUUID(), projectId, roundId, version, supersedesHandoffId, state: 'DRAFT', modificationSummary: null, recipientName: null, recipientEmail: null, internalOwnerName: null, subject: null, htmlContent: null, textContent: null, previewDigest: null, sourceContentVersion: null, failureCode: null, attemptedAt: null, sentAt: null });
}

async function reconcileExpiredSending(manager: EntityManager, projectId: string, roundId: string) {
  const row = await manager.getRepository(InterviewCustomerHandoffEntity).findOne({ where: { projectId, roundId, state: 'SENDING' } });
  if (row?.attemptedAt && Date.now() - row.attemptedAt.getTime() >= sendingLeaseMs) { row.state = 'UNKNOWN'; row.failureCode = 'DELIVERY_LEASE_EXPIRED'; await manager.getRepository(InterviewCustomerHandoffEntity).save(row); }
}

function clearPrepared(row: InterviewCustomerHandoffEntity) { Object.assign(row, { recipientName: null, recipientEmail: null, internalOwnerName: null, subject: null, htmlContent: null, textContent: null, previewDigest: null, sourceContentVersion: null, attemptedAt: null, sentAt: null }); }
function normalize(value: string | null) { const trimmed = value?.trim(); return trimmed ? trimmed : null; }
function requireMutable(project: Project) { if (project.status === 'ARCHIVED') throw new ConflictException('Archived projects are read-only.'); }
function toSummary(row: InterviewCustomerHandoffEntity): InterviewCustomerHandoffSummary { return { id: row.id, projectId: row.projectId, roundId: row.roundId, version: row.version, state: row.state, modificationSummary: row.modificationSummary, supersedesHandoffId: row.supersedesHandoffId, recipientName: row.recipientName, recipientEmail: row.recipientEmail, createdAt: row.createdAt.toISOString(), attemptedAt: row.attemptedAt?.toISOString() ?? null, sentAt: row.sentAt?.toISOString() ?? null }; }
function toDetail(row: InterviewCustomerHandoffEntity): InterviewCustomerHandoffDetail { return { ...toSummary(row), internalOwnerName: row.internalOwnerName, subject: row.subject, htmlContent: row.htmlContent, textContent: row.textContent, sourceContentVersion: row.sourceContentVersion, failureCode: row.failureCode }; }
async function audit(manager: EntityManager, projectId: string, eventType: string, row: InterviewCustomerHandoffEntity) { await manager.getRepository(AuditEvent).save({ id: randomUUID(), projectId, eventType, payload: { roundId: row.roundId, handoffId: row.id, version: String(row.version), state: row.state } }); }
