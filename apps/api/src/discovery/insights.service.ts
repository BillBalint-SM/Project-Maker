import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Evidence, Insight } from '@project-maker/contracts';
import { DataSource, In, type EntityManager } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { CreateInsightDto } from './dto/create-insight.dto';
import { EvidenceSourceDto } from './dto/evidence-source.dto';
import { UpdateInsightDto } from './dto/update-insight.dto';
import { EvidenceEntity } from './evidence.entity';
import { GovernedAttachmentEntity } from './governed-attachment.entity';
import { InsightEvidenceEntity } from './insight-evidence.entity';
import { InsightEntity } from './insight.entity';

@Injectable()
export class InsightsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(projectId: string): Promise<readonly Insight[]> {
    await requireProject(this.dataSource.manager, projectId, false);
    const insights = await this.dataSource.manager.getRepository(InsightEntity).find({
      where: { projectId },
      order: { updatedAt: 'DESC', id: 'ASC' },
    });
    return loadInsights(this.dataSource.manager, insights);
  }

  async create(projectId: string, input: CreateInsightDto): Promise<Insight> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const existing = await loadExistingEvidence(manager, projectId, input.evidenceIds ?? []);
      const created: EvidenceEntity[] = [];
      for (const source of input.sources ?? []) {
        created.push(await createEvidence(manager, projectId, source));
      }
      const evidence = uniqueEvidence([...existing, ...created]);
      if (evidence.length === 0) {
        throw new BadRequestException('An Insight requires at least one Evidence source.');
      }
      const insight = manager.getRepository(InsightEntity).create({
        id: randomUUID(),
        projectId,
        statement: required(input.statement, 'statement'),
        version: 1,
      });
      const saved = await manager.getRepository(InsightEntity).save(insight);
      await replaceLinks(manager, saved.id, evidence.map((item) => item.id));
      await audit(manager, projectId, 'INSIGHT_CREATED', {
        insightId: saved.id,
        version: '1',
        evidenceCount: String(evidence.length),
      });
      return toInsight(saved, evidence);
    });
  }

  async update(projectId: string, insightId: string, input: UpdateInsightDto): Promise<Insight> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const insight = await manager.getRepository(InsightEntity).findOne({
        where: { id: insightId, projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!insight) throw new NotFoundException('Insight not found.');
      if (insight.version !== input.expectedVersion) {
        throw new ConflictException('Insight has changed; reload it before saving.');
      }
      const evidence = await loadExistingEvidence(manager, projectId, input.evidenceIds);
      if (evidence.length === 0) {
        throw new BadRequestException('An Insight requires at least one Evidence source.');
      }
      insight.statement = required(input.statement, 'statement');
      insight.version += 1;
      const saved = await manager.getRepository(InsightEntity).save(insight);
      await replaceLinks(manager, saved.id, evidence.map((item) => item.id));
      await audit(manager, projectId, 'INSIGHT_UPDATED', {
        insightId,
        version: String(saved.version),
        evidenceCount: String(evidence.length),
      });
      return toInsight(saved, evidence);
    });
  }

  async deleteEvidence(projectId: string, evidenceId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const evidence = await manager.getRepository(EvidenceEntity).findOneBy({ id: evidenceId, projectId });
      if (!evidence) throw new NotFoundException('Evidence not found.');
      if (evidence.sourceKind === 'CUSTOMER_RESPONSE') {
        throw new ConflictException('Submitted Customer response Evidence is retained.');
      }
      if (await manager.getRepository(InsightEvidenceEntity).existsBy({ evidenceId })) {
        throw new ConflictException('Evidence is retained by an Insight.');
      }
      await manager.getRepository(EvidenceEntity).remove(evidence);
      await audit(manager, projectId, 'EVIDENCE_DELETED', { evidenceId });
    });
  }
}

async function createEvidence(
  manager: EntityManager,
  projectId: string,
  source: EvidenceSourceDto,
): Promise<EvidenceEntity> {
  const normalized = await normalizeEvidenceSource(manager, projectId, source);
  const evidence = manager.getRepository(EvidenceEntity).create({
    id: randomUUID(),
    projectId,
    sourceKind: source.kind,
    title: normalized.title,
    payload: normalized.payload,
    roundId: normalized.roundId,
    snapshotId: normalized.snapshotId,
    attachmentId: normalized.attachmentId,
  });
  return manager.getRepository(EvidenceEntity).save(evidence);
}

async function normalizeEvidenceSource(
  manager: EntityManager,
  projectId: string,
  source: EvidenceSourceDto,
): Promise<Pick<EvidenceEntity, 'title' | 'payload' | 'roundId' | 'snapshotId' | 'attachmentId'>> {
  if (source.kind === 'ROUND_ANSWER') {
    if (!source.roundId || !source.snapshotId) {
      throw new BadRequestException('Round answer Evidence requires roundId and snapshotId.');
    }
    const rows = await manager.query(`
      SELECT snapshot."text", answer."value", answer."answered_at"
      FROM "round_question_snapshots" snapshot
      JOIN "interview_rounds" round ON round."id" = snapshot."round_id"
      JOIN "round_answers" answer
        ON answer."round_id" = round."id" AND answer."snapshot_id" = snapshot."id"
      WHERE round."id" = $1 AND snapshot."id" = $2 AND round."project_id" = $3
    `, [source.roundId, source.snapshotId, projectId]) as Array<{
      text: string;
      value: unknown;
      answered_at: Date;
    }>;
    const answer = rows[0];
    if (!answer) throw new NotFoundException('Saved Project round answer not found.');
    return {
      title: optional(source.title) ?? answer.text,
      payload: {
        roundId: source.roundId,
        snapshotId: source.snapshotId,
        question: answer.text,
        answer: answer.value,
        answeredAt: answer.answered_at.toISOString(),
      },
      roundId: source.roundId,
      snapshotId: source.snapshotId,
      attachmentId: null,
    };
  }
  if (source.kind === 'HTTPS_LINK') {
    if (!source.url) throw new BadRequestException('HTTPS link Evidence requires url.');
    const url = new URL(source.url);
    if (url.protocol !== 'https:') throw new BadRequestException('Evidence links must use HTTPS.');
    return {
      title: optional(source.title) ?? url.hostname,
      payload: { url: url.toString() },
      roundId: null,
      snapshotId: null,
      attachmentId: null,
    };
  }
  if (source.kind === 'METRIC') {
    const metricName = optional(source.metricName);
    const metricValue = optional(source.metricValue);
    if (!metricName || !metricValue) {
      throw new BadRequestException('Metric Evidence requires metricName and metricValue.');
    }
    return {
      title: optional(source.title) ?? metricName,
      payload: { metricName, metricValue, metricUnit: optional(source.metricUnit) },
      roundId: null,
      snapshotId: null,
      attachmentId: null,
    };
  }
  if (source.kind === 'ATTACHMENT') {
    if (!source.attachmentId) throw new BadRequestException('Attachment Evidence requires attachmentId.');
    const attachment = await manager.getRepository(GovernedAttachmentEntity).findOneBy({
      id: source.attachmentId,
      projectId,
    });
    if (!attachment) throw new NotFoundException('Project attachment not found.');
    return {
      title: optional(source.title) ?? attachment.originalName,
      payload: {
        attachmentId: attachment.id,
        originalName: attachment.originalName,
        contentType: attachment.contentType,
        sha256: attachment.sha256,
      },
      roundId: null,
      snapshotId: null,
      attachmentId: attachment.id,
    };
  }
  if (source.kind === 'CUSTOMER_RESPONSE') {
    if (!source.responseAnswerId) {
      throw new BadRequestException('Customer response Evidence requires responseAnswerId.');
    }
    const rows = await manager.query(`
      SELECT answer."id", answer."answer", answer."created_at", prompt."text",
             submission."id" AS "submission_id", request."id" AS "request_id"
      FROM "customer_response_answers" answer
      JOIN "customer_response_submissions" submission ON submission."id" = answer."submission_id"
      JOIN "customer_response_requests" request ON request."id" = submission."request_id"
      JOIN "customer_response_prompts" prompt ON prompt."id" = answer."prompt_id"
      WHERE answer."id" = $1 AND request."project_id" = $2
    `, [source.responseAnswerId, projectId]) as Array<{
      id: string; answer: string; created_at: Date; text: string; submission_id: string; request_id: string;
    }>;
    const response = rows[0];
    if (!response) throw new NotFoundException('Project Customer response answer not found.');
    return {
      title: optional(source.title) ?? response.text,
      payload: {
        requestId: response.request_id,
        submissionId: response.submission_id,
        responseAnswerId: response.id,
        answer: response.answer,
        submittedAt: response.created_at.toISOString(),
      },
      roundId: null,
      snapshotId: null,
      attachmentId: null,
    };
  }
  if (!source.correspondenceId || !source.excerpt) {
    throw new BadRequestException('Customer message Evidence requires correspondenceId and excerpt.');
  }
  const excerpt = required(source.excerpt, 'excerpt');
  const rows = await manager.query(`
    SELECT "id", "visible_text", "received_at"
    FROM "customer_inbound_messages"
    WHERE "id" = $1 AND "project_id" = $2
  `, [source.correspondenceId, projectId]) as Array<{
    id: string;
    visible_text: string;
    received_at: Date;
  }>;
  const message = rows[0];
  if (!message || !message.visible_text.includes(excerpt)) {
    throw new NotFoundException('Project Customer message excerpt not found.');
  }
  return {
    title: optional(source.title) ?? 'Ügyfélüzenet-részlet',
    payload: {
      messageId: message.id,
      excerpt,
      receivedAt: message.received_at.toISOString(),
    },
    roundId: null,
    snapshotId: null,
    attachmentId: null,
  };
}

async function loadExistingEvidence(
  manager: EntityManager,
  projectId: string,
  evidenceIds: readonly string[],
): Promise<EvidenceEntity[]> {
  const ids = [...new Set(evidenceIds)];
  if (ids.length === 0) return [];
  const evidence = await manager.getRepository(EvidenceEntity).find({
    where: { id: In(ids), projectId },
  });
  if (evidence.length !== ids.length) throw new BadRequestException('Evidence must belong to the Project.');
  const byId = new Map(evidence.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)!);
}

function uniqueEvidence(evidence: readonly EvidenceEntity[]): EvidenceEntity[] {
  return [...new Map(evidence.map((item) => [item.id, item])).values()];
}

async function replaceLinks(manager: EntityManager, insightId: string, evidenceIds: readonly string[]): Promise<void> {
  const repository = manager.getRepository(InsightEvidenceEntity);
  await repository.delete({ insightId });
  await repository.save(evidenceIds.map((evidenceId, index) => repository.create({
    insightId,
    evidenceId,
    order: index + 1,
  })));
}

async function loadInsights(manager: EntityManager, insights: readonly InsightEntity[]): Promise<Insight[]> {
  if (insights.length === 0) return [];
  const links = await manager.getRepository(InsightEvidenceEntity).find({
    where: { insightId: In(insights.map((insight) => insight.id)) },
    order: { insightId: 'ASC', order: 'ASC' },
  });
  const evidence = links.length === 0 ? [] : await manager.getRepository(EvidenceEntity).findBy({
    id: In(links.map((link) => link.evidenceId)),
  });
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  return insights.map((insight) => toInsight(
    insight,
    links.filter((link) => link.insightId === insight.id).map((link) => evidenceById.get(link.evidenceId)!),
  ));
}

function toInsight(insight: InsightEntity, evidence: readonly EvidenceEntity[]): Insight {
  return {
    id: insight.id,
    projectId: insight.projectId,
    statement: insight.statement,
    version: insight.version,
    evidence: evidence.map(toEvidence),
    createdAt: insight.createdAt.toISOString(),
    updatedAt: insight.updatedAt.toISOString(),
  };
}

function toEvidence(evidence: EvidenceEntity): Evidence {
  return {
    id: evidence.id,
    projectId: evidence.projectId,
    kind: evidence.sourceKind,
    title: evidence.title,
    payload: evidence.payload,
    createdAt: evidence.createdAt.toISOString(),
  };
}

async function requireProject(manager: EntityManager, projectId: string, mutable: boolean): Promise<void> {
  const project = await manager.getRepository(Project).findOneBy({ id: projectId });
  if (!project) throw new NotFoundException('Project not found.');
  if (mutable && project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot change discovery evidence.');
  }
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException(`${field} must not be blank.`);
  return normalized;
}

function optional(value: string | undefined): string | null {
  return value === undefined ? null : value.trim() || null;
}

async function audit(
  manager: EntityManager,
  projectId: string,
  eventType: string,
  payload: Readonly<Record<string, string>>,
): Promise<void> {
  await manager.getRepository(AuditEvent).save({ id: randomUUID(), projectId, eventType, payload });
}
