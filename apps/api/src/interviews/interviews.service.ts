import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type {
  AnswerValue,
  BaseQuestionType,
  InterviewRound,
  RoundQuestionSnapshot,
} from '@project-maker/contracts';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { InterviewCustomerHandoffService } from '../interview-customer-handoffs/interview-customer-handoff.service';
import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from '../question-bank/base-question.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';
import { ProjectSchemaQuestionEntity } from '../question-bank/project-schema-question.entity';
import { CreateInterviewRoundDto } from './dto/create-interview-round.dto';
import { SetRoundQuestionAssessmentDto } from './dto/set-round-question-assessment.dto';
import { UpdateRoundAnswerDto } from './dto/update-round-answer.dto';
import { InterviewRoundEntity } from './interview-round.entity';
import { findCurrentInitialIntakeSource } from './current-initial-intake-source';
import { RoundAnswerEntity } from './round-answer.entity';
import {
  assessmentRationaleMaxLength,
  loadRoundQuestionAssessmentPolicy,
  roundAnswerValidationError,
  toEffectiveRoundQuestionSnapshot,
  unicodeCodePointLength,
  type RoundQuestionAssessmentPolicy,
} from './round-question-assessment';
import { RoundQuestionAssessmentOverrideEntity } from './round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from './round-question-snapshot.entity';

const openRoundTypeConstraintName = 'uq_interview_rounds_open_type';

@Injectable()
export class InterviewsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly handoffService: InterviewCustomerHandoffService,
  ) {}

  async getActiveInitialIntake(projectId: string): Promise<InterviewRound | null> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, false);
      const activeRound = await findCurrentInitialIntakeSource(manager, projectId);
      if (!activeRound) {
        return null;
      }
      return loadInterviewRound(manager, activeRound);
    });
  }

  async list(projectId: string): Promise<readonly InterviewRound[]> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, false);
      const rounds = await manager.getRepository(InterviewRoundEntity).find({
        where: { projectId },
        order: { createdAt: 'DESC', id: 'ASC' },
      });
      return Promise.all(rounds.map((round) => loadInterviewRound(manager, round)));
    });
  }

  async getRound(projectId: string, roundId: string): Promise<InterviewRound> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, false);
      const round = await manager.getRepository(InterviewRoundEntity).findOneBy({ id: roundId, projectId });
      if (!round) {
        throw new NotFoundException('Interview round not found.');
      }
      return loadInterviewRound(manager, round);
    });
  }

  async createRound(projectId: string, input: CreateInterviewRoundDto): Promise<InterviewRound> {
    return this.dataSource.transaction(async (manager) => {
      const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();
      await requireMutableProject(manager, projectId);
      validateRoundInput(input);
      const schema = await manager.getRepository(ProjectQuestionSchemaEntity).findOne({
        where: { projectId },
        order: { schemaVersion: 'DESC' },
      });
      if (!schema) {
        throw new ConflictException(
          'A published project question schema is required before creating a round.',
        );
      }
      const activeRound = await findOpenRound(manager, projectId, input.type);
      if (activeRound) {
        throwOpenRoundConflict(input.type);
      }
      const schemaQuestions = await manager.getRepository(ProjectSchemaQuestionEntity).find({
        where: { projectSchemaId: schema.id },
        order: { order: 'ASC' },
      });
      const baseQuestions = await manager.getRepository(BaseQuestionEntity).findBy({
        id: In(schemaQuestions.map((question) => question.baseQuestionId)),
      });
      const baseQuestionsById = new Map(
        baseQuestions.map((question) => [question.id, question]),
      );
      if (baseQuestions.length !== schemaQuestions.length) {
        throw new InternalServerErrorException('Stored project question schema is incomplete.');
      }

      const selectedKeys = new Set(input.selectedStableKeys ?? []);
      const selectedSchemaQuestions = input.type === 'INITIAL_INTAKE'
        ? schemaQuestions
        : schemaQuestions.filter((schemaQuestion) => {
            const baseQuestion = baseQuestionsById.get(schemaQuestion.baseQuestionId);
            return baseQuestion ? selectedKeys.has(baseQuestion.stableKey) : false;
          });
      if (input.type !== 'INITIAL_INTAKE' && selectedSchemaQuestions.length !== selectedKeys.size) {
        throw new BadRequestException('Additional round questions must come from the latest Project schema.');
      }

      const round = manager.getRepository(InterviewRoundEntity).create({
        id: randomUUID(),
        projectId,
        projectSchemaId: schema.id,
        type: input.type,
        status: 'OPEN',
        createdAt: new Date(),
        endedAt: null,
        contentVersion: 1,
        source: 'ROUNDS_API',
      });
      try {
        await manager.getRepository(InterviewRoundEntity).save(round);
      } catch (error) {
        if (isOpenRoundTypeUniqueViolation(error)) {
          throwOpenRoundConflict(input.type);
        }
        throw error;
      }
      const snapshots = selectedSchemaQuestions.map((schemaQuestion, index) => {
        const baseQuestion = baseQuestionsById.get(schemaQuestion.baseQuestionId);
        if (!baseQuestion) {
          throw new InternalServerErrorException('Stored project question schema is incomplete.');
        }
        return manager.getRepository(RoundQuestionSnapshotEntity).create({
          id: randomUUID(),
          roundId: round.id,
          baseQuestionId: baseQuestion.id,
          stableKey: baseQuestion.stableKey,
          topic: baseQuestion.topic,
          controlPoint: baseQuestion.controlPoint,
          text: baseQuestion.text,
          type: baseQuestion.type,
          required: input.type === 'INITIAL_INTAKE' ? schemaQuestion.required : false,
          blocking: input.type === 'INITIAL_INTAKE' ? schemaQuestion.blocking : false,
          order: input.type === 'INITIAL_INTAKE' ? schemaQuestion.order : index + 1,
          hint: baseQuestion.hint,
          options: baseQuestion.options,
          createdAt: new Date(),
        });
      });
      for (const [index, question] of (input.adHocQuestions ?? []).entries()) {
        snapshots.push(manager.getRepository(RoundQuestionSnapshotEntity).create({
          id: randomUUID(),
          roundId: round.id,
          baseQuestionId: null,
          stableKey: `adhoc-${randomUUID()}`,
          topic: question.topic.trim(),
          controlPoint: question.text.trim(),
          text: question.text.trim(),
          type: 'LONG_TEXT',
          required: false,
          blocking: false,
          order: selectedSchemaQuestions.length + index + 1,
          hint: null,
          options: null,
          createdAt: new Date(),
        }));
      }
      await manager.getRepository(RoundQuestionSnapshotEntity).save(snapshots);
      await saveAuditEvent(manager, projectId, 'INTERVIEW_ROUND_CREATED', {
        roundId: round.id,
        roundType: round.type,
        schemaId: schema.id,
        schemaVersion: String(schema.schemaVersion),
        questionCount: String(snapshots.length),
      });
      return toInterviewRound(round, schema.schemaVersion, snapshots, [], [], assessmentPolicy);
    });
  }

  async updateAnswer(
    projectId: string,
    roundId: string,
    snapshotId: string,
    input: UpdateRoundAnswerDto,
  ): Promise<RoundQuestionSnapshot> {
    return this.dataSource.transaction(async (manager) => {
      await requireMutableProject(manager, projectId, 'pessimistic_read');
      const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();
      let existingOverride = await findLockedRoundQuestionAssessmentOverride(
        manager,
        projectId,
        roundId,
        snapshotId,
      );
      let existingAnswer = await findLockedRoundAnswer(
        manager,
        projectId,
        roundId,
        snapshotId,
      );
      const round = await findLockedRound(manager, projectId, roundId);
      await this.requireEditableRound(manager, round);
      if (!existingOverride) {
        existingOverride = await manager
          .getRepository(RoundQuestionAssessmentOverrideEntity)
          .findOneBy({ roundId, snapshotId });
      }
      if (!existingAnswer) {
        existingAnswer = await manager
          .getRepository(RoundAnswerEntity)
          .findOneBy({ roundId, snapshotId });
      }
      const snapshot = await manager.getRepository(RoundQuestionSnapshotEntity).findOneBy({
        id: snapshotId,
        roundId,
      });
      if (!snapshot) {
        throw new NotFoundException('Round question snapshot not found.');
      }

      const answerRepository = manager.getRepository(RoundAnswerEntity);
      const overrideRepository = manager.getRepository(
        RoundQuestionAssessmentOverrideEntity,
      );
      if (input.value === null) {
        if (existingAnswer) {
          if (existingOverride?.status === assessmentPolicy.partialStatus) {
            await overrideRepository.remove(existingOverride);
            await saveAssessmentResetAuditEvent(manager, projectId, roundId, snapshotId);
          }
          await answerRepository.remove(existingAnswer);
          await saveAuditEvent(manager, projectId, 'ROUND_ANSWER_CLEARED', {
            roundId,
            snapshotId,
          });
        }
        return toEffectiveRoundQuestionSnapshot(
          snapshot,
          null,
          existingOverride?.status === assessmentPolicy.partialStatus
            ? null
            : existingOverride,
          assessmentPolicy,
        );
      }

      validateAnswer(snapshot.type, snapshot.options, input.value);
      const answer = existingAnswer ?? answerRepository.create({ id: randomUUID() });
      Object.assign(answer, {
        roundId,
        snapshotId,
        value: input.value,
        answeredAt: new Date(),
        updatedAt: new Date(),
      });
      const savedAnswer = await answerRepository.save(answer);
      await saveAuditEvent(manager, projectId, 'ROUND_ANSWER_SAVED', {
        roundId,
        snapshotId,
        answerId: savedAnswer.id,
      });
      return toEffectiveRoundQuestionSnapshot(
        snapshot,
        savedAnswer,
        existingOverride,
        assessmentPolicy,
      );
    });
  }

  async setAssessment(
    projectId: string,
    roundId: string,
    snapshotId: string,
    input: SetRoundQuestionAssessmentDto,
  ): Promise<RoundQuestionSnapshot> {
    return this.dataSource.transaction(async (manager) => {
      await requireMutableProject(manager, projectId, 'pessimistic_read');
      const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();
      let existingOverride = await findLockedRoundQuestionAssessmentOverride(
        manager,
        projectId,
        roundId,
        snapshotId,
      );
      const answer =
        existingOverride?.status === assessmentPolicy.partialStatus ||
        input.status === assessmentPolicy.partialStatus
          ? await findLockedRoundAnswer(manager, projectId, roundId, snapshotId)
          : null;
      const round = await findLockedRound(manager, projectId, roundId);
      await this.requireEditableRound(manager, round);
      if (!existingOverride) {
        existingOverride = await manager
          .getRepository(RoundQuestionAssessmentOverrideEntity)
          .findOneBy({ roundId, snapshotId });
      }
      const snapshot = await findRoundSnapshot(manager, roundId, snapshotId);
      const loadedAnswer =
        answer ??
        (await manager.getRepository(RoundAnswerEntity).findOneBy({
          roundId,
          snapshotId,
        }));
      const overrideRepository = manager.getRepository(
        RoundQuestionAssessmentOverrideEntity,
      );
      const assessment = normalizeAssessmentInput(
        input,
        snapshot,
        loadedAnswer,
        assessmentPolicy,
      );

      if (
        existingOverride?.status === assessment.status &&
        existingOverride.rationale === assessment.rationale
      ) {
        return toEffectiveRoundQuestionSnapshot(
          snapshot,
          loadedAnswer,
          existingOverride,
          assessmentPolicy,
        );
      }

      const now = new Date();
      const override =
        existingOverride ??
        overrideRepository.create({
          id: randomUUID(),
          roundId,
          snapshotId,
          createdAt: now,
        });
      Object.assign(override, {
        status: assessment.status,
        rationale: assessment.rationale,
        updatedAt: now,
      });
      let savedOverride: RoundQuestionAssessmentOverrideEntity;
      try {
        savedOverride = await overrideRepository.save(override);
      } catch (error) {
        if (error instanceof QueryFailedError) {
          throwAssessmentPersistenceError(error);
        }
        throw error;
      }
      await saveAssessmentSavedAuditEvent(
        manager,
        projectId,
        roundId,
        snapshotId,
        assessment.status,
      );
      return toEffectiveRoundQuestionSnapshot(
        snapshot,
        loadedAnswer,
        savedOverride,
        assessmentPolicy,
      );
    });
  }

  async resetAssessment(
    projectId: string,
    roundId: string,
    snapshotId: string,
  ): Promise<RoundQuestionSnapshot> {
    return this.dataSource.transaction(async (manager) => {
      await requireMutableProject(manager, projectId, 'pessimistic_read');
      const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();
      let existingOverride = await findLockedRoundQuestionAssessmentOverride(
        manager,
        projectId,
        roundId,
        snapshotId,
      );
      const round = await findLockedRound(manager, projectId, roundId);
      await this.requireEditableRound(manager, round);
      if (!existingOverride) {
        existingOverride = await manager
          .getRepository(RoundQuestionAssessmentOverrideEntity)
          .findOneBy({ roundId, snapshotId });
      }
      const snapshot = await findRoundSnapshot(manager, roundId, snapshotId);
      const answer = await manager.getRepository(RoundAnswerEntity).findOneBy({
        roundId,
        snapshotId,
      });
      const overrideRepository = manager.getRepository(
        RoundQuestionAssessmentOverrideEntity,
      );
      if (existingOverride) {
        await overrideRepository.remove(existingOverride);
        await saveAssessmentResetAuditEvent(manager, projectId, roundId, snapshotId);
      }
      return toEffectiveRoundQuestionSnapshot(snapshot, answer, null, assessmentPolicy);
    });
  }

  async finishRound(projectId: string, roundId: string): Promise<InterviewRound> {
    return this.dataSource.transaction(async (manager) => {
      await requireMutableProject(manager, projectId);
      const round = await findLockedRound(manager, projectId, roundId);
      if (round.status === 'ENDED') {
        if (round.type === 'INITIAL_INTAKE') {
          await this.handoffService.establishFirstDraft(manager, projectId, roundId);
        }
        return loadInterviewRound(manager, round);
      }
      const answers = await manager.getRepository(RoundAnswerEntity).findBy({ roundId });
      round.status = 'ENDED';
      round.endedAt = new Date();
      await manager.getRepository(InterviewRoundEntity).save(round);
      if (round.type === 'INITIAL_INTAKE') {
        await this.handoffService.establishFirstDraft(manager, projectId, roundId);
      }
      await saveAuditEvent(manager, projectId, 'INTERVIEW_ROUND_ENDED', {
        roundId,
        schemaId: round.projectSchemaId,
        answeredQuestionCount: String(answers.length),
      });
      return loadInterviewRound(manager, round);
    });
  }

  private async requireEditableRound(
    manager: EntityManager,
    round: InterviewRoundEntity,
  ): Promise<void> {
    if (round.type === 'INITIAL_INTAKE') {
      await this.handoffService.requireEditableRound(manager, round);
      return;
    }
    if (round.status !== 'OPEN') {
      throw new ConflictException('Ended additional rounds are read-only.');
    }
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

async function requireMutableProject(
  manager: EntityManager,
  projectId: string,
  lockMode: 'pessimistic_read' | 'pessimistic_write' = 'pessimistic_write',
): Promise<Project> {
  const project = await manager.getRepository(Project).findOne({
    where: { id: projectId },
    lock: { mode: lockMode },
  });
  if (!project) {
    throw new NotFoundException('Project not found.');
  }
  if (project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot change interviews.');
  }
  return project;
}

async function findOpenRound(
  manager: EntityManager,
  projectId: string,
  type: InterviewRoundEntity['type'],
): Promise<InterviewRoundEntity | null> {
  return manager.getRepository(InterviewRoundEntity).findOne({
    where: {
      projectId,
      type,
      status: 'OPEN',
    },
    order: { createdAt: 'DESC', id: 'ASC' },
  });
}

async function findLockedRound(
  manager: EntityManager,
  projectId: string,
  roundId: string,
): Promise<InterviewRoundEntity> {
  const round = await manager.getRepository(InterviewRoundEntity).findOne({
    where: { id: roundId, projectId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!round) {
    throw new NotFoundException('Interview round not found.');
  }
  return round;
}

async function findLockedRoundAnswer(
  manager: EntityManager,
  projectId: string,
  roundId: string,
  snapshotId: string,
): Promise<RoundAnswerEntity | null> {
  return manager
    .getRepository(RoundAnswerEntity)
    .createQueryBuilder('answer')
    .innerJoin(InterviewRoundEntity, 'round', 'round.id = answer.roundId')
    .where('answer.roundId = :roundId', { roundId })
    .andWhere('answer.snapshotId = :snapshotId', { snapshotId })
    .andWhere('round.projectId = :projectId', { projectId })
    .setLock('pessimistic_write', undefined, ['answer'])
    .getOne();
}

async function findLockedRoundQuestionAssessmentOverride(
  manager: EntityManager,
  projectId: string,
  roundId: string,
  snapshotId: string,
): Promise<RoundQuestionAssessmentOverrideEntity | null> {
  return manager
    .getRepository(RoundQuestionAssessmentOverrideEntity)
    .createQueryBuilder('override')
    .innerJoin(InterviewRoundEntity, 'round', 'round.id = override.roundId')
    .where('override.roundId = :roundId', { roundId })
    .andWhere('override.snapshotId = :snapshotId', { snapshotId })
    .andWhere('round.projectId = :projectId', { projectId })
    .setLock('pessimistic_write', undefined, ['override'])
    .getOne();
}

async function findRoundSnapshot(
  manager: EntityManager,
  roundId: string,
  snapshotId: string,
): Promise<RoundQuestionSnapshotEntity> {
  const snapshot = await manager.getRepository(RoundQuestionSnapshotEntity).findOneBy({
    id: snapshotId,
    roundId,
  });
  if (!snapshot) {
    throw new NotFoundException('Round question snapshot not found.');
  }
  return snapshot;
}

function normalizeAssessmentInput(
  input: SetRoundQuestionAssessmentDto,
  snapshot: RoundQuestionSnapshotEntity,
  answer: RoundAnswerEntity | null,
  policy: RoundQuestionAssessmentPolicy,
): { readonly status: string; readonly rationale: string | null } {
  if (input.status === policy.partialStatus) {
    if (input.rationale !== null) {
      throw new BadRequestException('Partial assessments must not include a rationale.');
    }
    if (
      answer === null ||
      roundAnswerValidationError(snapshot.type, snapshot.options, answer.value) !== null
    ) {
      throw new BadRequestException('Partial assessments require a valid saved answer.');
    }
    return { status: policy.partialStatus, rationale: null };
  }
  if (input.status === policy.notRelevantStatus) {
    if (typeof input.rationale !== 'string') {
      throw new BadRequestException('Not-relevant assessments require a rationale.');
    }
    const rationale = input.rationale.trim();
    if (
      rationale.length === 0 ||
      unicodeCodePointLength(rationale) > assessmentRationaleMaxLength
    ) {
      throw new BadRequestException(
        `Not-relevant assessment rationale must contain 1 to ${assessmentRationaleMaxLength} characters.`,
      );
    }
    return { status: policy.notRelevantStatus, rationale };
  }
  throw new BadRequestException(
    'Assessment status must be a persisted checklist decision from the active policy.',
  );
}

function validateAnswer(
  type: BaseQuestionType,
  options: readonly string[] | null,
  value: AnswerValue,
): void {
  const validationError = roundAnswerValidationError(type, options, value);
  if (validationError) {
    throw new BadRequestException(validationError);
  }
}

async function saveAuditEvent(
  manager: EntityManager,
  projectId: string,
  eventType: string,
  payload: Readonly<Record<string, string>>,
): Promise<void> {
  await manager.getRepository(AuditEvent).save({
    id: randomUUID(),
    projectId,
    eventType,
    payload,
  });
}

async function saveAssessmentSavedAuditEvent(
  manager: EntityManager,
  projectId: string,
  roundId: string,
  snapshotId: string,
  status: string,
): Promise<void> {
  await saveAuditEvent(manager, projectId, 'ROUND_QUESTION_ASSESSMENT_SAVED', {
    roundId,
    snapshotId,
    status,
  });
}

async function saveAssessmentResetAuditEvent(
  manager: EntityManager,
  projectId: string,
  roundId: string,
  snapshotId: string,
): Promise<void> {
  await saveAuditEvent(manager, projectId, 'ROUND_QUESTION_ASSESSMENT_RESET', {
    roundId,
    snapshotId,
  });
}

async function loadInterviewRound(
  manager: EntityManager,
  round: InterviewRoundEntity,
): Promise<InterviewRound> {
  const schema = await manager
    .getRepository(ProjectQuestionSchemaEntity)
    .findOneBy({ id: round.projectSchemaId });
  if (!schema) {
    throw new InternalServerErrorException('Stored interview round schema is missing.');
  }
  const snapshots = await manager.getRepository(RoundQuestionSnapshotEntity).find({
    where: { roundId: round.id },
    order: { order: 'ASC', id: 'ASC' },
  });
  const answers = await manager.getRepository(RoundAnswerEntity).find({
    where: { roundId: round.id },
    order: { snapshotId: 'ASC', id: 'ASC' },
  });
  const overrides = await manager.getRepository(RoundQuestionAssessmentOverrideEntity).find({
    where: { roundId: round.id },
    order: { snapshotId: 'ASC', id: 'ASC' },
  });
  const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();
  return toInterviewRound(
    round,
    schema.schemaVersion,
    snapshots,
    answers,
    overrides,
    assessmentPolicy,
  );
}

function throwOpenRoundConflict(type: InterviewRoundEntity['type']): never {
  throw new ConflictException(`An open ${type} round already exists for this project.`);
}

function toInterviewRound(
  round: InterviewRoundEntity,
  schemaVersion: number,
  snapshots: readonly RoundQuestionSnapshotEntity[],
  answers: readonly RoundAnswerEntity[],
  overrides: readonly RoundQuestionAssessmentOverrideEntity[],
  assessmentPolicy: RoundQuestionAssessmentPolicy,
): InterviewRound {
  const answersBySnapshotId = new Map(answers.map((answer) => [answer.snapshotId, answer]));
  const overridesBySnapshotId = new Map(
    overrides.map((override) => [override.snapshotId, override]),
  );
  return {
    id: round.id,
    projectId: round.projectId,
    projectSchemaId: round.projectSchemaId,
    schemaVersion,
    type: round.type,
    status: round.status,
    contentVersion: round.contentVersion,
    createdAt: toIso(round.createdAt, 'createdAt'),
    endedAt: round.endedAt ? toIso(round.endedAt, 'endedAt') : null,
    questions: snapshots.map((snapshot) =>
      toEffectiveRoundQuestionSnapshot(
        snapshot,
        answersBySnapshotId.get(snapshot.id) ?? null,
        overridesBySnapshotId.get(snapshot.id) ?? null,
        assessmentPolicy,
      ),
    ),
  };
}

function toIso(value: Date, field: string): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new InternalServerErrorException(`Stored interview round ${field} is invalid.`);
  }
  return timestamp.toISOString();
}

function isOpenRoundTypeUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as {
    readonly code?: unknown;
    readonly constraint?: unknown;
  };
  return (
    driverError.code === '23505' &&
    driverError.constraint === openRoundTypeConstraintName
  );
}

function validateRoundInput(input: CreateInterviewRoundDto): void {
  const selectedCount = input.selectedStableKeys?.length ?? 0;
  const adHocCount = input.adHocQuestions?.length ?? 0;
  if (input.type === 'INITIAL_INTAKE') {
    if (selectedCount > 0 || adHocCount > 0) {
      throw new BadRequestException('Initial Intake always uses the complete Project schema.');
    }
    return;
  }
  if (selectedCount + adHocCount === 0) {
    throw new BadRequestException('An additional round requires at least one selected or ad-hoc question.');
  }
  if (input.type === 'STAKEHOLDER' && adHocCount > 0) {
    throw new BadRequestException('Ad-hoc questions belong to Clarification rounds.');
  }
}

function throwAssessmentPersistenceError(error: QueryFailedError): never {
  const driverError = error.driverError as { readonly code?: unknown };
  if (
    driverError.code === '23505' ||
    driverError.code === '23514' ||
    driverError.code === '55000' ||
    driverError.code === '40001' ||
    driverError.code === '40P01'
  ) {
    throw new ConflictException(
      'The round assessment state changed while it was being saved; reload the round and retry.',
    );
  }
  throw new InternalServerErrorException(
    'The round assessment could not be persisted because the database operation failed; retry the request.',
  );
}
