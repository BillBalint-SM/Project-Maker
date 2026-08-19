import { Component, inject, OnInit, signal } from '@angular/core';
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
import type {
  BaseQuestion,
  BaseQuestionBank,
  BaseQuestionType,
  CreateBaseQuestionInput,
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

@Component({
  selector: 'app-question-bank-page',
  imports: [
    ButtonModule,
    CardModule,
    MessageModule,
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

  readonly questionTypes = baseQuestionTypeOptions;
  readonly questionTypeLabel = baseQuestionTypeLabel;
  readonly bank = signal<BaseQuestionBank | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly saving = signal(false);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);

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
    this.api.loadBaseQuestionBank().subscribe({
      next: (bank) => {
        this.bank.set(bank);
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
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.actionError.set(null);
    this.resetForm(null, (this.bank()?.questions.length ?? 0) + 1);
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
      this.actionError.set('A választós kérdéshez legalább egy válaszlehetőség szükséges.');
      return;
    }
    if (new Set(options).size !== options.length) {
      this.actionError.set('Egy válaszlehetőség csak egyszer szerepelhet.');
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
        this.feedback.set(editingId ? 'Az alapkérdés módosításai mentve.' : 'Az alapkérdés létrejött.');
        this.showForm.set(false);
        this.editingId.set(null);
        this.resetForm(null, bank.questions.length + 1);
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.saving.set(false);
      },
    });
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
