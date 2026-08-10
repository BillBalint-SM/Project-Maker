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
import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from '../question-bank/base-question.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';
import { ProjectSchemaQuestionEntity } from '../question-bank/project-schema-question.entity';
import { CreateInterviewRoundDto } from './dto/create-interview-round.dto';
import { SetRoundQuestionAssessmentDto } from './dto/set-round-question-assessment.dto';
import { UpdateRoundAnswerDto } from './dto/update-round-answer.dto';
import { InterviewRoundEntity } from './interview-round.entity';
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

const openInitialIntakeConstraintName = 'uq_interview_rounds_open_initial_intake';

@Injectable()
export class InterviewsService {
  constructor(private readonly dataSource: DataSource) {}

  async getActiveInitialIntake(projectId: string): Promise<InterviewRound | null> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, false);
      const activeRound = await findOpenInitialIntakeRound(manager, projectId);
      if (!activeRound) {
        return null;
      }
      return loadInterviewRound(manager, activeRound);
    });
  }

  async createRound(projectId: string, input: CreateInterviewRoundDto): Promise<InterviewRound> {
    return this.dataSource.transaction(async (manager) => {
      const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();
      await requireProject(manager, projectId, true);
      const schema = await manager.getRepository(ProjectQuestionSchemaEntity).findOne({
        where: { projectId },
        order: { schemaVersion: 'DESC' },
      });
      if (!schema) {
        throw new ConflictException(
          'A published project question schema is required before creating a round.',
        );
      }
      if (input.type === 'INITIAL_INTAKE') {
        const activeRound = await findOpenInitialIntakeRound(manager, projectId);
        if (activeRound) {
          throwOpenInitialIntakeConflict();
        }
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

      const round = manager.getRepository(InterviewRoundEntity).create({
        id: randomUUID(),
        projectId,
        projectSchemaId: schema.id,
        type: input.type,
        status: 'OPEN',
        createdAt: new Date(),
        completedAt: null,
        source: 'ROUNDS_API',
      });
      try {
        await manager.getRepository(InterviewRoundEntity).save(round);
      } catch (error) {
        if (input.type === 'INITIAL_INTAKE' && isOpenInitialIntakeUniqueViolation(error)) {
          throwOpenInitialIntakeConflict();
        }
        throw error;
      }
      const snapshots = schemaQuestions.map((schemaQuestion) => {
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
          required: schemaQuestion.required,
          blocking: schemaQuestion.blocking,
          order: schemaQuestion.order,
          hint: baseQuestion.hint,
          options: baseQuestion.options,
          createdAt: new Date(),
        });
      });
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
      const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();
      const existingAnswer = await findLockedRoundAnswer(manager, roundId, snapshotId);
      const round = await findLockedRound(manager, projectId, roundId);
      if (round.status === 'COMPLETED') {
        throw new ConflictException('Completed rounds cannot be edited.');
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
      const existingOverride = await overrideRepository.findOneBy({ roundId, snapshotId });
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
      const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();
      const answer =
        input.status === assessmentPolicy.partialStatus
          ? await findLockedRoundAnswer(manager, roundId, snapshotId)
          : null;
      const round = await findLockedRound(manager, projectId, roundId);
      requireEditableRound(round);
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
      const existingOverride = await overrideRepository.findOneBy({ roundId, snapshotId });
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
      const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();
      const round = await findLockedRound(manager, projectId, roundId);
      requireEditableRound(round);
      const snapshot = await findRoundSnapshot(manager, roundId, snapshotId);
      const answer = await manager.getRepository(RoundAnswerEntity).findOneBy({
        roundId,
        snapshotId,
      });
      const overrideRepository = manager.getRepository(
        RoundQuestionAssessmentOverrideEntity,
      );
      const existingOverride = await overrideRepository.findOneBy({ roundId, snapshotId });
      if (existingOverride) {
        await overrideRepository.remove(existingOverride);
        await saveAssessmentResetAuditEvent(manager, projectId, roundId, snapshotId);
      }
      return toEffectiveRoundQuestionSnapshot(snapshot, answer, null, assessmentPolicy);
    });
  }

  async completeRound(projectId: string, roundId: string): Promise<InterviewRound> {
    return this.dataSource.transaction(async (manager) => {
      const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();
      const round = await findLockedRound(manager, projectId, roundId);
      if (round.status === 'COMPLETED') {
        throw new ConflictException('Interview round is already completed.');
      }
      const snapshots = await manager.getRepository(RoundQuestionSnapshotEntity).find({
        where: { roundId },
        order: { order: 'ASC' },
      });
      const answers = await manager.getRepository(RoundAnswerEntity).findBy({ roundId });
      const overrides = await manager
        .getRepository(RoundQuestionAssessmentOverrideEntity)
        .findBy({ roundId });
      const answersBySnapshotId = new Map(
        answers.map((answer) => [answer.snapshotId, answer]),
      );
      const overridesBySnapshotId = new Map(
        overrides.map((override) => [override.snapshotId, override]),
      );
      const missingSnapshotIds = snapshots
        .filter((snapshot) => snapshot.required)
        .filter((snapshot) => {
          const override = overridesBySnapshotId.get(snapshot.id);
          if (
            override?.status === assessmentPolicy.notRelevantStatus &&
            override.rationale !== null &&
            override.rationale.trim().length > 0
          ) {
            return false;
          }
          if (override?.status === assessmentPolicy.partialStatus) {
            return true;
          }
          const answer = answersBySnapshotId.get(snapshot.id);
          return (
            !answer ||
            roundAnswerValidationError(snapshot.type, snapshot.options, answer.value) !== null
          );
        })
        .map((snapshot) => snapshot.id);
      if (missingSnapshotIds.length > 0) {
        throw new ConflictException({
          message: 'All required round questions must have valid answers before completion.',
          missingSnapshotIds,
        });
      }

      round.status = 'COMPLETED';
      round.completedAt = new Date();
      await manager.getRepository(InterviewRoundEntity).save(round);
      await saveAuditEvent(manager, projectId, 'INTERVIEW_ROUND_COMPLETED', {
        roundId,
        schemaId: round.projectSchemaId,
        answeredQuestionCount: String(answers.length),
      });
      return loadInterviewRound(manager, round);
    });
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

async function findOpenInitialIntakeRound(
  manager: EntityManager,
  projectId: string,
): Promise<InterviewRoundEntity | null> {
  return manager.getRepository(InterviewRoundEntity).findOne({
    where: {
      projectId,
      type: 'INITIAL_INTAKE',
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
  roundId: string,
  snapshotId: string,
): Promise<RoundAnswerEntity | null> {
  return manager.getRepository(RoundAnswerEntity).findOne({
    where: { roundId, snapshotId },
    lock: { mode: 'pessimistic_write' },
  });
}

function requireEditableRound(round: InterviewRoundEntity): void {
  if (round.status === 'COMPLETED') {
    throw new ConflictException('Completed rounds cannot be edited.');
  }
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

function throwOpenInitialIntakeConflict(): never {
  throw new ConflictException('An open initial intake round already exists for this project.');
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
    createdAt: toIso(round.createdAt, 'createdAt'),
    completedAt: round.completedAt ? toIso(round.completedAt, 'completedAt') : null,
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

function isOpenInitialIntakeUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as {
    readonly code?: unknown;
    readonly constraint?: unknown;
  };
  return (
    driverError.code === '23505' &&
    driverError.constraint === openInitialIntakeConstraintName
  );
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
