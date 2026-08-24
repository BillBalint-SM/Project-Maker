import { DOCUMENT } from '@angular/common';
import { afterNextRender, Component, computed, inject, Injector, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { forkJoin } from 'rxjs';
import type {
  BaseQuestion,
  BaseQuestionBank,
  ProjectSchemaQuestionInput,
  QuestionTemplateState,
  QuestionTemplateSummary,
} from '@project-maker/contracts';

import { QuestionBankApiService } from './question-bank-api.service';
import { QuestionTemplateApiService } from './question-template-api.service';

type TemplateStateFilter = 'ALL' | QuestionTemplateState;

interface QuestionGroup {
  readonly topic: string;
  readonly questions: readonly BaseQuestion[];
}

@Component({
  selector: 'app-question-template-page',
  imports: [
    ButtonModule,
    CardModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    TagModule,
  ],
  templateUrl: './question-template.page.html',
  styleUrl: './question-template.page.scss',
})
export class QuestionTemplatePage implements OnInit {
  private readonly api = inject(QuestionTemplateApiService);
  private readonly questionBankApi = inject(QuestionBankApiService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  readonly templates = signal<readonly QuestionTemplateSummary[]>([]);
  readonly bank = signal<BaseQuestionBank | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly editorOpen = signal(false);
  readonly draftQuestions = signal<readonly ProjectSchemaQuestionInput[]>([]);
  readonly searchQuery = signal('');
  readonly projectFilter = signal('ALL');
  readonly stateFilter = signal<TemplateStateFilter>('ALL');
  readonly questionSearch = signal('');
  readonly nameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(255)],
  });

  readonly projectNames = computed(() =>
    [...new Set(this.templates().flatMap((template) => template.assignedProjects.map((item) => item.projectName)))]
      .sort((left, right) => left.localeCompare(right)),
  );
  readonly filteredTemplates = computed(() => {
    const query = normalize(this.searchQuery());
    return this.templates().filter((template) => {
      const matchesText = !query || normalize([
        template.name,
        ...template.assignedProjects.map((item) => item.projectName),
      ].join(' ')).includes(query);
      const matchesProject = this.projectFilter() === 'ALL' ||
        template.assignedProjects.some((item) => item.projectName === this.projectFilter());
      const matchesState = this.stateFilter() === 'ALL' || template.state === this.stateFilter();
      return matchesText && matchesProject && matchesState;
    });
  });
  readonly questionGroups = computed(() => {
    const query = normalize(this.questionSearch());
    const questions = (this.bank()?.questions ?? []).filter(
      (question) => question.active && (!query || normalize(`${question.topic} ${question.text} ${question.stableKey}`).includes(query)),
    );
    const groups = new Map<string, BaseQuestion[]>();
    for (const question of questions) {
      const group = groups.get(question.topic) ?? [];
      group.push(question);
      groups.set(question.topic, group);
    }
    return [...groups.entries()].map(([topic, groupedQuestions]) => ({
      topic,
      questions: groupedQuestions.sort((left, right) => left.order - right.order),
    }));
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    forkJoin({ templates: this.api.list(), bank: this.questionBankApi.loadBaseQuestionBank() }).subscribe({
      next: ({ templates, bank }) => {
        this.templates.set(templates);
        this.bank.set(bank);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  startCreate(): void {
    this.editingId.set(null);
    this.nameControl.setValue('');
    this.draftQuestions.set([]);
    this.openEditor();
  }

  edit(template: QuestionTemplateSummary): void {
    this.editingId.set(template.id);
    this.nameControl.setValue(template.name);
    this.draftQuestions.set(template.draftQuestions);
    this.openEditor();
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.actionError.set(null);
  }

  isSelected(stableKey: string): boolean {
    return this.draftQuestions().some((question) => question.stableKey === stableKey);
  }

  toggleQuestion(question: BaseQuestion, selected: boolean): void {
    if (!selected) {
      this.draftQuestions.update((questions) => questions.filter((item) => item.stableKey !== question.stableKey));
      return;
    }
    this.draftQuestions.update((questions) => [
      ...questions,
      { stableKey: question.stableKey, required: question.required, blocking: question.blocking },
    ]);
  }

  questionFlag(stableKey: string, flag: 'required' | 'blocking'): boolean {
    return this.draftQuestions().find((question) => question.stableKey === stableKey)?.[flag] ?? false;
  }

  setQuestionFlag(stableKey: string, flag: 'required' | 'blocking', value: boolean): void {
    this.draftQuestions.update((questions) => questions.map((question) =>
      question.stableKey === stableKey ? { ...question, [flag]: value } : question,
    ));
  }

  save(): void {
    this.nameControl.markAsTouched();
    if (this.nameControl.invalid || this.draftQuestions().length === 0 || this.saving()) {
      this.actionError.set(
        this.draftQuestions().length === 0
          ? 'Select at least one active Question Bank question.'
          : 'Enter a Question Template name.',
      );
      return;
    }
    const input = { name: this.nameControl.value.trim(), questions: this.orderedDraftQuestions() };
    const id = this.editingId();
    this.saving.set(true);
    this.actionError.set(null);
    const request = id ? this.api.updateDraft(id, input) : this.api.create(input);
    request.subscribe({
      next: (template) => {
        this.replaceTemplate(template);
        this.saving.set(false);
        this.editorOpen.set(false);
        this.feedback.set(id ? 'Question Template draft saved.' : 'Question Template created as a draft.');
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.saving.set(false);
      },
    });
  }

  publish(template: QuestionTemplateSummary): void {
    if (this.saving() || template.unavailableQuestionCount > 0) {
      return;
    }
    this.saving.set(true);
    this.actionError.set(null);
    this.api.publish(template.id).subscribe({
      next: (published) => {
        this.replaceTemplate(published);
        this.saving.set(false);
        this.feedback.set(`Question Template v${published.latestPublishedVersion} published.`);
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.saving.set(false);
      },
    });
  }

  stateLabel(state: QuestionTemplateState): string {
    return state === 'CHANGES_PENDING' ? 'Unpublished changes' : state === 'PUBLISHED' ? 'Published' : 'Draft';
  }

  private openEditor(): void {
    this.actionError.set(null);
    this.feedback.set(null);
    this.questionSearch.set('');
    this.editorOpen.set(true);
    afterNextRender(() => this.document.getElementById('question-template-name')?.focus(), {
      injector: this.injector,
    });
  }

  private orderedDraftQuestions(): readonly ProjectSchemaQuestionInput[] {
    const byKey = new Map(this.draftQuestions().map((question) => [question.stableKey, question]));
    return (this.bank()?.questions ?? [])
      .filter((question) => byKey.has(question.stableKey))
      .map((question) => byKey.get(question.stableKey)!);
  }

  private replaceTemplate(updated: QuestionTemplateSummary): void {
    this.templates.update((templates) => {
      const exists = templates.some((template) => template.id === updated.id);
      const next = exists
        ? templates.map((template) => template.id === updated.id ? updated : template)
        : [updated, ...templates];
      return [...next].sort((left, right) => left.name.localeCompare(right.name));
    });
  }
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase();
}
