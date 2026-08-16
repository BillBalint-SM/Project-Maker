import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateMarkdownRevisionInput,
  DecisionRecommendation,
  MarkdownGenerationConfiguration,
  InterviewRound,
  MarkdownRevision,
  MarkdownRevisionReason,
  MarkdownRevisionSourceSnapshot,
  ProjectQuestionSchema,
  ProjectSchemaQuestion,
  ProjectWorkspace,
  ProjectReadiness,
  ProjectDecisionReview,
} from '@project-maker/contracts';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';

import { AuditEvent, type AuditPayload } from '../audit/audit-event.entity';
import { DecisionReviewService } from '../decision-review/decision-review.service';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import {
  loadRoundQuestionAssessmentPolicy,
  toEffectiveRoundQuestionSnapshot,
} from '../interviews/round-question-assessment';
import { RoundQuestionAssessmentOverrideEntity } from '../interviews/round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { ReadinessService } from '../readiness/readiness.service';
import { BaseQuestionEntity } from '../question-bank/base-question.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';
import { ProjectSchemaQuestionEntity } from '../question-bank/project-schema-question.entity';
import { CreateMarkdownRevisionDto } from './dto/create-markdown-revision.dto';
import {
  MarkdownRevisionEntity,
  markdownRevisionReasonValues,
} from './markdown-revision.entity';
import { renderTemplate, MarkdownTemplateService } from './markdown-template.service';

const markdownSourceSnapshotVersion = 1 as const;
const sourceSnapshotSections = ['project', 'projectSchema', 'interviewRounds'] as const;
const maxChangePathsPerSection = 20;

type SourceSnapshotSection = (typeof sourceSnapshotSections)[number];
type ChangeKind = 'added' | 'removed' | 'changed';

interface ChangePath {
  readonly kind: ChangeKind;
  readonly path: string;
}

interface ChangeAccumulator {
  readonly paths: ChangePath[];
  total: number;
}

interface IdentifiedArrayEntry {
  readonly identity: string;
  readonly index: number;
  readonly value: unknown;
}

@Injectable()
export class MarkdownService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly templates: MarkdownTemplateService,
    private readonly readiness: ReadinessService,
    private readonly decisionReview: DecisionReviewService,
  ) {}

  async create(
    projectId: string,
    input: CreateMarkdownRevisionDto,
  ): Promise<MarkdownRevision> {
    validateCreateInput(input);

    return this.dataSource.transaction(async (manager) => {
      const project = await findProject(manager, projectId, true);
      return this.createWithinTransaction(manager, project, input);
    });
  }

  async createWithinTransaction(
    manager: EntityManager,
    project: Project,
    input: CreateMarkdownRevisionInput,
  ): Promise<MarkdownRevision> {
    validateCreateInput(input);
    if (project.status === 'ARCHIVED') {
      throw new ConflictException('Archived projects must be restored before a Markdown revision can be generated.');
    }

    const revisionRepository = manager.getRepository(MarkdownRevisionEntity);
    const previousRevision = await revisionRepository.findOne({
      where: { projectId: project.id },
      order: { version: 'DESC' },
    });
    const version = (previousRevision?.version ?? 0) + 1;
    const createdAt = new Date();
    const sourceSnapshot = await buildSourceSnapshot(manager, project);
    const changeSummary = summarizeChanges(previousRevision, sourceSnapshot, version);
    const selected = await this.templates.findPublished(
      input.templateId ?? project.markdownTemplateId,
    );
    const [readiness, decisionReview] = await Promise.all([
      this.readiness.getReadinessWithManager(manager, project.id),
      this.decisionReview.getReviewWithManager(manager, project.id),
    ]);
    const content = renderTemplate(selected.version.content, renderValues({
      projectId: project.id,
      version,
      reason: input.reason,
      milestone: normalizeMilestone(input.milestone),
      createdAt,
      sourceSnapshot,
      changeSummary,
      previousRevision,
      readiness,
      decisionReview,
    }));
    const revision = revisionRepository.create({
      id: randomUUID(),
      projectId: project.id,
      version,
      reason: input.reason,
      milestone: normalizeMilestone(input.milestone),
      createdAt,
      sourceSnapshot,
      changeSummary,
      content,
      previousRevisionId: previousRevision?.id ?? null,
      templateId: selected.template.id,
      templateName: selected.template.name,
      templateVersion: selected.version.version,
    });

    let savedRevision: MarkdownRevisionEntity;
    try {
      savedRevision = await revisionRepository.save(revision);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Markdown revision version ${version} already exists for this project; retry the request.`,
        );
      }
      if (error instanceof QueryFailedError) {
        throw new InternalServerErrorException(
          'The Markdown revision could not be persisted; retry the request.',
        );
      }
      throw error;
    }

    await manager.getRepository(AuditEvent).save({
      id: randomUUID(),
      projectId: project.id,
      eventType: 'MARKDOWN_REVISION_CREATED',
      payload: createAuditPayload(savedRevision, sourceSnapshot),
    });

    if (project.markdownTemplateId !== selected.template.id) {
      project.markdownTemplateId = selected.template.id;
      await manager.getRepository(Project).save(project);
    }

    return toMarkdownRevision(savedRevision);
  }

  async configuration(projectId: string): Promise<MarkdownGenerationConfiguration> {
    const project = await findProject(this.dataSource.manager, projectId, false);
    const templates = (await this.templates.list()).filter(
      (template) => template.latestPublishedVersion !== null,
    );
    const defaultTemplate = templates.find((template) => template.isDefault);
    const selectedTemplateId = project.markdownTemplateId ?? defaultTemplate?.id;
    if (!selectedTemplateId) {
      throw new ConflictException('No published Markdown template is available.');
    }
    return { selectedTemplateId, templates };
  }

  async list(projectId: string): Promise<readonly MarkdownRevision[]> {
    await findProject(this.dataSource.manager, projectId, false);
    const revisions = await this.dataSource.manager.getRepository(MarkdownRevisionEntity).find({
      where: { projectId },
      order: { version: 'DESC', id: 'ASC' },
    });
    return revisions.map(toMarkdownRevision);
  }

  async find(projectId: string, revisionId: string): Promise<MarkdownRevision> {
    await findProject(this.dataSource.manager, projectId, false);
    const revision = await this.dataSource.manager
      .getRepository(MarkdownRevisionEntity)
      .findOneBy({ id: revisionId, projectId });
    if (!revision) {
      throw new NotFoundException('Markdown revision not found for this project.');
    }
    return toMarkdownRevision(revision);
  }
}

async function findProject(
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

function validateCreateInput(input: CreateMarkdownRevisionInput): void {
  if (!markdownRevisionReasonValues.includes(input.reason)) {
    throw new BadRequestException('reason must be MANUAL or MILESTONE.');
  }
  if (input.reason === 'MILESTONE' && !hasText(input.milestone)) {
    throw new BadRequestException('milestone is required when reason is MILESTONE.');
  }
  if (input.milestone !== undefined && input.milestone !== null && !hasText(input.milestone)) {
    throw new BadRequestException('milestone must not be blank when provided.');
  }
}

function normalizeMilestone(value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : value.trim();
}

async function buildSourceSnapshot(
  manager: EntityManager,
  project: Project,
): Promise<MarkdownRevisionSourceSnapshot> {
  const projectSchema = await loadLatestProjectSchema(manager, project.id);
  const interviewRounds = await loadInterviewRounds(manager, project.id);
  return {
    version: markdownSourceSnapshotVersion,
    project: toProjectWorkspace(project),
    projectSchema,
    interviewRounds,
  };
}

async function loadLatestProjectSchema(
  manager: EntityManager,
  projectId: string,
): Promise<ProjectQuestionSchema | null> {
  const schema = await manager.getRepository(ProjectQuestionSchemaEntity).findOne({
    where: { projectId },
    order: { schemaVersion: 'DESC', id: 'ASC' },
  });
  if (!schema) {
    return null;
  }

  const schemaQuestions = await manager.getRepository(ProjectSchemaQuestionEntity).find({
    where: { projectSchemaId: schema.id },
    order: { order: 'ASC', id: 'ASC' },
  });
  const baseQuestions = await manager.getRepository(BaseQuestionEntity).findBy({
    id: In(schemaQuestions.map((question) => question.baseQuestionId)),
  });
  const baseQuestionsById = new Map(baseQuestions.map((question) => [question.id, question]));
  if (baseQuestionsById.size !== schemaQuestions.length) {
    throw new InternalServerErrorException('Stored project question schema is incomplete.');
  }

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
    };
  });

  return {
    id: schema.id,
    projectId: schema.projectId,
    schemaVersion: schema.schemaVersion,
    bankVersion: schema.bankVersion,
    publishedAt: toIso(schema.publishedAt, 'schema publishedAt'),
    questions,
  };
}

async function loadInterviewRounds(
  manager: EntityManager,
  projectId: string,
): Promise<readonly InterviewRound[]> {
  const rounds = await manager.getRepository(InterviewRoundEntity).find({
    where: { projectId },
    order: { createdAt: 'ASC', id: 'ASC' },
  });
  if (rounds.length === 0) {
    return [];
  }

  const roundIds = rounds.map((round) => round.id);
  const snapshots = await manager.getRepository(RoundQuestionSnapshotEntity).find({
    where: { roundId: In(roundIds) },
    order: { roundId: 'ASC', order: 'ASC', id: 'ASC' },
  });
  const answers = await manager.getRepository(RoundAnswerEntity).find({
    where: { roundId: In(roundIds) },
    order: { roundId: 'ASC', snapshotId: 'ASC', id: 'ASC' },
  });
  const overrides = await manager.getRepository(RoundQuestionAssessmentOverrideEntity).find({
    where: { roundId: In(roundIds) },
    order: { roundId: 'ASC', snapshotId: 'ASC', id: 'ASC' },
  });
  const schemaIds = [...new Set(rounds.map((round) => round.projectSchemaId))];
  const schemas = await manager.getRepository(ProjectQuestionSchemaEntity).findBy({
    id: In(schemaIds),
  });
  const schemaVersions = new Map(schemas.map((schema) => [schema.id, schema.schemaVersion]));
  const snapshotsByRound = groupBy(snapshots, (snapshot) => snapshot.roundId);
  const answersBySnapshot = new Map(answers.map((answer) => [answer.snapshotId, answer]));
  const overridesBySnapshot = new Map(
    overrides.map((override) => [override.snapshotId, override]),
  );
  const assessmentPolicy = await loadRoundQuestionAssessmentPolicy();

  return rounds.map((round) => {
    const schemaVersion = schemaVersions.get(round.projectSchemaId);
    if (schemaVersion === undefined) {
      throw new InternalServerErrorException('Stored interview round schema is missing.');
    }
    const roundSnapshots = snapshotsByRound.get(round.id) ?? [];
    return {
      id: round.id,
      projectId: round.projectId,
      projectSchemaId: round.projectSchemaId,
      schemaVersion,
      type: round.type,
      status: round.status,
      createdAt: toIso(round.createdAt, 'round createdAt'),
      completedAt: round.completedAt ? toIso(round.completedAt, 'round completedAt') : null,
      questions: roundSnapshots.map((snapshot) =>
        toEffectiveRoundQuestionSnapshot(
          snapshot,
          answersBySnapshot.get(snapshot.id) ?? null,
          overridesBySnapshot.get(snapshot.id) ?? null,
          assessmentPolicy,
        ),
      ),
    };
  });
}

function toProjectWorkspace(project: Project): ProjectWorkspace {
  return {
    id: project.id,
    name: project.name,
    customerContactName: project.customerContactName,
    customerContactEmail: project.customerContactEmail,
    status: project.status,
    ballOwner: project.ballOwner,
    nextAction: project.nextAction,
    dueAt: project.dueAt ? toIso(project.dueAt, 'project dueAt') : null,
    createdAt: toIso(project.createdAt, 'project createdAt'),
    updatedAt: toIso(project.updatedAt, 'project updatedAt'),
  };
}

function summarizeChanges(
  previousRevision: MarkdownRevisionEntity | null,
  currentSnapshot: MarkdownRevisionSourceSnapshot,
  version: number,
): string {
  if (!previousRevision) {
    return 'Initial revision; no previous revision exists.';
  }

  const previousSnapshot = previousRevision.sourceSnapshot;
  const sectionChanges = sourceSnapshotSections
    .map((section) => describeSectionChanges(previousSnapshot[section], currentSnapshot[section], section))
    .filter((section): section is SectionChangeReport => section !== null);
  if (sectionChanges.length === 0) {
    return `Revision ${version} records no source snapshot changes since revision ${previousRevision.version}.`;
  }

  const details = sectionChanges.flatMap((section) => {
    const shownCount = section.paths.length;
    const changeCount = `${section.total} ${section.total === 1 ? 'source path' : 'source paths'}`;
    const heading = `- ${formatSectionName(section.section)} (${changeCount}${
      section.total > shownCount ? `; showing ${shownCount}` : ''
    }):`;
    const pathLines = section.paths.map(
      (change) => `  - ${change.kind} ${formatChangePath(change.path)}.`,
    );
    if (section.total === shownCount) {
      return [heading, ...pathLines];
    }
    return [
      heading,
      ...pathLines,
      `  - ${section.total - shownCount} additional change ${
        section.total - shownCount === 1 ? 'path is' : 'paths are'
      } omitted; inspect the current and previous snapshots for full context.`,
    ];
  });
  return [
    `Revision ${version} records the following changes since revision ${previousRevision.version}:`,
    ...details,
  ].join('\n');
}

interface SectionChangeReport {
  readonly section: SourceSnapshotSection;
  readonly paths: readonly ChangePath[];
  readonly total: number;
}

function describeSectionChanges(
  previous: unknown,
  current: unknown,
  section: SourceSnapshotSection,
): SectionChangeReport | null {
  if (canonicalJson(previous) === canonicalJson(current)) {
    return null;
  }

  const accumulator: ChangeAccumulator = { paths: [], total: 0 };
  collectChanges(previous, current, section, accumulator);
  if (accumulator.total === 0) {
    recordChange(accumulator, 'changed', section);
  }
  return {
    section,
    paths: accumulator.paths,
    total: accumulator.total,
  };
}

function collectChanges(
  previous: unknown,
  current: unknown,
  path: string,
  accumulator: ChangeAccumulator,
): void {
  if (previous === undefined) {
    recordChange(accumulator, 'added', path);
    return;
  }
  if (current === undefined) {
    recordChange(accumulator, 'removed', path);
    return;
  }
  if (previous === null) {
    if (current !== null) {
      recordChange(accumulator, 'added', path);
    }
    return;
  }
  if (current === null) {
    recordChange(accumulator, 'removed', path);
    return;
  }
  if (Array.isArray(previous) && Array.isArray(current)) {
    collectArrayChanges(previous, current, path, accumulator);
    return;
  }
  if (isRecord(previous) && isRecord(current)) {
    collectRecordChanges(previous, current, path, accumulator);
    return;
  }
  if (canonicalJson(previous) !== canonicalJson(current)) {
    recordChange(accumulator, 'changed', path);
  }
}

function collectRecordChanges(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
  path: string,
  accumulator: ChangeAccumulator,
): void {
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(current)])].sort();
  for (const key of keys) {
    const childPath = `${path}.${key}`;
    const previousHasKey = Object.prototype.hasOwnProperty.call(previous, key);
    const currentHasKey = Object.prototype.hasOwnProperty.call(current, key);
    if (!previousHasKey) {
      recordChange(accumulator, 'added', childPath);
      continue;
    }
    if (!currentHasKey) {
      recordChange(accumulator, 'removed', childPath);
      continue;
    }
    collectChanges(previous[key], current[key], childPath, accumulator);
  }
}

function collectArrayChanges(
  previous: readonly unknown[],
  current: readonly unknown[],
  path: string,
  accumulator: ChangeAccumulator,
): void {
  const identityKey = identifyArrayKey(previous, current);
  if (!identityKey) {
    collectIndexedArrayChanges(previous, current, path, accumulator);
    return;
  }

  const previousEntries = identifyArrayEntries(previous, identityKey);
  const currentEntries = identifyArrayEntries(current, identityKey);
  const previousByIdentity = new Map(previousEntries.map((entry) => [entry.identity, entry]));
  const currentByIdentity = new Map(currentEntries.map((entry) => [entry.identity, entry]));

  if (
    previousEntries.length === currentEntries.length &&
    previousEntries.some((entry, index) => entry.identity !== currentEntries[index]?.identity)
  ) {
    recordChange(accumulator, 'changed', path);
  }

  for (const previousEntry of previousEntries) {
    const currentEntry = currentByIdentity.get(previousEntry.identity);
    if (!currentEntry) {
      recordChange(accumulator, 'removed', `${path}[${previousEntry.index}]`);
      continue;
    }
    collectChanges(previousEntry.value, currentEntry.value, `${path}[${currentEntry.index}]`, accumulator);
  }
  for (const currentEntry of currentEntries) {
    if (!previousByIdentity.has(currentEntry.identity)) {
      recordChange(accumulator, 'added', `${path}[${currentEntry.index}]`);
    }
  }
}

function collectIndexedArrayChanges(
  previous: readonly unknown[],
  current: readonly unknown[],
  path: string,
  accumulator: ChangeAccumulator,
): void {
  const length = Math.max(previous.length, current.length);
  for (let index = 0; index < length; index += 1) {
    const childPath = `${path}[${index}]`;
    if (index >= previous.length) {
      recordChange(accumulator, 'added', childPath);
      continue;
    }
    if (index >= current.length) {
      recordChange(accumulator, 'removed', childPath);
      continue;
    }
    collectChanges(previous[index], current[index], childPath, accumulator);
  }
}

function identifyArrayKey(
  previous: readonly unknown[],
  current: readonly unknown[],
): 'id' | 'stableKey' | null {
    for (const candidate of ['stableKey', 'id'] as const) {
    if (
      hasUniqueArrayIdentity(previous, candidate) &&
      hasUniqueArrayIdentity(current, candidate)
    ) {
      return candidate;
    }
  }
  return null;
}

function hasUniqueArrayIdentity(
  values: readonly unknown[],
  key: 'id' | 'stableKey',
): boolean {
  if (values.length === 0) {
    return false;
  }
  const identities = values.map((value) => getArrayIdentity(value, key));
  return identities.every((identity): identity is string => identity !== null) && new Set(identities).size === identities.length;
}

function identifyArrayEntries(
  values: readonly unknown[],
  key: 'id' | 'stableKey',
): readonly IdentifiedArrayEntry[] {
  return values.map((value, index) => ({
    identity: getArrayIdentity(value, key) as string,
    index,
    value,
  }));
}

function getArrayIdentity(value: unknown, key: 'id' | 'stableKey'): string | null {
  if (!isRecord(value)) {
    return null;
  }
  const identity = value[key];
  if (typeof identity !== 'string' && typeof identity !== 'number') {
    return null;
  }
  const normalized = String(identity);
  return normalized.length > 0 ? normalized : null;
}

function recordChange(accumulator: ChangeAccumulator, kind: ChangeKind, path: string): void {
  accumulator.total += 1;
  if (accumulator.paths.length < maxChangePathsPerSection) {
    accumulator.paths.push({ kind, path });
  }
}

function formatChangePath(path: string): string {
  return `\`${path.replaceAll('`', '\\u0060')}\``;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

interface MarkdownRenderInput {
  readonly projectId: string;
  readonly version: number;
  readonly reason: MarkdownRevisionReason;
  readonly milestone: string | null;
  readonly createdAt: Date;
  readonly sourceSnapshot: MarkdownRevisionSourceSnapshot;
  readonly changeSummary: string;
  readonly previousRevision: MarkdownRevisionEntity | null;
  readonly readiness: ProjectReadiness;
  readonly decisionReview: ProjectDecisionReview;
}

function renderValues(input: MarkdownRenderInput): Readonly<Record<string, string | null>> {
  return {
    'project.name': escapeMarkdownInline(input.sourceSnapshot.project.name),
    'revision.metadata': [
      '## Revízió',
      '',
      `- Verzió: ${input.version}`,
      `- Generálás oka: ${input.reason === 'MANUAL' ? 'Kézi' : 'Mérföldkő'}`,
      `- Mérföldkő: ${input.milestone ? escapeMarkdownInline(input.milestone) : 'Nincs'}`,
      `- Létrehozva (UTC): ${input.createdAt.toISOString()}`,
      `- Előző revízió: ${input.previousRevision ? `v${input.previousRevision.version}` : 'Nincs'}`,
      '',
      '### Változások az előző revízió óta',
      '',
      input.changeSummary,
    ].join('\n'),
    'project.context': renderProjectContext(input.sourceSnapshot.project),
    'project.schema': renderProjectSchema(input.sourceSnapshot.projectSchema),
    'project.initialIntake': renderInitialIntake(input.sourceSnapshot.interviewRounds),
    'project.readiness': renderReadiness(input.readiness),
    'project.decisionReview': renderDecisionReview(input.decisionReview),
  };
}

function renderProjectContext(project: ProjectWorkspace): string {
  return [
    '## Projektkontextus',
    '',
    `- Projekt: ${escapeMarkdownInline(project.name)}`,
    `- Ügyfélkapcsolat: ${escapeMarkdownInline(project.customerContactName)}`,
    `- Kapcsolati e-mail: ${escapeMarkdownInline(project.customerContactEmail)}`,
    `- Státusz: ${escapeMarkdownInline(project.status)}`,
    `- Labda birtokosa: ${project.ballOwner ? escapeMarkdownInline(project.ballOwner) : 'Nincs kijelölve'}`,
    `- Következő lépés: ${project.nextAction ? escapeMarkdownInline(project.nextAction) : 'Nincs megadva'}`,
  ].join('\n');
}

function renderProjectSchema(schema: ProjectQuestionSchema | null): string | null {
  if (!schema) return null;
  return [
    '## Elfogadott projekt-kérdésséma',
    '',
    `Sémaverzió: ${schema.schemaVersion}; kérdésbank-verzió: ${schema.bankVersion}.`,
    '',
    ...schema.questions.map(
      (question) => `${question.order}. **${escapeMarkdownInline(question.topic)} — ${escapeMarkdownInline(question.controlPoint)}**: ${escapeMarkdownInline(question.text)}`,
    ),
  ].join('\n');
}

function renderInitialIntake(rounds: readonly InterviewRound[]): string | null {
  const candidates = rounds.filter((round) => round.type === 'INITIAL_INTAKE');
  const round = [...candidates].reverse().find((candidate) => candidate.status === 'OPEN') ?? candidates.at(-1);
  if (!round) return null;
  return [
    '## Initial Intake',
    '',
    `Állapot: ${round.status === 'COMPLETED' ? 'Lezárt' : 'Folyamatban'}.`,
    '',
    ...round.questions.flatMap((question) => [
      `### ${question.order}. ${escapeMarkdownInline(question.text)}`,
      '',
      `- Ellenőrzési pont: ${escapeMarkdownInline(question.controlPoint)}`,
      renderAnswerField(question.answer),
      `- Felmérési állapot: ${escapeMarkdownInline(question.checklistStatus)}`,
      '',
    ]),
  ].join('\n').trim();
}

function renderReadiness(readiness: ProjectReadiness): string | null {
  if (!readiness.available) {
    return null;
  }
  return [
    '## Felkészültség',
    '',
    `- Teljesség: ${readiness.completionPercentage}% — ${escapeMarkdownInline(readiness.completionLabel)}`,
    `- Felkészültség: ${readiness.readinessPercentage}% — ${escapeMarkdownInline(readiness.readinessBand)}`,
    '',
    '### Nyitott gapek',
    '',
    ...(readiness.gaps.length === 0
      ? ['Nincs nyitott gap.']
      : readiness.gaps.map((gap) => `- **${escapeMarkdownInline(gap.severity)} · ${escapeMarkdownInline(gap.category)}**: ${escapeMarkdownInline(gap.message)} Következő lépés: ${escapeMarkdownInline(gap.nextStep)}`)),
  ].join('\n');
}

function renderDecisionReview(review: ProjectDecisionReview): string | null {
  if (!review.available) {
    return null;
  }
  return [
    '## Döntési értékelés',
    '',
    '### Értékelési bemenetek',
    '',
    `- Üzleti érték: ${review.inputs.businessValue}`,
    `- Stratégiai illeszkedés: ${review.inputs.strategicAlignment}`,
    `- Sürgősség: ${review.inputs.urgency}`,
    `- Bizonyosság: ${review.inputs.confidence}`,
    `- Komplexitás: ${review.inputs.complexity}`,
    `- Kockázat: ${review.inputs.risk}`,
    '',
    '### Eredmény',
    '',
    `- Döntési pontszám: ${review.decisionScore} — ${escapeMarkdownInline(review.decisionScoreLabel)}`,
    `- Ajánlás: ${decisionRecommendationLabel(review.recommendation)}`,
    `- Felkészültség: ${review.readinessPercentage}%`,
    `- Becslést blokkoló gapek: ${review.estimateBlockingGapCount}`,
    ...review.clarificationMessages.map((message) => `- ${escapeMarkdownInline(message)}`),
  ].join('\n');
}

function decisionRecommendationLabel(
  recommendation: DecisionRecommendation,
): string {
  return recommendation === 'CLARIFICATION_REQUIRED'
    ? 'Pontosítás szükséges'
    : recommendation === 'ESTIMATE_PREPARATION_POSSIBLE'
      ? 'Becslés előkészíthető'
      : 'Becslésre kész';
}

function formatAnswer(answer: InterviewRound['questions'][number]['answer']): string {
  if (answer === null) return 'Nincs válasz';
  if (Array.isArray(answer)) return answer.map((item) => escapeMarkdownInline(String(item))).join(', ');
  return escapeMarkdownInline(String(answer));
}

function renderAnswerField(answer: InterviewRound['questions'][number]['answer']): string {
  const formatted = formatAnswer(answer).replace(/\r\n?/g, '\n');
  if (!formatted.includes('\n')) {
    return `- Válasz: ${formatted}`;
  }
  const quotedLines = formatted
    .split('\n')
    .map((line) => `  >${line.length > 0 ? ` ${line}` : ''}`);
  return ['- Válasz:', ...quotedLines].join('\n');
}

function escapeMarkdownInline(value: string): string {
  return value.replace(/([\\`*_{}\[\]()#+\-.!|<>])/g, '\\$1');
}

function formatSectionName(section: SourceSnapshotSection): string {
  return section === 'projectSchema'
    ? 'Project schema'
    : section === 'interviewRounds'
      ? 'Interview rounds and answers'
      : 'Project workspace';
}

function createAuditPayload(
  revision: MarkdownRevisionEntity,
  sourceSnapshot: MarkdownRevisionSourceSnapshot,
): AuditPayload {
  return {
    revisionId: revision.id,
    revisionVersion: String(revision.version),
    reason: revision.reason,
    contentLength: String(revision.content.length),
    changeSummaryLength: String(revision.changeSummary.length),
    sourceSnapshotLength: String(JSON.stringify(sourceSnapshot).length),
    previousRevisionId: revision.previousRevisionId ?? '',
  };
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonicalize(record[key])]),
    );
  }
  return value;
}

function toMarkdownRevision(revision: MarkdownRevisionEntity): MarkdownRevision {
  return {
    id: revision.id,
    projectId: revision.projectId,
    version: revision.version,
    reason: revision.reason,
    milestone: revision.milestone,
    createdAt: toIso(revision.createdAt, 'revision createdAt'),
    sourceSnapshot: revision.sourceSnapshot,
    changeSummary: revision.changeSummary,
    content: revision.content,
    previousRevisionId: revision.previousRevisionId,
    template: revision.templateId && revision.templateName && revision.templateVersion
      ? { id: revision.templateId, name: revision.templateName, version: revision.templateVersion }
      : null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { readonly code?: unknown };
  return driverError.code === '23505';
}

function groupBy<Value>(
  values: readonly Value[],
  keySelector: (value: Value) => string,
): Map<string, Value[]> {
  const grouped = new Map<string, Value[]>();
  for (const value of values) {
    const key = keySelector(value);
    const group = grouped.get(key);
    if (group) {
      group.push(value);
    } else {
      grouped.set(key, [value]);
    }
  }
  return grouped;
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toIso(value: Date, field: string): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new InternalServerErrorException(`Stored Markdown source ${field} is invalid.`);
  }
  return timestamp.toISOString();
}
