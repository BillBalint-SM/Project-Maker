import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
  InterviewRound,
  InterviewRoundType,
  ProjectQuestionSchema,
  PublishProjectQuestionSchemaInput,
  RoundQuestionSnapshot,
} from '@project-maker/contracts';
import { interviewRoundTypes } from '@project-maker/contracts';

import { InterviewApiService } from './interview-api.service';
import { QuestionBankApiService } from '../settings/question-bank-api.service';

interface RoundTypeOption {
  readonly label: string;
  readonly value: InterviewRoundType;
}

const roundTypeOptions: readonly RoundTypeOption[] = interviewRoundTypes.map((value) => ({
  value,
  label: value.replaceAll('_', ' '),
}));

@Component({
  selector: 'app-interview-page',
  imports: [
    ButtonModule,
    CardModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    TagModule,
  ],
  templateUrl: './interview.page.html',
  styleUrl: './interview.page.scss',
})
export class InterviewPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly questionBankApi = inject(QuestionBankApiService);
  private readonly interviewApi = inject(InterviewApiService);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly roundTypeOptions = roundTypeOptions;
  readonly roundType = new FormControl<InterviewRoundType>('INITIAL_INTAKE', {
    nonNullable: true,
  });
  readonly bank = signal<BaseQuestionBank | null>(null);
  readonly schema = signal<ProjectQuestionSchema | null>(null);
  readonly selectedKeys = signal<readonly string[]>([]);
  readonly round = signal<InterviewRound | null>(null);
  readonly drafts = signal<ReadonlyMap<string, AnswerValue | null>>(new Map());
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly schemaSaving = signal(false);
  readonly roundSaving = signal(false);
  readonly answerSavingId = signal<string | null>(null);
  readonly completing = signal(false);

  ngOnInit(): void {
    this.loadInterviewData();
  }

  loadInterviewData(): void {
    if (!this.projectId) {
      this.loadError.set(
        'The interview URL is missing a project ID. Return to the project cockpit and open the interview again.',
      );
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);
    this.actionError.set(null);
    forkJoin({
      bank: this.questionBankApi.loadBaseQuestionBank(),
      schema: this.questionBankApi.loadProjectSchema(this.projectId),
    }).subscribe({
      next: ({ bank, schema }) => {
        this.bank.set(bank);
        this.schema.set(schema);
        const activeKeys = new Set(
          bank.questions
            .filter((question) => question.active)
            .map((question) => question.stableKey),
        );
        this.selectedKeys.set(
          schema?.questions
            .map((question) => question.stableKey)
            .filter((stableKey) => activeKeys.has(stableKey)) ??
            bank.questions.filter((question) => question.active).map((question) => question.stableKey),
        );
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  activeQuestions(): readonly BaseQuestion[] {
    return this.bank()?.questions.filter((question) => question.active) ?? [];
  }

  isSelected(stableKey: string): boolean {
    return this.selectedKeys().includes(stableKey);
  }

  setSelected(stableKey: string, checked: boolean): void {
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
    if (this.schemaSaving()) {
      return;
    }
    if (this.selectedCount() === 0) {
      this.actionError.set('Select at least one active base question before publishing a schema.');
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
    const request = this.schema()
      ? this.questionBankApi.updateProjectSchema(this.projectId, input)
      : this.questionBankApi.createProjectSchema(this.projectId, input);
    request.subscribe({
      next: (schema) => {
        this.schema.set(schema);
        this.selectedKeys.set(schema.questions.map((question) => question.stableKey));
        this.schemaSaving.set(false);
        this.feedback.set(
          this.schema()?.schemaVersion === 1
            ? 'Project interview schema published.'
            : 'Project interview schema updated.',
        );
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.schemaSaving.set(false);
      },
    });
  }

  setRoundType(type: InterviewRoundType): void {
    this.roundType.setValue(type);
  }

  createRound(): void {
    if (this.roundSaving() || this.schema() === null) {
      if (this.schema() === null) {
        this.actionError.set('Publish a project question schema before starting a round.');
      }
      return;
    }

    this.roundSaving.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.interviewApi.createRound(this.projectId, { type: this.roundType.value }).subscribe({
      next: (round) => {
        this.round.set(round);
        this.drafts.set(new Map());
        this.roundSaving.set(false);
        this.feedback.set('Interview round created.');
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.roundSaving.set(false);
      },
    });
  }

  currentAnswer(question: RoundQuestionSnapshot): AnswerValue | null {
    const drafts = this.drafts();
    if (drafts.has(question.id)) {
      return drafts.get(question.id) ?? null;
    }
    return question.answer;
  }

  setDraft(snapshotId: string, value: AnswerValue | null): void {
    if (this.answerSavingId() !== null || this.completing()) {
      return;
    }
    const next = new Map(this.drafts());
    next.set(snapshotId, value);
    this.drafts.set(next);
  }

  setTextDraft(snapshotId: string, value: string): void {
    this.setDraft(snapshotId, value.trim().length > 0 ? value : null);
  }

  setSingleSelectDraft(snapshotId: string, value: string): void {
    this.setDraft(snapshotId, value.length > 0 ? value : null);
  }

  setNumberDraft(snapshotId: string, value: string): void {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      this.setDraft(snapshotId, null);
      return;
    }
    const parsed = Number(trimmed);
    this.setDraft(snapshotId, Number.isFinite(parsed) ? parsed : null);
  }

  setMultiSelectDraft(
    question: RoundQuestionSnapshot,
    option: string,
    checked: boolean,
  ): void {
    const current = this.currentAnswer(question);
    const selections: string[] = Array.isArray(current) ? [...(current as readonly string[])] : [];
    const existingIndex = selections.indexOf(option);
    if (checked && existingIndex < 0) {
      selections.push(option);
    } else if (!checked && existingIndex >= 0) {
      selections.splice(existingIndex, 1);
    }
    this.setDraft(question.id, selections.length > 0 ? selections : null);
  }

  hasSelectedOption(question: RoundQuestionSnapshot, option: string): boolean {
    const answer = this.currentAnswer(question);
    return Array.isArray(answer) && (answer as readonly string[]).includes(option);
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

  saveAnswer(question: RoundQuestionSnapshot): void {
    const round = this.round();
    if (
      !round ||
      round.status === 'COMPLETED' ||
      this.answerSavingId() !== null ||
      this.completing()
    ) {
      return;
    }

    this.answerSavingId.set(question.id);
    this.actionError.set(null);
    this.feedback.set(null);
    this.interviewApi
      .updateAnswer(this.projectId, round.id, question.id, {
        value: this.currentAnswer(question),
      })
      .subscribe({
        next: (savedQuestion) => {
          this.replaceRoundQuestion(savedQuestion);
          const next = new Map(this.drafts());
          next.delete(question.id);
          this.drafts.set(next);
          this.answerSavingId.set(null);
          this.feedback.set('Answer saved.');
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
          this.answerSavingId.set(null);
        },
      });
  }

  completeRound(): void {
    const round = this.round();
    if (
      !round ||
      round.status === 'COMPLETED' ||
      this.answerSavingId() !== null ||
      this.completing()
    ) {
      return;
    }

    this.completing.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.interviewApi.completeRound(this.projectId, round.id).subscribe({
      next: (completedRound) => {
        this.round.set(completedRound);
        this.drafts.set(new Map());
        this.completing.set(false);
        this.feedback.set('Interview round completed.');
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.completing.set(false);
      },
    });
  }

  private replaceRoundQuestion(question: RoundQuestionSnapshot): void {
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
  }
}
