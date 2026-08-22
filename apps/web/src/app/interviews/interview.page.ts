import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, Injector, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import type {
  AnswerValue,
  BaseQuestion,
  BaseQuestionBank,
  BaseQuestionType,
  GovernedAttachment,
  InterviewRound,
  ProjectQuestionSchema,
  PublishProjectQuestionSchemaInput,
  RoundQuestionSnapshot,
} from '@project-maker/contracts';

import { InterviewApiService, isInterviewApiError } from './interview-api.service';
import { InterviewHandoffComponent } from './interview-handoff/interview-handoff.component';
import { ProjectApiService } from '../projects/project-api.service';
import { ProjectAttachmentBlockComponent } from '../projects/attachments/project-attachment-block.component';
import { ProjectAttachmentsApiService } from '../projects/attachments/project-attachments-api.service';
import { QuestionBankApiService } from '../settings/question-bank-api.service';
import { baseQuestionTypeLabel } from '../base-question-type-label';

const textAutosaveDelayMs = 750;
const completionBlockedByAnswerErrorMessage =
  'A felmérési kör nem zárható le, amíg van sikertelen válaszmentés. Mentsd újra a hibás válaszokat, majd próbáld újra.';
const completionBlockedByPendingSaveMessage =
  'A felmérési kör lezárása előtt várd meg, amíg minden automatikus mentés befejeződik.';
const completionBlockedByAssessmentErrorMessage =
  'A felmérési kör nem zárható le, amíg van sikertelen értékelésmentés. Mentsd újra a hibás értékeléseket, majd próbáld újra.';
const completionBlockedByPendingAssessmentMessage =
  'A felmérési kör lezárása előtt várd meg, amíg minden értékelés mentése befejeződik.';

type QuestionSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type AssessmentMode = 'automatic' | 'partial' | 'not-relevant';
interface QuestionAnswerState {
  readonly draft: AnswerValue | null;
  readonly persisted: AnswerValue | null;
  readonly status: QuestionSaveStatus;
  readonly error: string | null;
  readonly latestRequestId: number;
  readonly latestSubmittedRequestId: number | null;
}

interface QuestionAssessmentState {
  readonly mode: AssessmentMode;
  readonly rationale: string;
  readonly baselineMode: AssessmentMode;
  readonly baselineRationale: string;
  readonly status: QuestionSaveStatus;
  readonly error: string | null;
}

@Component({
  selector: 'app-interview-page',
  imports: [
    ButtonModule,
    CardModule,
    MessageModule,
    InterviewHandoffComponent,
    ProjectAttachmentBlockComponent,
    ProgressSpinnerModule,
    RouterLink,
    TagModule,
  ],
  templateUrl: './interview.page.html',
  styleUrl: './interview.page.scss',
})
export class InterviewPage implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly questionBankApi = inject(QuestionBankApiService);
  private readonly interviewApi = inject(InterviewApiService);
  private readonly projectApi = inject(ProjectApiService);
  private readonly projectAttachmentsApi = inject(ProjectAttachmentsApiService);
  private readonly autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly inFlightRequestIds = new Map<string, Set<number>>();

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly requestedRoundId = this.route.snapshot.queryParamMap.get('roundId');
  readonly handoffRequested = this.route.snapshot.fragment === 'customer-handoff';
  readonly bank = signal<BaseQuestionBank | null>(null);
  readonly schema = signal<ProjectQuestionSchema | null>(null);
  readonly selectedKeys = signal<readonly string[]>([]);
  readonly round = signal<InterviewRound | null>(null);
  readonly answerStates = signal<ReadonlyMap<string, QuestionAnswerState>>(new Map());
  readonly assessmentStates = signal<ReadonlyMap<string, QuestionAssessmentState>>(new Map());
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly schemaSaving = signal(false);
  readonly roundSaving = signal(false);
  readonly completing = signal(false);
  readonly endedEditable = signal(false);
  readonly previewAfterFinish = signal(false);
  readonly projectArchived = signal(false);
  readonly projectPlaybookId = signal('general');
  readonly handoffContentRevision = signal(0);
  readonly attachments = signal<readonly GovernedAttachment[]>([]);

  ngOnInit(): void {
    this.loadInterviewData();
  }

  ngOnDestroy(): void {
    this.clearAutosaveTimers();
    this.inFlightRequestIds.clear();
  }

  loadInterviewData(): void {
    if (!this.projectId) {
      this.loadError.set(
        'Hiányzik a projektazonosító a felmérés URL-jéből. Menj vissza a projektportfólióhoz, és nyisd meg újra a felmérést.',
      );
      this.loading.set(false);
      return;
    }

    this.clearAutosaveTimers();
    this.inFlightRequestIds.clear();
    this.loading.set(true);
    this.loadError.set(null);
    this.actionError.set(null);
    this.feedback.set(null);
    this.round.set(null);
    this.answerStates.set(new Map());
    this.assessmentStates.set(new Map());
    forkJoin({
      bank: this.questionBankApi.loadBaseQuestionBank(),
      schema: this.questionBankApi.loadProjectSchema(this.projectId),
      activeRound: this.requestedRoundId
        ? this.interviewApi.getRound(this.projectId, this.requestedRoundId)
        : this.interviewApi.getActiveInitialIntake(this.projectId),
      project: this.projectApi.loadProjectWorkspace(this.projectId),
      attachments: this.projectAttachmentsApi.list(this.projectId),
    }).subscribe({
      next: ({ bank, schema, activeRound, project, attachments }) => {
        this.bank.set(bank);
        this.schema.set(schema);
        this.round.set(activeRound);
        this.projectArchived.set(project.status === 'ARCHIVED');
        this.projectPlaybookId.set(project.playbook.id);
        this.attachments.set(attachments);
        this.answerStates.set(buildAnswerStates(activeRound));
        this.assessmentStates.set(buildAssessmentStates(activeRound));
        this.selectedKeys.set(this.buildSelectedKeys(bank, schema, activeRound, project.playbook.id));
        this.loading.set(false);
        this.focusRequestedHandoffAfterNextRender(activeRound);
      },
      error: (error: unknown) => {
        this.loadError.set(resolveLoadError(error));
        this.loading.set(false);
      },
    });
  }

  activeQuestions(): readonly BaseQuestion[] {
    const prefix = `${this.projectPlaybookId()}-`;
    return this.bank()?.questions.filter(
      (question) => question.active && question.stableKey.startsWith(prefix),
    ) ?? [];
  }

  attachmentsFor(ownerId: string): readonly GovernedAttachment[] {
    return this.attachments().filter(
      (attachment) =>
        attachment.ownerKind === 'ROUND_SNAPSHOT' && attachment.ownerId === ownerId,
    );
  }

  reloadAttachments(): void {
    this.projectAttachmentsApi.list(this.projectId).subscribe({
      next: (attachments) => this.attachments.set(attachments),
      error: (error: Error) => this.actionError.set(error.message),
    });
  }

  referenceFileUrl(questionId: string, fileId: string): string {
    return this.questionBankApi.referenceFileDownloadUrl(questionId, fileId);
  }

  isSelected(stableKey: string): boolean {
    return this.selectedKeys().includes(stableKey);
  }

  setSelected(stableKey: string, checked: boolean): void {
    if (this.hasOpenRound() || this.projectArchived()) {
      return;
    }
    const next = new Set(this.selectedKeys());
    if (checked) {
      next.add(stableKey);
    } else {
      next.delete(stableKey);
    }
    const bankOrder = this.activeQuestions().map((question) => question.stableKey);
    this.selectedKeys.set(bankOrder.filter((key) => next.has(key)));
  }

  selectedCount(): number {
    return this.selectedKeys().length;
  }

  publishSchema(): void {
    if (this.schemaSaving() || this.projectArchived()) {
      return;
    }
    if (this.hasOpenRound()) {
      this.actionError.set(
        'A kérdésséma nem módosítható, amíg van nyitott kezdő felmérési kör.',
      );
      return;
    }
    if (this.selectedCount() === 0) {
      this.actionError.set(
        'Legalább egy aktív alapkérdést ki kell választanod a projektséma közzététele előtt.',
      );
      return;
    }

    const existingByKey = new Map(
      this.schema()?.questions.map((question) => [question.stableKey, question]) ?? [],
    );
    const input: PublishProjectQuestionSchemaInput = {
      questions: this.activeQuestions()
        .filter((question) => this.isSelected(question.stableKey))
        .map((question) => {
          const existing = existingByKey.get(question.stableKey);
          return {
            stableKey: question.stableKey,
            required: existing?.required ?? question.required,
            blocking: existing?.blocking ?? question.blocking,
          };
        }),
    };

    this.schemaSaving.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    const hasExistingSchema = this.schema() !== null;
    const request = hasExistingSchema
      ? this.questionBankApi.updateProjectSchema(this.projectId, input)
      : this.questionBankApi.createProjectSchema(this.projectId, input);
    request.subscribe({
      next: (schema) => {
        this.schema.set(schema);
        this.selectedKeys.set(schema.questions.map((question) => question.stableKey));
        this.schemaSaving.set(false);
        if (!hasExistingSchema) {
          this.startInitialRound();
          return;
        }
        this.feedback.set(
          this.schema()?.schemaVersion === 1
            ? 'A projekt kérdéssémája elkészült.'
            : 'A projekt kérdéssémája frissült.',
        );
      },
      error: () => {
        this.actionError.set(resolveSchemaPublishError(hasExistingSchema));
        this.schemaSaving.set(false);
      },
    });
  }

  retryInitialRoundStart(): void {
    this.startInitialRound(true);
  }

  private startInitialRound(reconcileExistingRound = false): void {
    if (this.roundSaving() || this.schema() === null || this.projectArchived()) {
      if (this.schema() === null) {
        this.actionError.set('A felmérési kör indítása előtt fogadd el a projekt kérdéssémáját.');
      }
      return;
    }

    this.roundSaving.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.interviewApi.createRound(this.projectId, { type: 'INITIAL_INTAKE' }).subscribe({
      next: (round) => this.acceptStartedInitialRound(round),
      error: () => {
        if (reconcileExistingRound) {
          this.reconcileStartedInitialRound();
          return;
        }
        this.showInitialRoundStartFailure();
      },
    });
  }

  private reconcileStartedInitialRound(): void {
    this.interviewApi.getActiveInitialIntake(this.projectId).subscribe({
      next: (round) => {
        if (round) {
          this.acceptStartedInitialRound(round);
          return;
        }
        this.showInitialRoundStartFailure();
      },
      error: () => this.showInitialRoundStartFailure(),
    });
  }

  private acceptStartedInitialRound(round: InterviewRound): void {
    this.clearAutosaveTimers();
    this.inFlightRequestIds.clear();
    this.round.set(round);
    this.answerStates.set(buildAnswerStates(round));
    this.assessmentStates.set(buildAssessmentStates(round));
    this.roundSaving.set(false);
    this.feedback.set('A kezdő felmérési kör elindult.');
  }

  private showInitialRoundStartFailure(): void {
    this.actionError.set(
      'A kérdésséma elfogadva van, de a kezdő felmérési kör nem indult el. Próbáld újra a felmérés indítását.',
    );
    this.roundSaving.set(false);
  }

  currentAnswer(question: RoundQuestionSnapshot): AnswerValue | null {
    return this.answerState(question).draft;
  }

  setTextDraft(question: RoundQuestionSnapshot, value: string): void {
    if (this.isAnswerEditingLocked(question)) {
      return;
    }

    this.invalidateHandoffPreview();
    if (value.trim().length === 0) {
      this.setAnswerDraft(question.id, null);
      this.persistAnswer(question);
      return;
    }

    this.setAnswerDraft(question.id, value);
    this.scheduleAnswerSave(question, textAutosaveDelayMs);
  }

  setDiscreteDraft(question: RoundQuestionSnapshot, value: AnswerValue | null): void {
    if (this.isAnswerEditingLocked(question)) {
      return;
    }

    this.invalidateHandoffPreview();
    this.setAnswerDraft(question.id, value);
    this.persistAnswer(question);
  }

  setSingleSelectDraft(question: RoundQuestionSnapshot, value: string): void {
    this.setDiscreteDraft(question, value.length > 0 ? value : null);
  }

  setNumberDraft(question: RoundQuestionSnapshot, value: string): void {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      this.setDiscreteDraft(question, null);
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return;
    }

    this.setDiscreteDraft(question, parsed);
  }

  setMultiSelectDraft(
    question: RoundQuestionSnapshot,
    option: string,
    checked: boolean,
  ): void {
    const current = this.currentAnswer(question);
    const selectedOptions = new Set(Array.isArray(current) ? current : []);
    if (checked) {
      selectedOptions.add(option);
    } else {
      selectedOptions.delete(option);
    }

    const nextSelections = (question.options ?? []).filter((candidate) =>
      selectedOptions.has(candidate),
    );
    this.setDiscreteDraft(question, nextSelections.length > 0 ? nextSelections : null);
  }

  retryAnswer(question: RoundQuestionSnapshot): void {
    if (this.isAnswerEditingLocked(question)) {
      return;
    }

    this.persistAnswer(question);
  }

  clearAutosaveTimers(): void {
    for (const timerId of this.autosaveTimers.values()) {
      clearTimeout(timerId);
    }
    this.autosaveTimers.clear();
  }

  hasSelectedOption(question: RoundQuestionSnapshot, option: string): boolean {
    const answer = this.currentAnswer(question);
    return Array.isArray(answer) && answer.includes(option);
  }

  textAnswer(question: RoundQuestionSnapshot): string {
    const answer = this.currentAnswer(question);
    return typeof answer === 'string' ? answer : '';
  }

  numberAnswer(question: RoundQuestionSnapshot): string {
    const answer = this.currentAnswer(question);
    return typeof answer === 'number' ? String(answer) : '';
  }

  booleanAnswer(question: RoundQuestionSnapshot): boolean {
    return this.currentAnswer(question) === true;
  }

  assessmentStatus(question: RoundQuestionSnapshot): string {
    return question.checklistStatus;
  }

  isAssessmentSelected(question: RoundQuestionSnapshot, mode: AssessmentMode): boolean {
    return this.assessmentState(question).mode === mode;
  }

  isAssessmentControlDisabled(question: RoundQuestionSnapshot, mode: AssessmentMode): boolean {
    const state = this.assessmentState(question);
    return this.isAssessmentEditingLocked(question) || (state.status === 'saving' && state.mode === mode);
  }

  canSavePartialAssessment(question: RoundQuestionSnapshot): boolean {
    return this.hasPersistedValidAnswer(question) && !this.isAssessmentControlDisabled(question, 'partial');
  }

  selectPartialAssessment(question: RoundQuestionSnapshot): void {
    if (!this.canSavePartialAssessment(question)) {
      return;
    }

    this.invalidateHandoffPreview();
    this.setAssessmentState(question.id, {
      ...this.assessmentState(question),
      mode: 'partial',
      rationale: '',
      error: null,
    });
    this.persistAssessment(question);
  }

  selectNotRelevantAssessment(question: RoundQuestionSnapshot): void {
    if (this.isAssessmentControlDisabled(question, 'not-relevant')) {
      return;
    }

    this.invalidateHandoffPreview();
    const state = this.assessmentState(question);
    this.setAssessmentState(question.id, {
      ...state,
      mode: 'not-relevant',
      rationale: state.mode === 'not-relevant' ? state.rationale : '',
      error: null,
    });
  }

  setAssessmentRationale(question: RoundQuestionSnapshot, rationale: string): void {
    const state = this.assessmentState(question);
    if (this.isAssessmentControlDisabled(question, 'not-relevant')) {
      return;
    }

    this.invalidateHandoffPreview();
    this.setAssessmentState(question.id, {
      ...state,
      rationale,
      error: null,
    });
  }

  canSaveNotRelevantAssessment(question: RoundQuestionSnapshot): boolean {
    return (
      this.assessmentState(question).mode === 'not-relevant' &&
      isValidAssessmentRationale(this.assessmentState(question).rationale) &&
      !this.isAssessmentControlDisabled(question, 'not-relevant')
    );
  }

  saveNotRelevantAssessment(question: RoundQuestionSnapshot): void {
    if (!this.canSaveNotRelevantAssessment(question)) {
      return;
    }

    this.persistAssessment(question);
  }

  resetAssessment(question: RoundQuestionSnapshot): void {
    if (this.isAssessmentControlDisabled(question, 'automatic')) {
      return;
    }

    this.invalidateHandoffPreview();
    this.setAssessmentState(question.id, {
      ...this.assessmentState(question),
      mode: 'automatic',
      rationale: '',
      error: null,
    });
    this.persistAssessment(question);
  }

  showAssessmentRationale(question: RoundQuestionSnapshot): boolean {
    return this.assessmentState(question).mode === 'not-relevant';
  }

  assessmentRationale(question: RoundQuestionSnapshot): string {
    return this.assessmentState(question).rationale;
  }

  assessmentSaveState(question: RoundQuestionSnapshot): string {
    const state = this.assessmentState(question);
    if (state.status === 'saving') {
      return 'Értékelés mentése folyamatban…';
    }
    if (state.status === 'error') {
      return state.error
        ? `Nem sikerült elmenteni az értékelést. ${state.error}`
        : 'Nem sikerült elmenteni az értékelést. Próbáld újra.';
    }
    if (state.mode !== state.baselineMode || state.rationale !== state.baselineRationale) {
      return 'Értékelési piszkozat';
    }
    return 'Értékelés mentve';
  }

  assessmentHasError(question: RoundQuestionSnapshot): boolean {
    return this.assessmentState(question).status === 'error';
  }

  retryAssessment(question: RoundQuestionSnapshot): void {
    const state = this.assessmentState(question);
    if (state.status !== 'error') {
      return;
    }

    if (state.mode === 'partial' && !this.hasPersistedValidAnswer(question)) {
      return;
    }
    if (state.mode === 'not-relevant' && !isValidAssessmentRationale(state.rationale)) {
      return;
    }
    this.persistAssessment(question);
  }

  finishRound(sendNow: boolean): void {
    const round = this.round();
    if (!round || round.status === 'ENDED' || this.completing() || this.projectArchived()) {
      return;
    }

    if (this.hasAnswerSaveErrors()) {
      this.actionError.set(completionBlockedByAnswerErrorMessage);
      this.feedback.set(null);
      return;
    }

    if (this.hasAssessmentSaveErrors()) {
      this.actionError.set(completionBlockedByAssessmentErrorMessage);
      this.feedback.set(null);
      return;
    }

    if (this.hasPendingAnswerWork()) {
      this.actionError.set(completionBlockedByPendingSaveMessage);
      this.feedback.set(null);
      return;
    }

    if (this.hasPendingAssessmentWork()) {
      this.actionError.set(completionBlockedByPendingAssessmentMessage);
      this.feedback.set(null);
      return;
    }

    this.completing.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.interviewApi.finishRound(this.projectId, round.id).subscribe({
      next: (endedRound) => {
        this.clearAutosaveTimers();
        this.inFlightRequestIds.clear();
        this.round.set(endedRound);
        this.answerStates.set(buildAnswerStates(endedRound));
        this.assessmentStates.set(buildAssessmentStates(endedRound));
        const initialRound = endedRound.type === 'INITIAL_INTAKE';
        this.endedEditable.set(initialRound);
        this.previewAfterFinish.set(initialRound && sendNow);
        this.completing.set(false);
        if (!initialRound) {
          void this.router.navigate(['/projects', this.projectId, 'discovery']);
        } else if (!sendNow) {
          const returnTo = this.route.snapshot.queryParamMap.get('returnTo');
          void this.router.navigate(
            ['/projects', this.projectId, 'readiness'],
            { queryParams: returnTo ? { returnTo } : undefined },
          );
        }
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.completing.set(false);
      },
    });
  }

  hasOpenRound(): boolean {
    return this.round()?.status === 'OPEN';
  }

  isAnswerDisabled(question: RoundQuestionSnapshot): boolean {
    return this.isAnswerEditingLocked(question);
  }

  isCompleteDisabled(): boolean {
    return (
      this.completing() ||
      this.projectArchived() ||
      this.hasPendingAnswerWork() ||
      this.hasAnswerSaveErrors() ||
      this.hasPendingAssessmentWork() ||
      this.hasAssessmentSaveErrors()
    );
  }

  showCompletionBlockedMessage(): boolean {
    return this.hasAnswerSaveErrors() || this.hasAssessmentSaveErrors() || this.hasPendingAssessmentWork();
  }

  completionBlockedMessage(): string {
    if (this.hasAnswerSaveErrors()) {
      return completionBlockedByAnswerErrorMessage;
    }
    if (this.hasAssessmentSaveErrors()) {
      return completionBlockedByAssessmentErrorMessage;
    }
    return completionBlockedByPendingAssessmentMessage;
  }

  questionSaveState(question: RoundQuestionSnapshot): string {
    const state = this.answerState(question);
    if (state.status === 'saving') {
      return 'Mentés folyamatban…';
    }
    if (state.status === 'error') {
      return state.error
        ? `Nem sikerült menteni. ${state.error}`
        : 'Nem sikerült menteni. Próbáld újra.';
    }
    if (this.hasUnsavedChanges(question)) {
      return 'Piszkozat – automatikus mentésre vár';
    }
    if (state.persisted !== null || question.answeredAt) {
      return 'Mentve';
    }
    return 'Még nincs mentve';
  }

  questionHasError(question: RoundQuestionSnapshot): boolean {
    return this.answerState(question).status === 'error';
  }

  showRetryButton(question: RoundQuestionSnapshot): boolean {
    return this.questionHasError(question);
  }

  questionRetryLabel(question: RoundQuestionSnapshot): string {
    return `Válasz újramentése: ${question.text}`;
  }

  showBlockingGuidance(question: RoundQuestionSnapshot): boolean {
    const round = this.round();
    return (
      round?.status === 'OPEN' &&
      question.blocking &&
      this.currentAnswer(question) === null &&
      !this.hasUnsavedChanges(question)
    );
  }

  roundTypeLabel(): string {
    const type = this.round()?.type;
    if (type === 'STAKEHOLDER') return 'Stakeholder kör';
    if (type === 'CLARIFICATION') return 'Tisztázó kör';
    return 'Kezdő felmérés';
  }

  isInitialRound(): boolean {
    return this.round()?.type === 'INITIAL_INTAKE';
  }

  readonly questionTypeLabel = baseQuestionTypeLabel;

  questionTypeGuidance(question: RoundQuestionSnapshot): string {
    switch (question.type) {
      case 'TEXT':
        return 'Rövid, tömör válasz ajánlott.';
      case 'LONG_TEXT':
        return 'Részletes, többmondatos válasz ajánlott.';
      case 'SINGLE_SELECT':
        return 'Pontosan egy lehetőséget válassz.';
      case 'MULTI_SELECT':
        return 'Egy vagy több lehetőséget is kiválaszthatsz.';
      case 'BOOLEAN':
        return 'Jelöld be, ha a válasz igen.';
      case 'NUMBER':
        return 'Adj meg egy véges számértéket.';
      case 'DATE':
        return 'Add meg a dátumot ÉÉÉÉ-HH-NN formátumban.';
    }
  }

  questionOptionGuidance(question: RoundQuestionSnapshot): string | null {
    if (!question.options || question.options.length === 0) {
      return null;
    }

    return `Választható lehetőségek: ${question.options.join(' · ')}`;
  }

  private buildSelectedKeys(
    bank: BaseQuestionBank,
    schema: ProjectQuestionSchema | null,
    activeRound: InterviewRound | null,
    playbookId: string,
  ): readonly string[] {
    if (activeRound) {
      return activeRound.questions.map((question) => question.stableKey);
    }

    const activeKeys = new Set(
      bank.questions
        .filter((question) => question.active && question.stableKey.startsWith(`${playbookId}-`))
        .map((question) => question.stableKey),
    );
    return (
      schema?.questions
        .map((question) => question.stableKey)
        .filter((stableKey) => activeKeys.has(stableKey)) ??
      bank.questions
        .filter((question) => question.active && question.stableKey.startsWith(`${playbookId}-`))
        .map((question) => question.stableKey)
    );
  }

  private focusRequestedHandoffAfterNextRender(activeRound: InterviewRound | null): void {
    if (!this.handoffRequested || activeRound?.status !== 'ENDED') {
      return;
    }

    afterNextRender(
      () => {
        const handoff = this.document.getElementById('customer-handoff');
        if (!handoff) {
          return;
        }
        handoff.focus({ preventScroll: true });
        handoff.scrollIntoView({ block: 'start' });
      },
      { injector: this.injector },
    );
  }

  private answerState(question: RoundQuestionSnapshot): QuestionAnswerState {
    return (
      this.answerStates().get(question.id) ??
      createQuestionAnswerState(question.answer, question.answeredAt)
    );
  }

  private invalidateHandoffPreview(): void {
    if (this.round()?.status === 'ENDED') {
      this.handoffContentRevision.update((revision) => revision + 1);
    }
  }

  private assessmentState(question: RoundQuestionSnapshot): QuestionAssessmentState {
    return this.assessmentStates().get(question.id) ?? createQuestionAssessmentState(question);
  }

  private persistAssessment(question: RoundQuestionSnapshot): void {
    const round = this.round();
    const state = this.assessmentState(question);
    if (!round || this.isAssessmentEditingLocked(question) || state.status === 'saving') {
      return;
    }

    this.setAssessmentState(question.id, {
      ...state,
      status: 'saving',
      error: null,
    });
    const request =
      state.mode === 'automatic'
        ? this.interviewApi.resetAssessment(this.projectId, round.id, question.id)
        : this.interviewApi.setAssessment(this.projectId, round.id, question.id, {
            status: state.mode === 'partial' ? 'Részben megvan' : 'Nem releváns',
            rationale: state.mode === 'not-relevant' ? state.rationale.trim() : null,
          });
    request.subscribe({
      next: (savedQuestion) => {
        this.replaceRoundQuestionFromAssessment(savedQuestion);
      },
      error: (error: Error) => {
        const current = this.assessmentState(question);
        this.setAssessmentState(question.id, {
          ...current,
          status: 'error',
          error: error.message,
        });
      },
    });
  }

  private setAnswerDraft(snapshotId: string, value: AnswerValue | null): void {
    const current = this.answerStates().get(snapshotId) ?? createQuestionAnswerState(null, null);
    const hasUnsavedChanges = this.hasUnsavedChangesByState(current.persisted, value);
    this.setAnswerState(snapshotId, {
      ...current,
      draft: cloneAnswerValue(value),
      status: hasUnsavedChanges
        ? current.status === 'saving'
          ? 'saving'
          : 'idle'
        : this.savedStateFor(value),
      error: null,
    });
  }

  private scheduleAnswerSave(question: RoundQuestionSnapshot, delayMs: number): void {
    this.clearAutosaveTimer(question.id);
    const timerId = setTimeout(() => {
      this.autosaveTimers.delete(question.id);
      this.persistAnswer(question);
    }, delayMs);
    this.autosaveTimers.set(question.id, timerId);
  }

  private persistAnswer(question: RoundQuestionSnapshot): void {
    const round = this.round();
    if (!round || (round.status === 'ENDED' && !this.endedEditable()) || this.completing()) {
      return;
    }

    this.clearAutosaveTimer(question.id);
    const state = this.answerState(question);
    if (answersEqual(state.draft, state.persisted) && state.status !== 'error') {
      this.setAnswerState(question.id, {
        ...state,
        status: this.savedStateFor(state.draft),
        error: null,
      });
      return;
    }

    const requestId = state.latestRequestId + 1;
    const requestValue = cloneAnswerValue(state.draft);
    this.addInFlightRequest(question.id, requestId);
    this.setAnswerState(question.id, {
      ...state,
      status: 'saving',
      error: null,
      latestRequestId: requestId,
      latestSubmittedRequestId: requestId,
    });

    this.interviewApi
      .updateAnswer(this.projectId, round.id, question.id, {
        value: requestValue,
      })
      .subscribe({
        next: (savedQuestion) => {
          this.removeInFlightRequest(question.id, requestId);
          this.handlePersistSuccess(question, requestId, requestValue, savedQuestion);
        },
        error: (error: Error) => {
          this.removeInFlightRequest(question.id, requestId);
          this.handlePersistError(question, requestId, requestValue, error);
        },
      });
  }

  private handlePersistSuccess(
    question: RoundQuestionSnapshot,
    requestId: number,
    requestValue: AnswerValue | null,
    savedQuestion: RoundQuestionSnapshot,
  ): void {
    const state = this.answerState(question);
    const hasLaterSubmittedRequest =
      state.latestSubmittedRequestId !== null && state.latestSubmittedRequestId > requestId;
    if (hasLaterSubmittedRequest) {
      if (this.hasInFlightRequests(question.id)) {
        this.setAnswerState(question.id, {
          ...state,
          status: 'saving',
        });
      }
      return;
    }

    if (!answersEqual(state.draft, requestValue)) {
      if (this.hasInFlightRequests(question.id)) {
        this.setAnswerState(question.id, {
          ...state,
          status: 'saving',
        });
        return;
      }

      this.setAnswerState(question.id, {
        ...state,
        status: 'saving',
        error: null,
      });
      this.persistAnswer(question);
      return;
    }

    this.replaceRoundQuestionFromAnswer(savedQuestion);
    this.setAnswerState(question.id, {
      ...state,
      persisted: cloneAnswerValue(savedQuestion.answer),
      status: this.hasInFlightRequests(question.id) ? 'saving' : this.savedStateFor(savedQuestion.answer),
      error: null,
    });
  }

  private handlePersistError(
    question: RoundQuestionSnapshot,
    requestId: number,
    requestValue: AnswerValue | null,
    error: Error,
  ): void {
    const state = this.answerState(question);
    const hasLaterSubmittedRequest =
      state.latestSubmittedRequestId !== null && state.latestSubmittedRequestId > requestId;
    if (hasLaterSubmittedRequest) {
      if (this.hasInFlightRequests(question.id)) {
        this.setAnswerState(question.id, {
          ...state,
          status: 'saving',
        });
      }
      return;
    }

    if (!answersEqual(state.draft, requestValue) && !this.hasInFlightRequests(question.id)) {
      this.setAnswerState(question.id, {
        ...state,
        status: 'saving',
        error: null,
      });
      this.persistAnswer(question);
      return;
    }

    this.setAnswerState(question.id, {
      ...state,
      status: 'error',
      error: error.message,
    });
  }

  private hasUnsavedChanges(question: RoundQuestionSnapshot): boolean {
    const state = this.answerState(question);
    return this.hasUnsavedChangesByState(state.persisted, state.draft);
  }

  private hasUnsavedChangesByState(
    persisted: AnswerValue | null,
    draft: AnswerValue | null,
  ): boolean {
    return !answersEqual(persisted, draft);
  }

  private replaceRoundQuestionFromAssessment(question: RoundQuestionSnapshot): void {
    this.round.update((round) => {
      if (!round) {
        return null;
      }
      return {
        ...round,
        questions: round.questions.map((candidate) =>
          candidate.id === question.id ? question : candidate,
        ),
      };
    });
    this.setAnswerState(question.id, createQuestionAnswerState(question.answer, question.answeredAt));
    this.setAssessmentState(question.id, createQuestionAssessmentState(question));
  }

  private replaceRoundQuestionFromAnswer(question: RoundQuestionSnapshot): void {
    const preserveAssessmentState = this.hasAssessmentWorkToPreserve(question);
    this.round.update((round) => {
      if (!round) {
        return null;
      }
      return {
        ...round,
        questions: round.questions.map((candidate) => {
          if (candidate.id !== question.id) {
            return candidate;
          }
          if (!preserveAssessmentState) {
            return question;
          }
          return {
            ...question,
            checklistStatus: candidate.checklistStatus,
            assessmentRationale: candidate.assessmentRationale,
          };
        }),
      };
    });
    this.setAnswerState(question.id, createQuestionAnswerState(question.answer, question.answeredAt));
    if (!preserveAssessmentState) {
      this.setAssessmentState(question.id, createQuestionAssessmentState(question));
    }
  }

  private setAnswerState(snapshotId: string, state: QuestionAnswerState): void {
    this.answerStates.update((states) => {
      const nextStates = new Map(states);
      nextStates.set(snapshotId, state);
      return nextStates;
    });
  }

  private setAssessmentState(snapshotId: string, state: QuestionAssessmentState): void {
    this.assessmentStates.update((states) => {
      const nextStates = new Map(states);
      nextStates.set(snapshotId, state);
      return nextStates;
    });
  }

  private clearAutosaveTimer(snapshotId: string): void {
    const timerId = this.autosaveTimers.get(snapshotId);
    if (timerId === undefined) {
      return;
    }
    clearTimeout(timerId);
    this.autosaveTimers.delete(snapshotId);
  }

  private addInFlightRequest(snapshotId: string, requestId: number): void {
    const current = this.inFlightRequestIds.get(snapshotId) ?? new Set<number>();
    current.add(requestId);
    this.inFlightRequestIds.set(snapshotId, current);
  }

  private removeInFlightRequest(snapshotId: string, requestId: number): void {
    const current = this.inFlightRequestIds.get(snapshotId);
    if (!current) {
      return;
    }
    current.delete(requestId);
    if (current.size === 0) {
      this.inFlightRequestIds.delete(snapshotId);
      return;
    }
    this.inFlightRequestIds.set(snapshotId, current);
  }

  private hasInFlightRequests(snapshotId: string): boolean {
    return (this.inFlightRequestIds.get(snapshotId)?.size ?? 0) > 0;
  }

  private hasPendingAnswerWork(): boolean {
    return this.autosaveTimers.size > 0 || this.inFlightRequestIds.size > 0;
  }

  private hasAnswerSaveErrors(): boolean {
    return [...this.answerStates().values()].some((state) => state.status === 'error');
  }

  private hasPendingAssessmentWork(): boolean {
    return [...this.assessmentStates().values()].some((state) => state.status === 'saving');
  }

  private hasAssessmentSaveErrors(): boolean {
    return [...this.assessmentStates().values()].some((state) => state.status === 'error');
  }

  private hasAssessmentWorkToPreserve(question: RoundQuestionSnapshot): boolean {
    const state = this.assessmentState(question);
    return (
      state.status !== 'saved' ||
      state.mode !== state.baselineMode ||
      state.rationale !== state.baselineRationale
    );
  }

  private savedStateFor(value: AnswerValue | null): QuestionSaveStatus {
    return value === null ? 'idle' : 'saved';
  }

  private isAnswerEditingLocked(question: RoundQuestionSnapshot): boolean {
    const round = this.round();
    return this.projectArchived() || (round?.status === 'ENDED' && !this.endedEditable()) || this.completing() || !this.answerStates().has(question.id);
  }

  private isAssessmentEditingLocked(question: RoundQuestionSnapshot): boolean {
    const round = this.round();
    return (
      (round?.status === 'ENDED' && !this.endedEditable()) ||
      this.projectArchived() ||
      this.completing() ||
      !this.assessmentStates().has(question.id)
    );
  }

  private hasPersistedValidAnswer(question: RoundQuestionSnapshot): boolean {
    return this.answerState(question).persisted !== null && question.answeredAt !== null;
  }
}

function buildAnswerStates(
  round: InterviewRound | null,
): ReadonlyMap<string, QuestionAnswerState> {
  if (!round) {
    return new Map();
  }

  return new Map(
    round.questions.map((question) => [
      question.id,
      createQuestionAnswerState(question.answer, question.answeredAt),
    ]),
  );
}

function buildAssessmentStates(
  round: InterviewRound | null,
): ReadonlyMap<string, QuestionAssessmentState> {
  if (!round) {
    return new Map();
  }

  return new Map(
    round.questions.map((question) => [question.id, createQuestionAssessmentState(question)]),
  );
}

function createQuestionAnswerState(
  answer: AnswerValue | null,
  answeredAt: string | null,
): QuestionAnswerState {
  return {
    draft: cloneAnswerValue(answer),
    persisted: cloneAnswerValue(answer),
    status: answer !== null || answeredAt !== null ? 'saved' : 'idle',
    error: null,
    latestRequestId: 0,
    latestSubmittedRequestId: null,
  };
}

function createQuestionAssessmentState(question: RoundQuestionSnapshot): QuestionAssessmentState {
  const mode = assessmentModeForSnapshot(question);
  const rationale = question.assessmentRationale ?? '';
  return {
    mode,
    rationale,
    baselineMode: mode,
    baselineRationale: rationale,
    status: 'saved',
    error: null,
  };
}

function assessmentModeForSnapshot(question: RoundQuestionSnapshot): AssessmentMode {
  if (question.checklistStatus === 'Részben megvan') {
    return 'partial';
  }
  if (question.checklistStatus === 'Nem releváns') {
    return 'not-relevant';
  }
  return 'automatic';
}

function isValidAssessmentRationale(rationale: string): boolean {
  return rationale.trim().length > 0;
}

function cloneAnswerValue(value: AnswerValue | null): AnswerValue | null {
  if (Array.isArray(value)) {
    return [...value];
  }

  return value;
}

function answersEqual(
  left: AnswerValue | null,
  right: AnswerValue | null,
): boolean {
  if (Array.isArray(left) && Array.isArray(right)) {
    const sortedLeft = [...left].sort();
    const sortedRight = [...right].sort();
    return (
      sortedLeft.length === sortedRight.length &&
      sortedLeft.every((value, index) => value === sortedRight[index])
    );
  }

  return left === right;
}

function resolveLoadError(error: unknown): string {
  if (isInterviewApiError(error)) {
    return error.message;
  }

  return 'A felmérési oldal nem tölthető be. Frissítsd az oldalt, majd próbáld újra.';
}

function resolveSchemaPublishError(hasExistingSchema: boolean): string {
  if (hasExistingSchema) {
    return 'Nem sikerült frissíteni a projektsémát. Frissítsd az oldalt, ellenőrizd a kiválasztott kérdéseket, majd próbáld újra.';
  }

  return 'Nem sikerült közzétenni a projektsémát. Frissítsd az oldalt, ellenőrizd a kiválasztott kérdéseket, majd próbáld újra.';
}
