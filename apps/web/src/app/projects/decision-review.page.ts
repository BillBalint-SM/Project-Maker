import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import type {
  CreateFormalDecisionInput,
  FormalDecision,
  FormalDecisionOutcome,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';

import { DecisionPortfolioApiService } from './decision-portfolio-api.service';
import { provideProjectOperationPolicy } from './project-operation-policy';
import { ProjectApiService } from './project-api.service';
import { DecisionReviewComponent } from './decision-review/decision-review.component';

@Component({
  selector: 'app-decision-review-page',
  imports: [
    ButtonModule,
    CardModule,
    DatePipe,
    DecisionReviewComponent,
    MessageModule,
    ReactiveFormsModule,
    TextareaModule,
  ],
  providers: [provideProjectOperationPolicy()],
  templateUrl: './decision-review.page.html',
  styleUrl: './decision-review.page.scss',
})
export class DecisionReviewPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(DecisionPortfolioApiService);
  private readonly projects = inject(ProjectApiService);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly decisions = signal<readonly FormalDecision[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly feedback = signal<string | null>(null);
  readonly archived = signal(false);
  readonly outcomeOptions = [
    { value: 'GO' as const, label: 'Mehet' },
    { value: 'CONDITIONAL_GO' as const, label: 'Feltételesen mehet' },
    { value: 'NO_GO' as const, label: 'Nem mehet' },
  ];
  readonly decisionForm = new FormGroup({
    outcome: new FormControl<FormalDecisionOutcome>('GO', { nonNullable: true }),
    decisionDate: new FormControl(today(), { nonNullable: true, validators: [Validators.required] }),
    decisionMaker: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(255)],
    }),
    rationale: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(4_000)],
    }),
    conditions: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(4_000)] }),
    reviewDate: new FormControl('', { nonNullable: true }),
    referenceDecisionReview: new FormControl(true, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.loadDecisions();
    this.projects.loadProjectWorkspace(this.projectId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => this.archived.set(project.status === 'ARCHIVED'),
      error: () => undefined,
    });
  }

  loadDecisions(): void {
    if (!this.projectId) {
      this.error.set('A projekt azonosítója hiányzik az útvonalból.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.decisions(this.projectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (decisions) => {
        this.decisions.set(decisions);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.loading.set(false);
      },
    });
  }

  saveDecision(): void {
    this.decisionForm.markAllAsTouched();
    const value = this.decisionForm.getRawValue();
    if (
      this.decisionForm.invalid ||
      this.saving() ||
      this.archived() ||
      (value.outcome === 'CONDITIONAL_GO' && (!value.conditions.trim() || !value.reviewDate))
    ) return;

    const input: CreateFormalDecisionInput = {
      outcome: value.outcome,
      decisionDate: value.decisionDate,
      decisionMaker: value.decisionMaker.trim(),
      rationale: value.rationale.trim(),
      conditions: value.outcome === 'CONDITIONAL_GO' ? value.conditions.trim() : null,
      reviewDate: value.outcome === 'CONDITIONAL_GO' ? value.reviewDate : null,
      referenceDecisionReview: value.referenceDecisionReview,
    };
    this.saving.set(true);
    this.error.set(null);
    this.feedback.set(null);
    this.api.createDecision(this.projectId, input).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.saving.set(false);
        this.feedback.set('A formális döntés rögzítve lett. A projektet nem módosította automatikusan.');
        this.decisionForm.reset({
          outcome: 'GO',
          decisionDate: today(),
          decisionMaker: '',
          rationale: '',
          conditions: '',
          reviewDate: '',
          referenceDecisionReview: true,
        });
        this.loadDecisions();
      },
      error: (error: Error) => {
        this.error.set(error.message);
        this.saving.set(false);
      },
    });
  }

  decisionLabel(outcome: FormalDecisionOutcome): string {
    return this.outcomeOptions.find((option) => option.value === outcome)?.label ?? outcome;
  }
}

function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
