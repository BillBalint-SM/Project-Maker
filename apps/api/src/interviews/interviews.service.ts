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
import { UpdateRoundAnswerDto } from './dto/update-round-answer.dto';
import { InterviewRoundEntity } from './interview-round.entity';
import { RoundAnswerEntity } from './round-answer.entity';
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
      return toInterviewRound(round, schema.schemaVersion, snapshots, []);
    });
  }

  async updateAnswer(
    projectId: string,
    roundId: string,
    snapshotId: string,
    input: UpdateRoundAnswerDto,
  ): Promise<RoundQuestionSnapshot> {
    return this.dataSource.transaction(async (manager) => {
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
      const existingAnswer = await answerRepository.findOneBy({ snapshotId });
      if (input.value === null) {
        if (existingAnswer) {
          await answerRepository.remove(existingAnswer);
          await saveAuditEvent(manager, projectId, 'ROUND_ANSWER_CLEARED', {
            roundId,
            snapshotId,
          });
        }
        return toRoundQuestionSnapshot(snapshot, null);
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
      return toRoundQuestionSnapshot(snapshot, savedAnswer);
    });
  }

  async completeRound(projectId: string, roundId: string): Promise<InterviewRound> {
    return this.dataSource.transaction(async (manager) => {
      const round = await findLockedRound(manager, projectId, roundId);
      if (round.status === 'COMPLETED') {
        throw new ConflictException('Interview round is already completed.');
      }
      const snapshots = await manager.getRepository(RoundQuestionSnapshotEntity).find({
        where: { roundId },
        order: { order: 'ASC' },
      });
      const answers = await manager.getRepository(RoundAnswerEntity).findBy({ roundId });
      const answersBySnapshotId = new Map(
        answers.map((answer) => [answer.snapshotId, answer]),
      );
      const missingSnapshotIds = snapshots
        .filter((snapshot) => snapshot.required)
        .filter((snapshot) => {
          const answer = answersBySnapshotId.get(snapshot.id);
          if (!answer) {
            return true;
          }
          try {
            validateAnswer(snapshot.type, snapshot.options, answer.value);
            return false;
          } catch (error) {
            if (error instanceof BadRequestException) {
              return true;
            }
            throw error;
          }
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

function validateAnswer(
  type: BaseQuestionType,
  options: readonly string[] | null,
  value: AnswerValue,
): void {
  if (type === 'TEXT' || type === 'LONG_TEXT') {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('Text answers must not be blank.');
    }
    return;
  }
  if (type === 'BOOLEAN') {
    if (typeof value !== 'boolean') {
      throw new BadRequestException('Boolean questions require a boolean answer.');
    }
    return;
  }
  if (type === 'NUMBER') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException('Number questions require a finite numeric answer.');
    }
    return;
  }
  if (type === 'DATE') {
    if (typeof value !== 'string' || !isIsoCalendarDate(value)) {
      throw new BadRequestException('Date questions require a YYYY-MM-DD answer.');
    }
    return;
  }
  if (type === 'SINGLE_SELECT') {
    if (typeof value !== 'string' || !options?.includes(value)) {
      throw new BadRequestException('Single-select answers must match one configured option.');
    }
    return;
  }
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    !value.every((selection) => options?.includes(selection)) ||
    new Set(value).size !== value.length
  ) {
    throw new BadRequestException(
      'Multi-select answers must contain unique configured options.',
    );
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
  return toInterviewRound(round, schema.schemaVersion, snapshots, answers);
}

function throwOpenInitialIntakeConflict(): never {
  throw new ConflictException('An open initial intake round already exists for this project.');
}

function toInterviewRound(
  round: InterviewRoundEntity,
  schemaVersion: number,
  snapshots: readonly RoundQuestionSnapshotEntity[],
  answers: readonly RoundAnswerEntity[],
): InterviewRound {
  const answersBySnapshotId = new Map(answers.map((answer) => [answer.snapshotId, answer]));
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
      toRoundQuestionSnapshot(snapshot, answersBySnapshotId.get(snapshot.id) ?? null),
    ),
  };
}

function toRoundQuestionSnapshot(
  snapshot: RoundQuestionSnapshotEntity,
  answer: RoundAnswerEntity | null,
): RoundQuestionSnapshot {
  return {
    id: snapshot.id,
    baseQuestionId: snapshot.baseQuestionId,
    stableKey: snapshot.stableKey,
    topic: snapshot.topic,
    controlPoint: snapshot.controlPoint,
    text: snapshot.text,
    type: snapshot.type,
    required: snapshot.required,
    blocking: snapshot.blocking,
    order: snapshot.order,
    hint: snapshot.hint,
    options: snapshot.options,
    answer: answer?.value ?? null,
    answeredAt: answer ? toIso(answer.answeredAt, 'answeredAt') : null,
  };
}

function isIsoCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
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
