import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ProjectSchemaQuestionInput,
  QuestionTemplateProjectAssignment,
  QuestionTemplateSummary,
} from '@project-maker/contracts';
import { EntityManager, In, QueryFailedError } from 'typeorm';
import { DataSource } from 'typeorm';

import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from './base-question.entity';
import type { SaveQuestionTemplateDraftDto } from './dto/save-question-template-draft.dto';
import { ProjectQuestionSchemaEntity } from './project-question-schema.entity';
import { QuestionTemplateEntity, QuestionTemplateVersionEntity } from './question-template.entity';

export interface PublishedQuestionTemplate {
  readonly template: QuestionTemplateEntity;
  readonly version: QuestionTemplateVersionEntity;
}

@Injectable()
export class QuestionTemplateService {
  constructor(private readonly dataSource: DataSource) {}

  async list(): Promise<readonly QuestionTemplateSummary[]> {
    const manager = this.dataSource.manager;
    const templates = await manager.getRepository(QuestionTemplateEntity).find({
      order: { name: 'ASC', id: 'ASC' },
    });
    const versions = await manager.getRepository(QuestionTemplateVersionEntity).find({
      order: { templateId: 'ASC', version: 'DESC' },
    });
    const latestVersions = new Map<string, QuestionTemplateVersionEntity>();
    for (const version of versions) {
      if (!latestVersions.has(version.templateId)) latestVersions.set(version.templateId, version);
    }
    const activeKeys = await loadLatestActiveQuestionKeys(manager);
    const assignments = await loadCurrentAssignments(manager);
    return templates.map((template) =>
      toSummary(
        template,
        latestVersions.get(template.id) ?? null,
        activeKeys,
        assignments.get(template.id) ?? [],
      ),
    );
  }

  async create(input: SaveQuestionTemplateDraftDto): Promise<QuestionTemplateSummary> {
    const template = this.dataSource.getRepository(QuestionTemplateEntity).create({
      id: randomUUID(),
      name: requireName(input.name),
      draftQuestions: normalizeSelections(input.questions),
    });
    try {
      const saved = await this.dataSource.getRepository(QuestionTemplateEntity).save(template);
      return toSummary(saved, null, await loadLatestActiveQuestionKeys(this.dataSource.manager), []);
    } catch (error) {
      throw mapWriteError(error);
    }
  }

  async updateDraft(
    templateId: string,
    input: SaveQuestionTemplateDraftDto,
  ): Promise<QuestionTemplateSummary> {
    const template = await this.findTemplate(templateId);
    template.name = requireName(input.name);
    template.draftQuestions = normalizeSelections(input.questions);
    try {
      const saved = await this.dataSource.getRepository(QuestionTemplateEntity).save(template);
      const latest = await this.latestVersion(templateId, this.dataSource.manager);
      return toSummary(
        saved,
        latest,
        await loadLatestActiveQuestionKeys(this.dataSource.manager),
        (await loadCurrentAssignments(this.dataSource.manager)).get(templateId) ?? [],
      );
    } catch (error) {
      throw mapWriteError(error);
    }
  }

  async publish(templateId: string): Promise<QuestionTemplateSummary> {
    return this.dataSource.transaction(async (manager) => {
      const template = await manager.getRepository(QuestionTemplateEntity).findOne({
        where: { id: templateId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!template) throw new NotFoundException('Question Template not found.');
      const activeKeys = await loadLatestActiveQuestionKeys(manager);
      requireAvailableSelections(template.draftQuestions, activeKeys);
      const previous = await this.latestVersion(templateId, manager);
      const version = manager.getRepository(QuestionTemplateVersionEntity).create({
        id: randomUUID(),
        templateId,
        version: (previous?.version ?? 0) + 1,
        name: template.name,
        questions: template.draftQuestions,
        publishedAt: new Date(),
      });
      await manager.getRepository(QuestionTemplateVersionEntity).save(version);
      return toSummary(
        template,
        version,
        activeKeys,
        (await loadCurrentAssignments(manager)).get(templateId) ?? [],
      );
    });
  }

  async requireLatestPublished(
    templateId: string,
    manager: EntityManager,
  ): Promise<PublishedQuestionTemplate> {
    const template = await manager.getRepository(QuestionTemplateEntity).findOneBy({ id: templateId });
    if (!template) throw new NotFoundException('Question Template not found.');
    const version = await this.latestVersion(templateId, manager);
    if (!version) throw new ConflictException('The selected Question Template has no published version.');
    requireAvailableSelections(version.questions, await loadLatestActiveQuestionKeys(manager));
    return { template, version };
  }

  private async findTemplate(templateId: string): Promise<QuestionTemplateEntity> {
    const template = await this.dataSource.getRepository(QuestionTemplateEntity).findOneBy({ id: templateId });
    if (!template) throw new NotFoundException('Question Template not found.');
    return template;
  }

  private latestVersion(
    templateId: string,
    manager: EntityManager,
  ): Promise<QuestionTemplateVersionEntity | null> {
    return manager.getRepository(QuestionTemplateVersionEntity).findOne({
      where: { templateId },
      order: { version: 'DESC' },
    });
  }
}

function requireName(value: string): string {
  const name = value.trim();
  if (!name) throw new BadRequestException('Question Template name must not be blank.');
  return name;
}

function normalizeSelections(
  questions: readonly ProjectSchemaQuestionInput[],
): ProjectSchemaQuestionInput[] {
  if (questions.length === 0) throw new BadRequestException('Select at least one Question Bank question.');
  const keys = questions.map((question) => question.stableKey);
  if (new Set(keys).size !== keys.length) {
    throw new BadRequestException('Question Template contains duplicate stable keys.');
  }
  return questions.map((question) => ({
    stableKey: question.stableKey,
    ...(question.required === undefined ? {} : { required: question.required }),
    ...(question.blocking === undefined ? {} : { blocking: question.blocking }),
  }));
}

async function loadLatestActiveQuestionKeys(manager: EntityManager): Promise<ReadonlySet<string>> {
  const latest = await manager
    .getRepository(BaseQuestionEntity)
    .createQueryBuilder('question')
    .select('MAX(question.bankVersion)', 'version')
    .getRawOne<{ version: string | null }>();
  const version = Number(latest?.version);
  if (!Number.isInteger(version) || version < 1) return new Set();
  const questions = await manager.getRepository(BaseQuestionEntity).find({
    where: { bankVersion: version, active: true },
  });
  return new Set(questions.map((question) => question.stableKey));
}

function requireAvailableSelections(
  questions: readonly ProjectSchemaQuestionInput[],
  activeKeys: ReadonlySet<string>,
): void {
  const unavailable = questions.filter((question) => !activeKeys.has(question.stableKey));
  if (unavailable.length > 0) {
    throw new ConflictException(
      `Question Template references missing or inactive questions: ${unavailable.map((question) => question.stableKey).join(', ')}.`,
    );
  }
}

async function loadCurrentAssignments(
  manager: EntityManager,
): Promise<ReadonlyMap<string, readonly QuestionTemplateProjectAssignment[]>> {
  const schemas = await manager.getRepository(ProjectQuestionSchemaEntity).find({
    order: { projectId: 'ASC', schemaVersion: 'DESC' },
  });
  const latestByProject = new Map<string, ProjectQuestionSchemaEntity>();
  for (const schema of schemas) {
    if (!latestByProject.has(schema.projectId)) latestByProject.set(schema.projectId, schema);
  }
  const assignedSchemas = [...latestByProject.values()].filter(
    (schema) => schema.questionTemplateId !== null,
  );
  const projects = assignedSchemas.length > 0
    ? await manager.getRepository(Project).findBy({ id: In(assignedSchemas.map((schema) => schema.projectId)) })
    : [];
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const assignments = new Map<string, QuestionTemplateProjectAssignment[]>();
  for (const schema of assignedSchemas) {
    const templateId = schema.questionTemplateId!;
    const current = assignments.get(templateId) ?? [];
    current.push({
      projectId: schema.projectId,
      projectName: projectNames.get(schema.projectId) ?? 'Unknown Project',
      schemaVersion: schema.schemaVersion,
    });
    assignments.set(templateId, current);
  }
  return assignments;
}

function toSummary(
  template: QuestionTemplateEntity,
  latest: QuestionTemplateVersionEntity | null,
  activeKeys: ReadonlySet<string>,
  assignedProjects: readonly QuestionTemplateProjectAssignment[],
): QuestionTemplateSummary {
  const matchesLatest = latest !== null &&
    latest.name === template.name &&
    JSON.stringify(latest.questions) === JSON.stringify(template.draftQuestions);
  return {
    id: template.id,
    name: template.name,
    draftQuestions: template.draftQuestions,
    latestPublishedVersion: latest?.version ?? null,
    latestPublishedQuestions: latest?.questions ?? null,
    state: latest === null ? 'DRAFT' : matchesLatest ? 'PUBLISHED' : 'CHANGES_PENDING',
    unavailableQuestionCount: template.draftQuestions.filter(
      (question) => !activeKeys.has(question.stableKey),
    ).length,
    assignedProjects,
    updatedAt: template.updatedAt.toISOString(),
  };
}

function mapWriteError(error: unknown): unknown {
  if (error instanceof QueryFailedError &&
      (error.driverError as { readonly code?: string }).code === '23505') {
    return new ConflictException('A Question Template with this name already exists.');
  }
  return error;
}
