import { createHash, randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  BaseQuestion,
  BaseQuestionBank,
  BaseQuestionType,
  ProjectQuestionSchema,
  ProjectSchemaQuestion,
  QuestionReferenceFile,
} from '@project-maker/contracts';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

import {
  resolveAttachmentLimitBytes,
  validateAttachmentFile,
  type UploadedAttachmentFile,
} from '../attachments/attachment-file-policy';
import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from './base-question.entity';
import { CreateBaseQuestionDto } from './dto/create-base-question.dto';
import { PublishProjectQuestionSchemaDto } from './dto/publish-project-question-schema.dto';
import { UpdateBaseQuestionDto } from './dto/update-base-question.dto';
import { ProjectQuestionSchemaEntity } from './project-question-schema.entity';
import { ProjectSchemaQuestionEntity } from './project-schema-question.entity';
import { QuestionReferenceFileContentEntity } from './question-reference-file-content.entity';
import { QuestionReferenceFileEntity } from './question-reference-file.entity';
import { loadQuestionReferenceFiles } from './question-reference-file-projection';

@Injectable()
export class QuestionBankService {
  private readonly maxAttachmentBytes: number;

  constructor(
    @InjectRepository(BaseQuestionEntity)
    private readonly baseQuestionRepository: Repository<BaseQuestionEntity>,
    private readonly dataSource: DataSource,
    config: ConfigService,
  ) {
    this.maxAttachmentBytes = resolveAttachmentLimitBytes(
      config.get<string>('ATTACHMENT_MAX_MIB'),
    );
  }

  async getBaseQuestions(): Promise<BaseQuestionBank> {
    const version = await findLatestBankVersion(this.baseQuestionRepository.manager);
    return loadBaseQuestionBank(this.baseQuestionRepository.manager, version);
  }

  async createBaseQuestion(input: CreateBaseQuestionDto): Promise<BaseQuestionBank> {
    return this.dataSource.transaction(async (manager) => {
      await lockBankPublishing(manager);
      const currentVersion = await findLatestBankVersion(manager);
      const currentQuestions = await loadBankEntities(manager, currentVersion);
      const newQuestion = normalizeQuestion({
        id: randomUUID(),
        stableKey: input.stableKey,
        bankVersion: currentVersion + 1,
        topic: input.topic,
        controlPoint: input.controlPoint,
        text: input.text,
        type: input.type,
        required: input.required,
        requiredForEstimate: input.requiredForEstimate,
        blocking: input.blocking,
        order: input.order,
        active: input.active,
        hint: input.hint ?? null,
        options: input.options ?? null,
        source: 'SETTINGS_API',
        publishedAt: new Date(),
      });

      if (currentQuestions.some((question) => question.stableKey === newQuestion.stableKey)) {
        throw new ConflictException('A base question with this stable key already exists.');
      }
      if (newQuestion.order > currentQuestions.length + 1) {
        throw new BadRequestException(
          'New base question order must be within the published bank sequence.',
        );
      }

      const nextQuestions = copyBankRevision(currentQuestions, currentVersion + 1).map(
        (question) => {
          if (question.order >= newQuestion.order) {
            question.order += 1;
          }
          return question;
        },
      );
      nextQuestions.push(newQuestion);
      validateBankRevision(nextQuestions);
      await manager.getRepository(BaseQuestionEntity).save(nextQuestions);
      await copyReferenceFiles(manager, currentQuestions, nextQuestions);
      return loadBaseQuestionBank(manager, currentVersion + 1);
    });
  }

  async updateBaseQuestion(input: UpdateBaseQuestionDto): Promise<BaseQuestionBank> {
    if (Object.keys(input).every((field) => field === 'id')) {
      throw new BadRequestException('Base question update must include at least one editable field.');
    }

    return this.dataSource.transaction(async (manager) => {
      await lockBankPublishing(manager);
      const currentVersion = await findLatestBankVersion(manager);
      const currentQuestions = await loadBankEntities(manager, currentVersion);
      const target = currentQuestions.find((question) => question.id === input.id);
      if (!target) {
        const historicalQuestion = await manager
          .getRepository(BaseQuestionEntity)
          .findOneBy({ id: input.id });
        if (historicalQuestion) {
          throw new ConflictException(
            'Base question updates must target the latest published bank version.',
          );
        }
        throw new NotFoundException('Base question not found.');
      }

      const nextVersion = currentVersion + 1;
      const orderedQuestions = [...currentQuestions];
      if (input.order !== undefined) {
        if (input.order > currentQuestions.length) {
          throw new BadRequestException(
            'Base question order must be within the published bank sequence.',
          );
        }
        const currentIndex = orderedQuestions.findIndex((question) => question.id === target.id);
        orderedQuestions.splice(currentIndex, 1);
        orderedQuestions.splice(input.order - 1, 0, target);
      }
      const publishedAt = new Date();
      const nextQuestions = orderedQuestions.map((question, index) => {
        const revision = {
          ...question,
          id: randomUUID(),
          bankVersion: nextVersion,
          source: 'SETTINGS_API' as const,
          publishedAt,
          order: index + 1,
        };
        if (question.id !== input.id) {
          return normalizeQuestion(revision);
        }
        return normalizeQuestion({
          ...revision,
          topic: input.topic ?? question.topic,
          controlPoint: input.controlPoint ?? question.controlPoint,
          text: input.text ?? question.text,
          type: input.type ?? question.type,
          required: input.required ?? question.required,
          requiredForEstimate: input.requiredForEstimate ?? question.requiredForEstimate,
          blocking: input.blocking ?? question.blocking,
          active: input.active ?? question.active,
          hint: Object.prototype.hasOwnProperty.call(input, 'hint')
            ? input.hint ?? null
            : question.hint,
          options: Object.prototype.hasOwnProperty.call(input, 'options')
            ? input.options ?? null
            : question.options,
        });
      });
      validateBankRevision(nextQuestions);
      await manager.getRepository(BaseQuestionEntity).save(nextQuestions);
      await copyReferenceFiles(manager, currentQuestions, nextQuestions);
      return loadBaseQuestionBank(manager, nextVersion);
    });
  }

  async addReferenceFile(
    questionId: string,
    file: UploadedAttachmentFile | undefined,
  ): Promise<BaseQuestionBank> {
    if (!file) throw new BadRequestException('One reference file is required.');
    const validatedFile = validateAttachmentFile(file, this.maxAttachmentBytes);
    return this.dataSource.transaction(async (manager) => {
      await lockBankPublishing(manager);
      const currentVersion = await findLatestBankVersion(manager);
      const currentQuestions = await loadBankEntities(manager, currentVersion);
      const target = await requireLatestQuestion(manager, currentQuestions, questionId);
      const nextQuestions = copyBankRevision(currentQuestions, currentVersion + 1);
      validateBankRevision(nextQuestions);
      await manager.getRepository(BaseQuestionEntity).save(nextQuestions);
      await copyReferenceFiles(manager, currentQuestions, nextQuestions);

      const content = manager.getRepository(QuestionReferenceFileContentEntity).create({
        id: randomUUID(),
        originalName: validatedFile.originalName,
        contentType: validatedFile.mimetype,
        sizeBytes: validatedFile.size,
        sha256: createHash('sha256').update(validatedFile.buffer).digest('hex'),
        content: validatedFile.buffer,
      });
      const savedContent = await manager
        .getRepository(QuestionReferenceFileContentEntity)
        .save(content);
      const nextTarget = nextQuestions.find(
        (question) => question.stableKey === target.stableKey,
      );
      if (!nextTarget) {
        throw new InternalServerErrorException('Published Question Bank successor is incomplete.');
      }
      await manager.getRepository(QuestionReferenceFileEntity).save({
        questionId: nextTarget.id,
        fileId: savedContent.id,
      });
      return loadBaseQuestionBank(manager, currentVersion + 1);
    });
  }

  async removeReferenceFile(
    questionId: string,
    fileId: string,
  ): Promise<BaseQuestionBank> {
    return this.dataSource.transaction(async (manager) => {
      await lockBankPublishing(manager);
      const currentVersion = await findLatestBankVersion(manager);
      const currentQuestions = await loadBankEntities(manager, currentVersion);
      await requireLatestQuestion(manager, currentQuestions, questionId);
      if (!await manager.getRepository(QuestionReferenceFileEntity).existsBy({
        questionId,
        fileId,
      })) {
        throw new NotFoundException('Question Bank reference file not found.');
      }
      const nextQuestions = copyBankRevision(currentQuestions, currentVersion + 1);
      validateBankRevision(nextQuestions);
      await manager.getRepository(BaseQuestionEntity).save(nextQuestions);
      await copyReferenceFiles(manager, currentQuestions, nextQuestions, {
        questionId,
        fileId,
      });
      return loadBaseQuestionBank(manager, currentVersion + 1);
    });
  }

  async downloadReferenceFile(
    questionId: string,
    fileId: string,
  ): Promise<QuestionReferenceFileContentEntity> {
    if (!await this.dataSource.manager.getRepository(QuestionReferenceFileEntity).existsBy({
      questionId,
      fileId,
    })) {
      throw new NotFoundException('Question Bank reference file not found.');
    }
    const content = await this.dataSource.manager
      .getRepository(QuestionReferenceFileContentEntity)
      .createQueryBuilder('referenceFile')
      .addSelect('referenceFile.content')
      .where('referenceFile.id = :fileId', { fileId })
      .getOne();
    if (!content) {
      throw new InternalServerErrorException('Stored Question Bank reference file is incomplete.');
    }
    return content;
  }

  async getProjectSchema(projectId: string): Promise<ProjectQuestionSchema | null> {
    await requireProject(this.dataSource.manager, projectId, false);
    const schema = await findLatestProjectSchema(this.dataSource.manager, projectId);
    if (!schema) return null;
    return loadProjectSchema(this.dataSource.manager, schema);
  }

  async createProjectSchema(
    projectId: string,
    input: PublishProjectQuestionSchemaDto,
  ): Promise<ProjectQuestionSchema> {
    return this.publishProjectSchema(projectId, input, false);
  }

  async updateProjectSchema(
    projectId: string,
    input: PublishProjectQuestionSchemaDto,
  ): Promise<ProjectQuestionSchema> {
    return this.publishProjectSchema(projectId, input, true);
  }

  private async publishProjectSchema(
    projectId: string,
    input: PublishProjectQuestionSchemaDto,
    requireExisting: boolean,
  ): Promise<ProjectQuestionSchema> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const previousSchema = await findLatestProjectSchema(manager, projectId);
      if (requireExisting && !previousSchema) {
        throw new NotFoundException('Project question schema not found.');
      }
      if (!requireExisting && previousSchema) {
        throw new ConflictException(
          'Project question schema already exists; publish a successor with PATCH.',
        );
      }

      const stableKeys = input.questions.map((question) => question.stableKey);
      if (new Set(stableKeys).size !== stableKeys.length) {
        throw new BadRequestException('Project question schema contains duplicate stable keys.');
      }
      const bankVersion = await findLatestBankVersion(manager);
      const bankQuestions = await loadBankEntities(manager, bankVersion);
      const activeQuestionsByKey = new Map(
        bankQuestions
          .filter((question) => question.active)
          .map((question) => [question.stableKey, question]),
      );
      const selectedQuestions = input.questions.map((selection, index) => {
        const question = activeQuestionsByKey.get(selection.stableKey);
        if (!question) {
          throw new BadRequestException(
            `Project question schema item ${index + 1} (${selection.stableKey}) references a missing or inactive base question.`,
          );
        }
        return { selection, question };
      });

      const schema = manager.getRepository(ProjectQuestionSchemaEntity).create({
        id: randomUUID(),
        projectId,
        schemaVersion: (previousSchema?.schemaVersion ?? 0) + 1,
        bankVersion,
        publishedAt: new Date(),
        source: 'QUESTION_SCHEMA_API',
      });
      await manager.getRepository(ProjectQuestionSchemaEntity).save(schema);
      const schemaQuestions = selectedQuestions.map(({ question, selection }, index) =>
        manager.getRepository(ProjectSchemaQuestionEntity).create({
          id: randomUUID(),
          projectSchemaId: schema.id,
          baseQuestionId: question.id,
          bankVersion: question.bankVersion,
          required: selection.required ?? question.required,
          blocking: selection.blocking ?? question.blocking,
          order: index + 1,
        }),
      );
      await manager.getRepository(ProjectSchemaQuestionEntity).save(schemaQuestions);
      await manager.getRepository(AuditEvent).save({
        id: randomUUID(),
        projectId,
        eventType: 'PROJECT_QUESTION_SCHEMA_PUBLISHED',
        payload: {
          schemaId: schema.id,
          schemaVersion: String(schema.schemaVersion),
          bankVersion: String(bankVersion),
          questionCount: String(schemaQuestions.length),
        },
      });
      return toProjectSchema(
        schema,
        schemaQuestions,
        selectedQuestions.map(({ question }) => question),
        await loadQuestionReferenceFiles(
          manager,
          selectedQuestions.map(({ question }) => question.id),
        ),
      );
    });
  }
}

async function lockBankPublishing(manager: EntityManager): Promise<void> {
  await manager.query("SELECT pg_advisory_xact_lock(hashtext('project-maker-base-question-bank'))");
}

async function findLatestBankVersion(manager: EntityManager): Promise<number> {
  const result = await manager
    .getRepository(BaseQuestionEntity)
    .createQueryBuilder('question')
    .select('MAX(question.bankVersion)', 'version')
    .getRawOne<{ version: string | null }>();
  const version = Number(result?.version);
  if (!Number.isInteger(version) || version < 1) {
    throw new InternalServerErrorException('No published base question bank version exists.');
  }
  return version;
}

async function loadBankEntities(
  manager: EntityManager,
  version: number,
): Promise<BaseQuestionEntity[]> {
  return manager.getRepository(BaseQuestionEntity).find({
    where: { bankVersion: version },
    order: { order: 'ASC', stableKey: 'ASC' },
  });
}

async function loadBaseQuestionBank(
  manager: EntityManager,
  version: number,
): Promise<BaseQuestionBank> {
  const questions = await loadBankEntities(manager, version);
  return toBaseQuestionBank(
    version,
    questions,
    await loadQuestionReferenceFiles(
      manager,
      questions.map(({ id }) => id),
    ),
  );
}

function copyBankRevision(
  currentQuestions: readonly BaseQuestionEntity[],
  nextVersion: number,
): BaseQuestionEntity[] {
  const publishedAt = new Date();
  return currentQuestions.map((question) =>
    normalizeQuestion({
      ...question,
      id: randomUUID(),
      bankVersion: nextVersion,
      source: 'SETTINGS_API',
      publishedAt,
    }),
  );
}

async function copyReferenceFiles(
  manager: EntityManager,
  currentQuestions: readonly BaseQuestionEntity[],
  nextQuestions: readonly BaseQuestionEntity[],
  excluded?: { readonly questionId: string; readonly fileId: string },
): Promise<void> {
  if (currentQuestions.length === 0) return;
  const currentById = new Map(currentQuestions.map((question) => [question.id, question]));
  const nextIdByKey = new Map(nextQuestions.map((question) => [question.stableKey, question.id]));
  const currentReferences = await manager.getRepository(QuestionReferenceFileEntity).findBy({
    questionId: In(currentQuestions.map(({ id }) => id)),
  });
  const copies = currentReferences.flatMap((reference) => {
    if (
      reference.questionId === excluded?.questionId &&
      reference.fileId === excluded.fileId
    ) {
      return [];
    }
    const currentQuestion = currentById.get(reference.questionId);
    const nextQuestionId = currentQuestion
      ? nextIdByKey.get(currentQuestion.stableKey)
      : undefined;
    if (!nextQuestionId) {
      throw new InternalServerErrorException(
        'Published Question Bank reference-file successor is incomplete.',
      );
    }
    return [{ questionId: nextQuestionId, fileId: reference.fileId }];
  });
  if (copies.length > 0) {
    await manager.getRepository(QuestionReferenceFileEntity).save(copies);
  }
}

async function requireLatestQuestion(
  manager: EntityManager,
  currentQuestions: readonly BaseQuestionEntity[],
  questionId: string,
): Promise<BaseQuestionEntity> {
  const target = currentQuestions.find((question) => question.id === questionId);
  if (target) return target;
  if (await manager.getRepository(BaseQuestionEntity).existsBy({ id: questionId })) {
    throw new ConflictException(
      'Question Bank reference-file changes must target the latest published bank version.',
    );
  }
  throw new NotFoundException('Base question not found.');
}

function normalizeQuestion(question: BaseQuestionEntity): BaseQuestionEntity {
  const normalized = new BaseQuestionEntity();
  Object.assign(normalized, question, {
    stableKey: requireText(question.stableKey, 'stableKey'),
    topic: requireText(question.topic, 'topic'),
    controlPoint: requireText(question.controlPoint, 'controlPoint'),
    text: requireText(question.text, 'text'),
    hint: optionalText(question.hint, 'hint'),
    options: normalizeOptions(question.type, question.options),
  });
  return normalized;
}

function normalizeOptions(
  type: BaseQuestionType,
  options: readonly string[] | null,
): string[] | null {
  const requiresOptions = type === 'SINGLE_SELECT' || type === 'MULTI_SELECT';
  if (!requiresOptions) {
    if (options !== null) {
      throw new BadRequestException('Only select questions may define options.');
    }
    return null;
  }
  if (!options || options.length === 0) {
    throw new BadRequestException('Select questions must define at least one option.');
  }
  const normalized = options.map((option) => requireText(option, 'options'));
  if (new Set(normalized).size !== normalized.length) {
    throw new BadRequestException('Question options must be unique.');
  }
  return normalized;
}

function validateBankRevision(questions: readonly BaseQuestionEntity[]): void {
  const keys = new Set<string>();
  const orders = new Set<number>();
  for (const question of questions) {
    if (keys.has(question.stableKey)) {
      throw new ConflictException('Published bank stable keys must be unique.');
    }
    if (orders.has(question.order)) {
      throw new ConflictException('Published bank question order values must be unique.');
    }
    keys.add(question.stableKey);
    orders.add(question.order);
  }
}

async function requireProject(
  manager: EntityManager,
  projectId: string,
  lock: boolean,
): Promise<Project> {
  const project = await manager.getRepository(Project).findOne({
    where: { id: projectId },
    lock: lock ? { mode: 'pessimistic_write' } : undefined,
  });
  if (!project) {
    throw new NotFoundException('Project not found.');
  }
  return project;
}

async function findLatestProjectSchema(
  manager: EntityManager,
  projectId: string,
): Promise<ProjectQuestionSchemaEntity | null> {
  return manager.getRepository(ProjectQuestionSchemaEntity).findOne({
    where: { projectId },
    order: { schemaVersion: 'DESC' },
  });
}

async function loadProjectSchema(
  manager: EntityManager,
  schema: ProjectQuestionSchemaEntity,
): Promise<ProjectQuestionSchema> {
  const schemaQuestions = await manager.getRepository(ProjectSchemaQuestionEntity).find({
    where: { projectSchemaId: schema.id },
    order: { order: 'ASC' },
  });
  const baseQuestions = await manager.getRepository(BaseQuestionEntity).findBy({
    id: In(schemaQuestions.map((question) => question.baseQuestionId)),
  });
  if (baseQuestions.length !== schemaQuestions.length) {
    throw new InternalServerErrorException('Stored project question schema is incomplete.');
  }
  return toProjectSchema(
    schema,
    schemaQuestions,
    baseQuestions,
    await loadQuestionReferenceFiles(
      manager,
      baseQuestions.map(({ id }) => id),
    ),
  );
}

function toBaseQuestionBank(
  version: number,
  questions: readonly BaseQuestionEntity[],
  referenceFilesByQuestionId: ReadonlyMap<string, readonly QuestionReferenceFile[]>,
): BaseQuestionBank {
  return {
    version,
    questions: [...questions]
      .sort((left, right) => left.order - right.order || left.stableKey.localeCompare(right.stableKey))
      .map((question) => toBaseQuestion(
        question,
        referenceFilesByQuestionId.get(question.id) ?? [],
      )),
  };
}

function toBaseQuestion(
  question: BaseQuestionEntity,
  referenceFiles: readonly QuestionReferenceFile[],
): BaseQuestion {
  return {
    id: question.id,
    stableKey: question.stableKey,
    bankVersion: question.bankVersion,
    topic: question.topic,
    controlPoint: question.controlPoint,
    text: question.text,
    type: question.type,
    required: question.required,
    requiredForEstimate: question.requiredForEstimate,
    blocking: question.blocking,
    order: question.order,
    active: question.active,
    hint: question.hint,
    options: question.options,
    source: question.source,
    publishedAt: toIso(question.publishedAt, 'publishedAt'),
    referenceFiles,
  };
}

function toProjectSchema(
  schema: ProjectQuestionSchemaEntity,
  schemaQuestions: readonly ProjectSchemaQuestionEntity[],
  baseQuestions: readonly BaseQuestionEntity[],
  referenceFilesByQuestionId: ReadonlyMap<string, readonly QuestionReferenceFile[]>,
): ProjectQuestionSchema {
  const baseQuestionsById = new Map(baseQuestions.map((question) => [question.id, question]));
  const questions = schemaQuestions.map((schemaQuestion): ProjectSchemaQuestion => {
    const baseQuestion = baseQuestionsById.get(schemaQuestion.baseQuestionId);
    if (!baseQuestion) {
      throw new InternalServerErrorException('Stored project question schema is incomplete.');
    }
    return {
      id: schemaQuestion.id,
      baseQuestionId: baseQuestion.id,
      stableKey: baseQuestion.stableKey,
      topic: baseQuestion.topic,
      controlPoint: baseQuestion.controlPoint,
      text: baseQuestion.text,
      type: baseQuestion.type,
      required: schemaQuestion.required,
      blocking: schemaQuestion.blocking,
      order: schemaQuestion.order,
      hint: baseQuestion.hint,
      options: baseQuestion.options,
      referenceFiles: referenceFilesByQuestionId.get(baseQuestion.id) ?? [],
    };
  });
  return {
    id: schema.id,
    projectId: schema.projectId,
    schemaVersion: schema.schemaVersion,
    bankVersion: schema.bankVersion,
    publishedAt: toIso(schema.publishedAt, 'publishedAt'),
    questions,
  };
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new BadRequestException(`${field} must not be blank.`);
  }
  return normalized;
}

function optionalText(value: string | null, field: string): string | null {
  return value === null ? null : requireText(value, field);
}

function toIso(value: Date, field: string): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new InternalServerErrorException(`Stored question bank ${field} is invalid.`);
  }
  return timestamp.toISOString();
}
