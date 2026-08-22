import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CustomerResponseEligiblePrompt,
  CustomerResponseRequest,
  CustomerResponseRequestPreview,
  CustomerResponseSubmissionReceipt,
  Evidence,
  PublicCustomerResponseRequest,
} from '@project-maker/contracts';
import { DataSource, In, type EntityManager } from 'typeorm';

import { currentAuditActorId, runWithAuditActor, systemAuditActorId } from '../audit/audit-actor';
import { AuditEvent } from '../audit/audit-event.entity';
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { EvidenceEntity } from '../discovery/evidence.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { CustomerCorrespondenceEntity } from '../interview-customer-handoffs/customer-correspondence.entity';
import { CustomerOutboundAttemptEntity } from '../interview-customer-handoffs/customer-outbound-attempt.entity';
import { CustomerOutboundCommunicationEntity } from '../interview-customer-handoffs/customer-outbound-communication.entity';
import {
  CustomerMailBoundaryError,
  customerOutboundMailToken,
  immutableOutboundCustomerMessage,
  type CustomerOutboundMail,
} from '../mail-delivery/customer-mail-boundary';
import {
  customerMailDigest,
  customerReplyToAddress,
  dedicatedCustomerSender,
} from '../mail-delivery/customer-mail-identity';
import { Project } from '../projects/project.entity';
import { CustomerResponseAnswerEntity } from './customer-response-answer.entity';
import { CustomerResponsePromptEntity } from './customer-response-prompt.entity';
import { CustomerResponseRequestEntity } from './customer-response-request.entity';
import { CustomerResponseSubmissionEntity } from './customer-response-submission.entity';
import type {
  ConfirmCustomerResponseRequestDto,
  PreviewCustomerResponseRequestDto,
  SubmitCustomerResponseDto,
} from './dto/customer-response.dto';

const requestLifetimeMs = 14 * 24 * 60 * 60 * 1_000;
const previewLifetimeMs = 30 * 60 * 1_000;
const unavailableMessage = 'This clarification request is unavailable.';

interface PreviewPayload {
  readonly previewId: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly senderName: string;
  readonly senderAddress: string;
  readonly publicOrigin: string;
  readonly prompts: readonly CustomerResponseEligiblePrompt[];
  readonly requestExpiresAt: string;
  readonly previewExpiresAt: string;
}

@Injectable()
export class CustomerResponseService {
  private readonly rateWindows = new Map<string, { count: number; startedAt: number }>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Inject(customerOutboundMailToken) private readonly mailer: CustomerOutboundMail,
  ) {}

  async eligiblePrompts(projectId: string): Promise<readonly CustomerResponseEligiblePrompt[]> {
    await requireActiveProject(this.dataSource.manager, projectId);
    const roundPrompts = await this.dataSource.query(`
      SELECT snapshot."id" AS "source_id", round."content_version" AS "source_version",
             snapshot."topic", snapshot."text", snapshot."display_order"
      FROM "round_question_snapshots" snapshot
      JOIN "interview_rounds" round ON round."id" = snapshot."round_id"
      WHERE round."project_id" = $1 AND round."status" = 'OPEN'
        AND round."type" IN ('STAKEHOLDER', 'CLARIFICATION')
      ORDER BY round."created_at", snapshot."display_order", snapshot."id"
    `, [projectId]) as Array<{
      source_id: string; source_version: number; topic: string; text: string; display_order: number;
    }>;
    const followUps = await this.dataSource.getRepository(DiscoveryFollowUpEntity)
      .createQueryBuilder('followUp')
      .select('followUp.id', 'source_id')
      .addSelect('followUp.version', 'source_version')
      .addSelect('followUp.category', 'topic')
      .addSelect('followUp.question', 'text')
      .where('followUp.projectId = :projectId', { projectId })
      .andWhere('followUp.decisionOrAnswer IS NULL')
      .orderBy('followUp.createdAt', 'ASC')
      .addOrderBy('followUp.id', 'ASC')
      .getRawMany<{ source_id: string; source_version: number; topic: string; text: string }>();
    return [
      ...roundPrompts.map((row) => ({
        sourceKind: 'ROUND_PROMPT' as const,
        sourceId: row.source_id,
        sourceVersion: row.source_version,
        topic: row.topic,
        text: row.text,
      })),
      ...followUps.map((row) => ({
        sourceKind: 'DISCOVERY_FOLLOW_UP' as const,
        sourceId: row.source_id,
        sourceVersion: row.source_version,
        topic: row.topic,
        text: row.text,
      })),
    ];
  }

  async preview(
    projectId: string,
    input: PreviewCustomerResponseRequestDto,
  ): Promise<CustomerResponseRequestPreview> {
    const publicOrigin = this.publicOrigin();
    if (!this.mailer.isConfigured()) throw new ConflictException('Customer correspondence is not configured.');
    const project = await requireActiveProject(this.dataSource.manager, projectId);
    const eligible = await this.eligiblePrompts(projectId);
    const byKey = new Map(eligible.map((prompt) => [promptKey(prompt.sourceKind, prompt.sourceId), prompt]));
    const keys = input.prompts.map((prompt) => promptKey(prompt.sourceKind, prompt.sourceId));
    if (new Set(keys).size !== keys.length) throw new BadRequestException('Each question may be selected only once.');
    const prompts = keys.map((key) => byKey.get(key));
    if (prompts.some((prompt) => !prompt)) throw new BadRequestException('A selected question is no longer available.');
    const now = Date.now();
    const payload: PreviewPayload = {
      previewId: randomUUID(),
      projectId,
      projectName: project.name,
      recipientName: project.customerContactName,
      recipientEmail: project.customerContactEmail,
      ...senderFields(dedicatedCustomerSender(this.config)),
      publicOrigin,
      prompts: prompts as CustomerResponseEligiblePrompt[],
      requestExpiresAt: new Date(now + requestLifetimeMs).toISOString(),
      previewExpiresAt: new Date(now + previewLifetimeMs).toISOString(),
    };
    const rendered = renderRequest(payload, '<egyedi-link>');
    return {
      previewToken: encodePreview(payload, this.previewSecret()),
      recipientName: payload.recipientName,
      recipientEmail: payload.recipientEmail,
      senderName: payload.senderName,
      senderAddress: payload.senderAddress,
      prompts: payload.prompts,
      expiresAt: payload.requestExpiresAt,
      ...rendered,
    };
  }

  async confirm(projectId: string, input: ConfirmCustomerResponseRequestDto): Promise<CustomerResponseRequest> {
    const payload = decodePreview(input.previewToken, this.previewSecret());
    if (payload.projectId !== projectId || Date.parse(payload.previewExpiresAt) <= Date.now()) {
      throw new ConflictException('The preview has expired. Generate a new preview.');
    }
    if (payload.publicOrigin !== this.publicOrigin() || !this.mailer.isConfigured()) {
      throw new ConflictException('The Customer response form or correspondence gateway is unavailable.');
    }
    const prepared = await this.dataSource.transaction(async (manager) => {
      await requireActiveProject(manager, projectId, true);
      const repository = manager.getRepository(CustomerResponseRequestEntity);
      const existing = await repository.findOneBy({ previewId: payload.previewId });
      if (existing) return { request: existing, shouldDeliver: false };
      const id = randomUUID();
      const capability = randomBytes(32).toString('base64url');
      const request = await repository.save(repository.create({
        id,
        projectId,
        previewId: payload.previewId,
        state: 'OPEN',
        deliveryState: 'SENDING',
        tokenDigest: sha256(capability),
        recipientName: payload.recipientName,
        recipientEmail: payload.recipientEmail,
        subject: renderRequest(payload, '<egyedi-link>').subject,
        textContent: renderRequest(payload, '<egyedi-link>').textContent,
        htmlContent: renderRequest(payload, '<egyedi-link>').htmlContent,
        expiresAt: new Date(payload.requestExpiresAt),
        revokedAt: null,
        outboundCommunicationId: null,
        correspondenceId: null,
        failureCode: null,
        attemptedAt: new Date(),
        sentAt: null,
      }));
      await manager.getRepository(CustomerResponsePromptEntity).save(payload.prompts.map((prompt, index) => ({
        id: randomUUID(), requestId: id, order: index + 1, ...prompt,
      })));
      const rendered = renderRequest(payload, capability);
      const replyToken = randomBytes(24).toString('hex');
      const replyToAddress = customerReplyToAddress(payload.senderAddress, replyToken);
      const outbound = await manager.getRepository(CustomerOutboundCommunicationEntity).save({
        id: randomUUID(),
        projectId,
        sourceType: 'CUSTOMER_RESPONSE_REQUEST',
        sourceId: id,
        senderName: payload.senderName,
        senderAddress: payload.senderAddress,
        recipientName: payload.recipientName,
        recipientAddress: payload.recipientEmail,
        ...rendered,
        sourceContentVersion: 1,
        previewDigest: customerMailDigest(`${rendered.subject}\n${rendered.textContent}\n${rendered.htmlContent}`),
        replyToAddress,
        replyTokenHash: sha256(replyToken),
      });
      const correspondence = await manager.getRepository(CustomerCorrespondenceEntity).save({
        id: randomUUID(), projectId, outboundCommunicationId: outbound.id, predecessorId: null,
        sourceFollowUpId: null, sourceFollowUpVersion: null, status: 'Válaszra vár', unreadMessageCount: 0,
      });
      request.outboundCommunicationId = outbound.id;
      request.correspondenceId = correspondence.id;
      const saved = await repository.save(request);
      await audit(manager, projectId, 'CUSTOMER_RESPONSE_REQUEST_CONFIRMED', {
        requestId: id, promptCount: String(payload.prompts.length),
      });
      return { request: saved, shouldDeliver: true };
    });
    if (prepared.shouldDeliver) await this.deliver(prepared.request);
    return this.get(projectId, prepared.request.id);
  }

  async retry(projectId: string, requestId: string): Promise<CustomerResponseRequest> {
    const prepared = await this.dataSource.transaction(async (manager) => {
      await requireActiveProject(manager, projectId, true);
      const request = await requireRequest(manager, projectId, requestId, true);
      if (request.state !== 'OPEN' || !['FAILED', 'UNKNOWN'].includes(request.deliveryState)) {
        throw new ConflictException('This clarification request cannot be retried.');
      }
      request.deliveryState = 'SENDING';
      request.attemptedAt = new Date();
      request.failureCode = null;
      return manager.getRepository(CustomerResponseRequestEntity).save(request);
    });
    await this.deliver(prepared);
    return this.get(projectId, requestId);
  }

  async list(projectId: string): Promise<readonly CustomerResponseRequest[]> {
    await requireProject(this.dataSource.manager, projectId);
    const rows = await this.dataSource.getRepository(CustomerResponseRequestEntity).find({
      where: { projectId }, order: { createdAt: 'DESC', id: 'ASC' },
    });
    return this.toViews(rows);
  }

  async get(projectId: string, requestId: string): Promise<CustomerResponseRequest> {
    const row = await requireRequest(this.dataSource.manager, projectId, requestId, false);
    return (await this.toViews([row]))[0]!;
  }

  async revoke(projectId: string, requestId: string): Promise<CustomerResponseRequest> {
    await this.dataSource.transaction(async (manager) => {
      await requireActiveProject(manager, projectId, true);
      const request = await requireRequest(manager, projectId, requestId, true);
      if (request.state !== 'OPEN') throw new ConflictException('Only an open clarification request can be revoked.');
      request.state = 'REVOKED';
      request.revokedAt = new Date();
      await manager.getRepository(CustomerResponseRequestEntity).save(request);
      await audit(manager, projectId, 'CUSTOMER_RESPONSE_REQUEST_REVOKED', { requestId });
    });
    return this.get(projectId, requestId);
  }

  async exchange(capability: string, ip: string): Promise<void> {
    this.rateLimit(`${ip}:${sha256(capability)}`);
    await this.requireUsableByCapability(capability);
  }

  async publicRequest(capability: string, ip: string): Promise<PublicCustomerResponseRequest> {
    this.rateLimit(`${ip}:${sha256(capability)}`);
    const { request, project } = await this.requireUsableByCapability(capability);
    const prompts = await this.dataSource.getRepository(CustomerResponsePromptEntity).find({
      where: { requestId: request.id }, order: { order: 'ASC' },
    });
    return {
      requestId: request.id,
      projectName: project.name,
      expiresAt: request.expiresAt.toISOString(),
      prompts: prompts.map(({ id, order, topic, text }) => ({ id, order, topic, text })),
    };
  }

  async submit(
    capability: string,
    ip: string,
    input: SubmitCustomerResponseDto,
  ): Promise<CustomerResponseSubmissionReceipt> {
    this.rateLimit(`${ip}:${sha256(capability)}`);
    return runWithAuditActor('external-capability', () => this.dataSource.transaction(async (manager) => {
      const digest = sha256(capability);
      const request = await manager.getRepository(CustomerResponseRequestEntity).findOne({
        where: { tokenDigest: digest }, lock: { mode: 'pessimistic_write' },
      });
      if (!request) throw unavailable();
      const existing = await manager.getRepository(CustomerResponseSubmissionEntity).findOneBy({ requestId: request.id });
      if (existing) {
        if (existing.idempotencyKey !== input.idempotencyKey) throw unavailable();
        return { submissionId: existing.id, submittedAt: existing.submittedAt.toISOString() };
      }
      const project = await manager.getRepository(Project).findOneBy({ id: request.projectId });
      requireUsable(request, project);
      const prompts = await manager.getRepository(CustomerResponsePromptEntity).find({
        where: { requestId: request.id }, order: { order: 'ASC' },
      });
      if (input.answers.length !== prompts.length) throw new BadRequestException('Every question requires an answer.');
      const answerByPrompt = new Map(input.answers.map((answer) => [answer.promptId, answer.answer.trim()]));
      if (answerByPrompt.size !== prompts.length || prompts.some((prompt) => !answerByPrompt.has(prompt.id))) {
        throw new BadRequestException('Every question must be answered exactly once.');
      }
      const submittedAt = new Date();
      const submission = await manager.getRepository(CustomerResponseSubmissionEntity).save({
        id: randomUUID(), requestId: request.id, idempotencyKey: input.idempotencyKey,
        submittedAt, reviewedAt: null, reviewedBy: null,
      });
      await manager.getRepository(CustomerResponseAnswerEntity).save(prompts.map((prompt) => ({
        id: randomUUID(), submissionId: submission.id, promptId: prompt.id, order: prompt.order,
        answer: answerByPrompt.get(prompt.id)!, createdAt: submittedAt,
      })));
      request.state = 'SUBMITTED';
      await manager.getRepository(CustomerResponseRequestEntity).save(request);
      await audit(manager, request.projectId, 'CUSTOMER_RESPONSE_SUBMITTED', {
        requestId: request.id, submissionId: submission.id, answerCount: String(prompts.length),
        actorKind: 'external-capability',
      });
      return { submissionId: submission.id, submittedAt: submittedAt.toISOString() };
    }));
  }

  async review(projectId: string, requestId: string): Promise<CustomerResponseRequest> {
    await this.dataSource.transaction(async (manager) => {
      await requireActiveProject(manager, projectId, true);
      const request = await requireRequest(manager, projectId, requestId, true);
      const submission = await manager.getRepository(CustomerResponseSubmissionEntity).findOne({
        where: { requestId }, lock: { mode: 'pessimistic_write' },
      });
      if (!submission) throw new ConflictException('The Customer response has not been received yet.');
      if (!submission.reviewedAt) {
        submission.reviewedAt = new Date();
        const actorId = currentAuditActorId();
        submission.reviewedBy = actorId === systemAuditActorId ? null : actorId;
        await manager.getRepository(CustomerResponseSubmissionEntity).save(submission);
        await audit(manager, projectId, 'CUSTOMER_RESPONSE_REVIEWED', { requestId, submissionId: submission.id });
      }
    });
    return this.get(projectId, requestId);
  }

  async answerEvidence(projectId: string, requestId: string, answerId: string): Promise<Evidence> {
    return this.dataSource.transaction(async (manager) => {
      await requireActiveProject(manager, projectId, true);
      const rows = await manager.query(`
        SELECT answer."id", answer."answer", answer."created_at", prompt."text", submission."id" AS "submission_id"
        FROM "customer_response_answers" answer
        JOIN "customer_response_submissions" submission ON submission."id" = answer."submission_id"
        JOIN "customer_response_requests" request ON request."id" = submission."request_id"
        JOIN "customer_response_prompts" prompt ON prompt."id" = answer."prompt_id"
        WHERE answer."id" = $1 AND request."id" = $2 AND request."project_id" = $3
      `, [answerId, requestId, projectId]) as Array<{
        id: string; answer: string; created_at: Date; text: string; submission_id: string;
      }>;
      const answer = rows[0];
      if (!answer) throw new NotFoundException('Customer response answer not found.');
      const existing = await findResponseEvidence(manager, answerId);
      if (existing) return toEvidence(existing);
      const saved = await manager.getRepository(EvidenceEntity).save({
        id: randomUUID(), projectId, sourceKind: 'CUSTOMER_RESPONSE', title: answer.text,
        payload: {
          requestId, submissionId: answer.submission_id, responseAnswerId: answer.id,
          answer: answer.answer, submittedAt: answer.created_at.toISOString(),
        },
        roundId: null, snapshotId: null, attachmentId: null,
      });
      await audit(manager, projectId, 'CUSTOMER_RESPONSE_EVIDENCE_CREATED', {
        requestId, answerId, evidenceId: saved.id,
      });
      return toEvidence(saved);
    });
  }

  private async deliver(prepared: CustomerResponseRequestEntity): Promise<void> {
    if (!prepared.outboundCommunicationId) throw new ConflictException('The durable outbound communication record is missing.');
    const outbound = await this.dataSource.getRepository(CustomerOutboundCommunicationEntity)
      .findOneByOrFail({ id: prepared.outboundCommunicationId });
    let deliveryState: 'SENT' | 'FAILED' | 'UNKNOWN' = 'SENT';
    let result: 'ACCEPTED' | 'REJECTED' | 'UNKNOWN' = 'ACCEPTED';
    let messageReference: string | null = null;
    try {
      const submitted = await this.mailer.submit(immutableOutboundCustomerMessage({
        senderAddress: outbound.senderAddress,
        senderName: outbound.senderName,
        recipientAddress: outbound.recipientAddress,
        replyToAddress: outbound.replyToAddress,
        subject: outbound.subject,
        textContent: outbound.textContent,
        htmlContent: outbound.htmlContent,
      }));
      messageReference = submitted.messageReference;
      if (submitted.acceptance === 'REJECTED') {
        deliveryState = 'FAILED'; result = 'REJECTED';
      }
    } catch (error) {
      deliveryState = error instanceof CustomerMailBoundaryError && error.code !== 'OUTCOME_UNKNOWN' ? 'FAILED' : 'UNKNOWN';
      result = deliveryState === 'FAILED' ? 'REJECTED' : 'UNKNOWN';
    }
    await this.dataSource.transaction(async (manager) => {
      const request = await requireRequest(manager, prepared.projectId, prepared.id, true);
      if (request.deliveryState !== 'SENDING') throw new ConflictException('The delivery state changed while the request was being processed.');
      request.deliveryState = deliveryState;
      request.sentAt = deliveryState === 'SENT' ? new Date() : null;
      request.failureCode = deliveryState === 'SENT' ? null : deliveryState === 'FAILED' ? 'MAIL_SUBMISSION_FAILED' : 'SUBMISSION_RESULT_UNKNOWN';
      await manager.getRepository(CustomerResponseRequestEntity).save(request);
      await manager.getRepository(CustomerOutboundAttemptEntity).save({
        id: randomUUID(), outboundCommunicationId: prepared.outboundCommunicationId!, result,
        failureCode: request.failureCode, messageReference,
      });
      await audit(manager, prepared.projectId, `CUSTOMER_RESPONSE_REQUEST_${deliveryState}`, {
        requestId: prepared.id, deliveryState,
      });
    });
  }

  private async requireUsableByCapability(capability: string): Promise<{ request: CustomerResponseRequestEntity; project: Project }> {
    const request = await this.dataSource.getRepository(CustomerResponseRequestEntity)
      .findOneBy({ tokenDigest: sha256(capability) });
    const project = request ? await this.dataSource.getRepository(Project).findOneBy({ id: request.projectId }) : null;
    requireUsable(request, project);
    return { request: request!, project: project! };
  }

  private async toViews(rows: readonly CustomerResponseRequestEntity[]): Promise<CustomerResponseRequest[]> {
    if (rows.length === 0) return [];
    const requestIds = rows.map(({ id }) => id);
    const prompts = await this.dataSource.getRepository(CustomerResponsePromptEntity).find({
      where: { requestId: In(requestIds) }, order: { order: 'ASC' },
    });
    const submissions = await this.dataSource.getRepository(CustomerResponseSubmissionEntity).find({
      where: { requestId: In(requestIds) }, order: { submittedAt: 'ASC' },
    });
    const answers = submissions.length === 0 ? [] : await this.dataSource.getRepository(CustomerResponseAnswerEntity).find({
      where: { submissionId: In(submissions.map(({ id }) => id)) }, order: { order: 'ASC' },
    });
    const evidenceRows = answers.length === 0 ? [] : await this.dataSource.query(`
      SELECT "id", "payload"->>'responseAnswerId' AS "answer_id"
      FROM "evidence"
      WHERE "source_kind" = 'CUSTOMER_RESPONSE' AND "payload"->>'responseAnswerId' = ANY($1::text[])
    `, [answers.map(({ id }) => id)]) as Array<{ id: string; answer_id: string }>;
    const evidenceByAnswer = new Map(evidenceRows.map((item) => [item.answer_id, item.id]));
    const submissionByRequest = new Map(submissions.map((item) => [item.requestId, item]));
    return rows.map((row) => {
      const submission = submissionByRequest.get(row.id);
      return {
        id: row.id,
        projectId: row.projectId,
        state: row.state,
        deliveryState: row.deliveryState,
        recipientName: row.recipientName,
        recipientEmail: row.recipientEmail,
        subject: row.subject,
        prompts: prompts.filter((prompt) => prompt.requestId === row.id).map(toPrompt),
        expiresAt: row.expiresAt.toISOString(),
        revokedAt: row.revokedAt?.toISOString() ?? null,
        sentAt: row.sentAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        failureCode: row.failureCode,
        submission: submission ? {
          id: submission.id,
          submittedAt: submission.submittedAt.toISOString(),
          reviewedAt: submission.reviewedAt?.toISOString() ?? null,
          reviewedBy: submission.reviewedBy,
          answers: answers.filter((answer) => answer.submissionId === submission.id).map((answer) => ({
            id: answer.id,
            promptId: answer.promptId,
            order: answer.order,
            answer: answer.answer,
            evidenceId: evidenceByAnswer.get(answer.id) ?? null,
          })),
        } : null,
      };
    });
  }

  private publicOrigin(): string {
    const origin = this.config.get<string>('CUSTOMER_RESPONSE_ORIGIN')?.replace(/\/$/, '');
    if (!origin || !/^https?:\/\/[^/]+$/.test(origin)) {
      throw new ConflictException('The public Customer response form is not configured.');
    }
    return origin;
  }

  private previewSecret(): string {
    const secret = this.config.get<string>('CUSTOMER_RESPONSE_PREVIEW_SECRET') ?? '';
    if (secret.length < 32) throw new ConflictException('The Customer clarification preview signing key is not configured.');
    return secret;
  }

  private rateLimit(key: string): void {
    const now = Date.now();
    const current = this.rateWindows.get(key);
    if (!current || now - current.startedAt >= 60_000) {
      this.rateWindows.set(key, { count: 1, startedAt: now });
      return;
    }
    current.count += 1;
    if (current.count > 30) throw new HttpException(unavailableMessage, HttpStatus.TOO_MANY_REQUESTS);
  }
}

function senderFields(sender: { name: string; address: string }): { senderName: string; senderAddress: string } {
  return { senderName: sender.name, senderAddress: sender.address };
}

function renderRequest(payload: PreviewPayload, capability: string) {
  const responseUrl = `${payload.publicOrigin}/respond#${capability}`;
  const promptText = payload.prompts.map((prompt, index) => `${index + 1}. ${prompt.topic}: ${prompt.text}`).join('\n');
  const subject = `${payload.projectName} – clarification request`;
  const textContent = [
    `Dear ${payload.recipientName},`, '',
    `Please provide the following clarifications for the ${payload.projectName} Project:`, '',
    promptText, '',
    `Open the response form: ${responseUrl}`, '',
    `This link remains valid until ${new Date(payload.requestExpiresAt).toLocaleDateString('en-GB')}.`,
  ].join('\n');
  const htmlContent = `<p>Dear ${escapeHtml(payload.recipientName)},</p><p>Please provide the following clarifications for the <strong>${escapeHtml(payload.projectName)}</strong> Project:</p><ol>${payload.prompts.map((prompt) => `<li><strong>${escapeHtml(prompt.topic)}</strong>: ${escapeHtml(prompt.text)}</li>`).join('')}</ol><p><a href="${escapeHtml(responseUrl)}">Open the response form</a></p><p>This link remains valid until ${escapeHtml(new Date(payload.requestExpiresAt).toLocaleDateString('en-GB'))}.</p>`;
  return { subject, textContent, htmlContent };
}

function encodePreview(payload: PreviewPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function decodePreview(token: string, secret: string): PreviewPayload {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new BadRequestException('Invalid preview.');
  const expected = createHmac('sha256', secret).update(body).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, 'base64url'); } catch { throw new BadRequestException('Invalid preview.'); }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new BadRequestException('Invalid preview.');
  }
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as PreviewPayload; }
  catch { throw new BadRequestException('Invalid preview.'); }
}

async function requireProject(manager: EntityManager, projectId: string, lock = false): Promise<Project> {
  const project = await manager.getRepository(Project).findOne({
    where: { id: projectId }, lock: lock ? { mode: 'pessimistic_write' } : undefined,
  });
  if (!project) throw new NotFoundException('Project not found.');
  return project;
}

async function requireActiveProject(manager: EntityManager, projectId: string, lock = false): Promise<Project> {
  const project = await requireProject(manager, projectId, lock);
  if (project.status === 'ARCHIVED') throw new ConflictException('Archived projects are read-only.');
  return project;
}

async function requireRequest(manager: EntityManager, projectId: string, id: string, lock: boolean) {
  const request = await manager.getRepository(CustomerResponseRequestEntity).findOne({
    where: { id, projectId }, lock: lock ? { mode: 'pessimistic_write' } : undefined,
  });
  if (!request) throw new NotFoundException('Customer response request not found.');
  return request;
}

function requireUsable(request: CustomerResponseRequestEntity | null, project: Project | null): void {
  if (!request || !project || project.status === 'ARCHIVED' || request.state !== 'OPEN' ||
      request.deliveryState !== 'SENT' || request.expiresAt.getTime() <= Date.now()) {
    throw unavailable();
  }
}

function unavailable(): NotFoundException {
  return new NotFoundException(unavailableMessage);
}

function promptKey(kind: string, id: string): string { return `${kind}:${id}`; }
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex'); }
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
}
function toPrompt(row: CustomerResponsePromptEntity) {
  return {
    id: row.id, order: row.order, sourceKind: row.sourceKind, sourceId: row.sourceId,
    sourceVersion: row.sourceVersion, topic: row.topic, text: row.text,
  };
}
async function audit(manager: EntityManager, projectId: string, eventType: string, payload: Record<string, string>): Promise<void> {
  await manager.getRepository(AuditEvent).save({ id: randomUUID(), projectId, eventType, payload });
}
async function findResponseEvidence(manager: EntityManager, answerId: string): Promise<EvidenceEntity | null> {
  const rows = await manager.query(`SELECT "id" FROM "evidence" WHERE "source_kind" = 'CUSTOMER_RESPONSE' AND "payload"->>'responseAnswerId' = $1 LIMIT 1`, [answerId]) as Array<{ id: string }>;
  return rows[0] ? manager.getRepository(EvidenceEntity).findOneBy({ id: rows[0].id }) : null;
}
function toEvidence(row: EvidenceEntity): Evidence {
  return { id: row.id, projectId: row.projectId, kind: row.sourceKind, title: row.title, payload: row.payload, createdAt: row.createdAt.toISOString() };
}
