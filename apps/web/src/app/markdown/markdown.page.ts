import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import type {
  CreateMarkdownRevisionInput,
  MarkdownGenerationConfiguration,
  MarkdownRevision,
  MarkdownRevisionSummary,
  MarkdownRevisionReason,
} from '@project-maker/contracts';
import { markdownRevisionReasons } from '@project-maker/contracts';

import { MarkdownApiService } from './markdown-api.service';

interface ReasonOption {
  readonly label: string;
  readonly value: MarkdownRevisionReason;
}

const reasonOptions: readonly ReasonOption[] = markdownRevisionReasons.map((value) => ({
  label: value === 'MANUAL' ? 'Manual generation' : 'Milestone reached',
  value,
}));

@Component({
  selector: 'app-markdown-page',
  imports: [
    ButtonModule,
    CardModule,
    DatePipe,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    TagModule,
  ],
  templateUrl: './markdown.page.html',
  styleUrl: './markdown.page.scss',
})
export class MarkdownPage implements OnInit {
  private readonly api = inject(MarkdownApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly reasonOptions = reasonOptions;
  readonly generationForm = new FormGroup({
    templateId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    reason: new FormControl<MarkdownRevisionReason>('MANUAL', {
      nonNullable: true,
    }),
    milestone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(255)],
    }),
  });
  readonly revisions = signal<readonly MarkdownRevisionSummary[]>([]);
  readonly configuration = signal<MarkdownGenerationConfiguration | null>(null);
  readonly selectedRevision = signal<MarkdownRevision | null>(null);
  readonly loading = signal(true);
  readonly detailLoading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly detailError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly generating = signal(false);

  private requestedRevisionId: string | null = null;
  private loadingRevisionId: string | null = null;
  private retryRevisionId: string | null = null;

  ngOnInit(): void {
    this.syncMilestoneValidators();
    this.generationForm.controls.reason.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncMilestoneValidators());
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        this.requestedRevisionId = params.get('revision');
        if (!this.loading() && this.revisions().length > 0) {
          this.selectRevision(this.requestedRevisionId);
        }
      });
    this.loadRevisions();
    this.loadConfiguration();
  }

  loadConfiguration(): void {
    this.api.loadConfiguration(this.projectId).subscribe({
      next: (configuration) => {
        this.configuration.set(configuration);
        this.generationForm.controls.templateId.setValue(configuration.selectedTemplateId);
      },
      error: (error: unknown) => this.actionError.set(errorMessage(error, 'load the specification templates')),
    });
  }

  loadRevisions(): void {
    if (!this.projectId) {
      this.loadError.set(
        'The Project Specification URL is missing the project identifier. Return to Project Status and reopen the Project Specification.',
      );
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);
    this.detailError.set(null);
    this.api.listRevisions(this.projectId).subscribe({
      next: (revisions) => {
        const latestFirst = [...revisions].sort(
          (left, right) => right.version - left.version,
        );
        this.revisions.set(latestFirst);
        this.loading.set(false);
        if (latestFirst.length === 0) {
          this.selectedRevision.set(null);
          this.retryRevisionId = null;
          return;
        }
        this.selectRevision(this.requestedRevisionId);
      },
      error: (error: unknown) => {
        this.loadError.set(errorMessage(error, 'load the specification versions'));
        this.loading.set(false);
      },
    });
  }

  generateRevision(): void {
    this.generationForm.markAllAsTouched();
    if (this.generating() || this.generationForm.invalid) {
      return;
    }

    const value = this.generationForm.getRawValue();
    const milestone = value.milestone.trim();
    if (value.reason === 'MILESTONE' && milestone.length === 0) {
      this.actionError.set('Enter the milestone name before generating a milestone version.');
      return;
    }

    const input: CreateMarkdownRevisionInput = {
      reason: value.reason,
      milestone: value.reason === 'MILESTONE' ? milestone : null,
      templateId: value.templateId,
    };
    this.generating.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.createRevision(this.projectId, input).subscribe({
      next: (revision) => {
        this.requestedRevisionId = revision.id;
        this.generating.set(false);
        this.feedback.set(`Specification version v${revision.version} has been created.`);
        this.generationForm.controls.milestone.reset('');
        this.loadConfiguration();
        this.loadRevisions();
      },
      error: (error: unknown) => {
        this.actionError.set(errorMessage(error, 'generate the specification version'));
        this.generating.set(false);
      },
    });
  }

  retryRevision(): void {
    if (this.retryRevisionId) {
      this.loadRevision(this.retryRevisionId);
    }
  }

  downloadUrl(revision: MarkdownRevision): string {
    return this.api.downloadUrl(this.projectId, revision.id);
  }

  isSelected(revisionId: string): boolean {
    return this.selectedRevision()?.id === revisionId;
  }

  reasonLabel(reason: MarkdownRevisionReason): string {
    return reasonOptions.find((option) => option.value === reason)?.label ?? reason;
  }

  private selectRevision(requestedRevisionId: string | null): void {
    const candidate =
      (requestedRevisionId
        ? this.revisions().find((revision) => revision.id === requestedRevisionId)
        : null) ?? this.revisions()[0];
    if (!candidate) {
      this.selectedRevision.set(null);
      return;
    }
    if (
      this.selectedRevision()?.id === candidate.id ||
      this.loadingRevisionId === candidate.id
    ) {
      return;
    }
    this.loadRevision(candidate.id);
  }

  private loadRevision(revisionId: string): void {
    this.loadingRevisionId = revisionId;
    this.retryRevisionId = revisionId;
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.api.loadRevision(this.projectId, revisionId).subscribe({
      next: (revision) => {
        this.selectedRevision.set(revision);
        this.loadingRevisionId = null;
        this.detailLoading.set(false);
      },
      error: (error: unknown) => {
        this.selectedRevision.set(null);
        this.loadingRevisionId = null;
        this.detailLoading.set(false);
        this.detailError.set(errorMessage(error, 'load the specification version'));
      },
    });
  }

  private syncMilestoneValidators(): void {
    const milestone = this.generationForm.controls.milestone;
    const validators =
      this.generationForm.controls.reason.value === 'MILESTONE'
        ? [Validators.required, Validators.maxLength(255)]
        : [Validators.maxLength(255)];
    milestone.setValidators(validators);
    milestone.updateValueAndValidity({ emitEvent: false });
  }
}

function errorMessage(error: unknown, action: string): string {
  if (error instanceof Error) {
    return error.message;
  }
  return `Unable to ${action}. Refresh the page and try again.`;
}
