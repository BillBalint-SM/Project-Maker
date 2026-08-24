import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import { afterNextRender, Component, computed, inject, Injector, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import type {
  BaseQuestion,
  BaseQuestionBank,
  BaseQuestionType,
  CreateBaseQuestionInput,
  PackagedPlaybookSummary,
  UpdateBaseQuestionInput,
} from '@project-maker/contracts';

import {
  baseQuestionTypeLabel,
  baseQuestionTypeOptions,
} from '../base-question-type-label';
import { QuestionBankApiService } from './question-bank-api.service';

type QuestionFormControls = {
  stableKey: FormControl<string>;
  topic: FormControl<string>;
  controlPoint: FormControl<string>;
  text: FormControl<string>;
  type: FormControl<BaseQuestionType>;
  required: FormControl<boolean>;
  requiredForEstimate: FormControl<boolean>;
  blocking: FormControl<boolean>;
  order: FormControl<number>;
  active: FormControl<boolean>;
  hint: FormControl<string>;
  options: FormControl<string>;
};

type QuestionStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface QuestionTopicGroup {
  readonly topic: string;
  readonly questions: readonly BaseQuestion[];
}

interface QuestionPlaybookGroup {
  readonly id: string;
  readonly name: string;
  readonly topics: readonly QuestionTopicGroup[];
}

@Component({
  selector: 'app-question-bank-page',
  imports: [
    ButtonModule,
    CardModule,
    MessageModule,
    NgTemplateOutlet,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    SelectModule,
    TagModule,
  ],
  templateUrl: './question-bank.page.html',
  styleUrl: './question-bank.page.scss',
})
export class QuestionBankPage implements OnInit {
  private readonly api = inject(QuestionBankApiService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  readonly questionTypes = baseQuestionTypeOptions;
  readonly questionTypeLabel = baseQuestionTypeLabel;
  readonly bank = signal<BaseQuestionBank | null>(null);
  readonly playbooks = signal<readonly PackagedPlaybookSummary[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly referenceSavingId = signal<string | null>(null);
  readonly selectedReferenceFiles = signal<ReadonlyMap<string, File>>(new Map());
  readonly searchQuery = signal('');
  readonly statusFilter = signal<QuestionStatusFilter>('ALL');
  readonly playbookFilter = signal('ALL');
  readonly filteredQuestions = computed(() => {
    const search = normalizeSearch(this.searchQuery());
    return (this.bank()?.questions ?? []).filter((question) => {
      const matchesStatus =
        this.statusFilter() === 'ALL' ||
        (this.statusFilter() === 'ACTIVE' ? question.active : !question.active);
      const playbook = playbookForQuestion(question, this.playbooks());
      const matchesPlaybook =
        this.playbookFilter() === 'ALL' || playbook.id === this.playbookFilter();
      const matchesSearch = search.length === 0 || questionSearchText(question).includes(search);
      return matchesStatus && matchesPlaybook && matchesSearch;
    });
  });
  readonly questionGroups = computed(() =>
    buildQuestionGroups(this.filteredQuestions(), this.playbooks()),
  );
  readonly statusCounts = computed(() => {
    const questions = this.bank()?.questions ?? [];
    return {
      ALL: questions.length,
      ACTIVE: questions.filter((question) => question.active).length,
      INACTIVE: questions.filter((question) => !question.active).length,
    };
  });

  readonly questionForm = new FormGroup<QuestionFormControls>({
    stableKey: new FormControl('', {
      nonNullable: true,
      validators: [
        nonBlankValidator,
        Validators.required,
        Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        Validators.maxLength(100),
      ],
    }),
    topic: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator, Validators.maxLength(255)],
    }),
    controlPoint: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator],
    }),
    text: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator],
    }),
    type: new FormControl<BaseQuestionType>('TEXT', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    required: new FormControl(true, { nonNullable: true }),
    requiredForEstimate: new FormControl(false, { nonNullable: true }),
    blocking: new FormControl(false, { nonNullable: true }),
    order: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)],
    }),
    active: new FormControl(true, { nonNullable: true }),
    hint: new FormControl('', { nonNullable: true }),
    options: new FormControl('', { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loadBank();
  }

  loadBank(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.actionError.set(null);
    forkJoin({ bank: this.api.loadBaseQuestionBank(), playbooks: this.api.loadPlaybooks() }).subscribe({
      next: ({ bank, playbooks }) => {
        this.bank.set(bank);
        this.playbooks.set(playbooks);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  openCreateForm(): void {
    const nextOrder = (this.bank()?.questions.length ?? 0) + 1;
    this.editingId.set(null);
    this.showForm.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.resetForm(null, nextOrder);
  }

  editQuestion(question: BaseQuestion): void {
    this.editingId.set(question.id);
    this.showForm.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.resetForm(question, question.order);
    afterNextRender(() => this.document.getElementById('question-text')?.focus(), {
      injector: this.injector,
    });
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  setStatusFilter(filter: QuestionStatusFilter): void {
    this.statusFilter.set(filter);
  }

  setPlaybookFilter(value: string): void {
    this.playbookFilter.set(value);
  }

  clearBrowserFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('ALL');
    this.playbookFilter.set('ALL');
  }

  isEditingQuestion(questionId: string): boolean {
    return this.editingId() === questionId;
  }

  cancelForm(): void {
    const editingId = this.editingId();
    this.showForm.set(false);
    this.editingId.set(null);
    this.actionError.set(null);
    this.resetForm(null, (this.bank()?.questions.length ?? 0) + 1);
    if (editingId) {
      this.focusEditButtonAfterNextRender(editingId);
    }
  }

  isEditing(): boolean {
    return this.editingId() !== null;
  }

  isSelectType(): boolean {
    const type = this.questionForm.controls.type.value;
    return type === 'SINGLE_SELECT' || type === 'MULTI_SELECT';
  }

  handleTypeChange(): void {
    if (!this.isSelectType()) {
      this.questionForm.controls.options.setValue('');
    }
  }

  saveQuestion(): void {
    this.questionForm.markAllAsTouched();
    this.actionError.set(null);
    if (this.questionForm.invalid || this.saving()) {
      return;
    }

    const value = this.questionForm.getRawValue();
    const options = parseOptions(value.options);
    if (isSelectType(value.type) && options.length === 0) {
      this.actionError.set('Select-type questions require at least one response option.');
      return;
    }
    if (new Set(options).size !== options.length) {
      this.actionError.set('Each response option may be used only once.');
      return;
    }

    this.saving.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    const editingId = this.editingId();
    const request = editingId
      ? this.api.updateBaseQuestion({
          id: editingId,
          topic: value.topic.trim(),
          controlPoint: value.controlPoint.trim(),
          text: value.text.trim(),
          type: value.type,
          required: value.required,
          requiredForEstimate: value.requiredForEstimate,
          blocking: value.blocking,
          order: value.order,
          active: value.active,
          hint: nullableText(value.hint),
          options: isSelectType(value.type) ? options : null,
        } satisfies UpdateBaseQuestionInput)
      : this.api.createBaseQuestion({
          stableKey: value.stableKey.trim(),
          topic: value.topic.trim(),
          controlPoint: value.controlPoint.trim(),
          text: value.text.trim(),
          type: value.type,
          required: value.required,
          requiredForEstimate: value.requiredForEstimate,
          blocking: value.blocking,
          order: value.order,
          active: value.active,
          hint: nullableText(value.hint),
          options: isSelectType(value.type) ? options : null,
        } satisfies CreateBaseQuestionInput);

    request.subscribe({
      next: (bank) => {
        this.bank.set(bank);
        this.saving.set(false);
        this.feedback.set(editingId ? 'Base question changes saved.' : 'Base question created.');
        this.showForm.set(false);
        this.editingId.set(null);
        this.resetForm(null, bank.questions.length + 1);
        if (editingId) {
          this.focusEditButtonAfterNextRender(editingId);
        }
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.saving.set(false);
      },
    });
  }

  chooseReferenceFile(questionId: string, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.selectedReferenceFiles.update((current) => {
      const next = new Map(current);
      if (file) next.set(questionId, file);
      else next.delete(questionId);
      return next;
    });
    this.actionError.set(null);
    this.feedback.set(null);
  }

  selectedReferenceFile(questionId: string): File | null {
    return this.selectedReferenceFiles().get(questionId) ?? null;
  }

  addReferenceFile(question: BaseQuestion): void {
    const file = this.selectedReferenceFile(question.id);
    if (!file || this.referenceSavingId() !== null) return;
    this.referenceSavingId.set(question.id);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.addReferenceFile(question.id, file).subscribe({
      next: (bank) => {
        this.bank.set(bank);
        this.selectedReferenceFiles.set(new Map());
        this.referenceSavingId.set(null);
        this.feedback.set('Reference file added in a new Question Bank version.');
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.referenceSavingId.set(null);
      },
    });
  }

  removeReferenceFile(question: BaseQuestion, fileId: string, originalName: string): void {
    if (
      this.referenceSavingId() !== null ||
      !this.document.defaultView?.confirm(`Remove reference file “${originalName}”?`)
    ) {
      return;
    }
    this.referenceSavingId.set(question.id);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.removeReferenceFile(question.id, fileId).subscribe({
      next: (bank) => {
        this.bank.set(bank);
        this.referenceSavingId.set(null);
        this.feedback.set('Reference file removed in a new Question Bank version.');
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.referenceSavingId.set(null);
      },
    });
  }

  referenceFileUrl(questionId: string, fileId: string): string {
    return this.api.referenceFileDownloadUrl(questionId, fileId);
  }

  private resetForm(question: BaseQuestion | null, order: number): void {
    this.questionForm.reset({
      stableKey: question?.stableKey ?? '',
      topic: question?.topic ?? '',
      controlPoint: question?.controlPoint ?? '',
      text: question?.text ?? '',
      type: question?.type ?? 'TEXT',
      required: question?.required ?? true,
      requiredForEstimate: question?.requiredForEstimate ?? false,
      blocking: question?.blocking ?? false,
      order,
      active: question?.active ?? true,
      hint: question?.hint ?? '',
      options: question?.options?.join('\n') ?? '',
    });
    if (question) {
      this.questionForm.controls.stableKey.disable();
    } else {
      this.questionForm.controls.stableKey.enable();
    }
  }

  private focusEditButtonAfterNextRender(questionId: string): void {
    afterNextRender(
      () => {
        const host = this.document.querySelector(
          `[data-testid="edit-base-question-${questionId}"]`,
        );
        host?.querySelector('button')?.focus();
      },
      { injector: this.injector },
    );
  }
}

function isSelectType(type: BaseQuestionType): boolean {
  return type === 'SINGLE_SELECT' || type === 'MULTI_SELECT';
}

function parseOptions(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((option) => option.trim())
    .filter((option) => option.length > 0);
}

function nullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nonBlankValidator(control: AbstractControl<unknown>): ValidationErrors | null {
  return typeof control.value === 'string' && control.value.trim().length > 0
    ? null
    : { nonBlank: true };
}

function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .trim();
}

function questionSearchText(question: BaseQuestion): string {
  return normalizeSearch(
    [
      question.stableKey,
      question.topic,
      question.controlPoint,
      question.text,
      question.hint ?? '',
      ...(question.options ?? []),
      ...question.referenceFiles.map((file) => file.originalName),
    ].join(' '),
  );
}

function playbookForQuestion(
  question: BaseQuestion,
  playbooks: readonly PackagedPlaybookSummary[],
): Pick<PackagedPlaybookSummary, 'id' | 'name'> {
  return (
    [...playbooks]
      .sort((left, right) => right.id.length - left.id.length)
      .find((playbook) => question.stableKey.startsWith(`${playbook.id}-`)) ?? {
      id: 'UNASSIGNED',
      name: 'Unassigned',
    }
  );
}

function buildQuestionGroups(
  questions: readonly BaseQuestion[],
  playbooks: readonly PackagedPlaybookSummary[],
): readonly QuestionPlaybookGroup[] {
  const groups = new Map<string, { name: string; topics: Map<string, BaseQuestion[]> }>();
  for (const question of questions) {
    const playbook = playbookForQuestion(question, playbooks);
    const group = groups.get(playbook.id) ?? { name: playbook.name, topics: new Map() };
    const topicQuestions = group.topics.get(question.topic) ?? [];
    topicQuestions.push(question);
    group.topics.set(question.topic, topicQuestions);
    groups.set(playbook.id, group);
  }

  return [...groups.entries()].map(([id, group]) => ({
    id,
    name: group.name,
    topics: [...group.topics.entries()].map(([topic, topicQuestions]) => ({
      topic,
      questions: topicQuestions,
    })),
  }));
}
