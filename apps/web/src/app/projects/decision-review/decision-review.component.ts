import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import type {
  DecisionReviewInputKey,
  ProjectDecisionReview,
  UpdateDecisionReviewInput,
} from '@project-maker/contracts';
import { finalize } from 'rxjs';

import { ProjectCommandPending } from '../project-command-pending';
import { DecisionReviewApiService } from './decision-review-api.service';

const ratingLabels: Readonly<Record<DecisionReviewInputKey, string>> = {
  businessValue: 'Business value',
  strategicAlignment: 'Strategic alignment',
  urgency: 'Urgency',
  confidence: 'Confidence',
  complexity: 'Complexity',
  risk: 'Risk',
};

const recommendationLabels: Readonly<Record<string, string>> = {
  CLARIFICATION_REQUIRED: 'Clarification required',
  ESTIMATE_PREPARATION_POSSIBLE: 'Ready to prepare an estimate',
  ESTIMATE_READY: 'Ready for estimation',
};

const ratingAnchors: Readonly<Record<number, string>> = {
  1: 'Low',
  3: 'Medium',
  5: 'High',
};

@Component({
  selector: 'app-decision-review',
  standalone: true,
  imports: [ButtonModule, CardModule, ProgressSpinnerModule, ReactiveFormsModule],
  providers: [DecisionReviewApiService],
  templateUrl: './decision-review.component.html',
  styleUrl: './decision-review.component.scss',
})
export class DecisionReviewComponent {
  readonly projectId = input.required<string>();
  readonly refreshKey = input.required<number>();
  readonly ratingLabels = ratingLabels;
  readonly recommendationLabels = recommendationLabels;
  readonly ratingOptionLabel = (rating: number): string => {
    const anchor = ratingAnchors[rating];
    return anchor ? `${rating} — ${anchor}` : String(rating);
  };

  private readonly api = inject(DecisionReviewApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly pending = new ProjectCommandPending();
  private requestToken = 0;

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly saveError = signal<string | null>(null);
  readonly review = signal<ProjectDecisionReview | null>(null);
  readonly ratingOptions = computed(() => {
    const scale = this.review()?.ratingScale;
    if (!scale) {
      return [];
    }
    return Array.from(
      { length: scale.maximum - scale.minimum + 1 },
      (_, index) => scale.minimum + index,
    );
  });
  readonly ratingForm = new FormGroup({
    businessValue: new FormControl<number | null>(null),
    strategicAlignment: new FormControl<number | null>(null),
    urgency: new FormControl<number | null>(null),
    confidence: new FormControl<number | null>(null),
    complexity: new FormControl<number | null>(null),
    risk: new FormControl<number | null>(null),
  });

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      this.refreshKey();
      this.load(projectId);
    });
  }

  retry(): void {
    this.load(this.projectId());
  }

  save(): void {
    const review = this.review();
    if (!review || !review.editable || this.saving()) {
      return;
    }
    if (!this.pending.begin('save')) return;

    this.saving.set(true);
    this.saveError.set(null);
    this.api
      .save(this.projectId(), this.ratingForm.getRawValue() as UpdateDecisionReviewInput)
      .pipe(
        finalize(() => this.pending.end('save')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.review.set(updated);
          this.setInputs(updated);
          this.saving.set(false);
        },
        error: (error: Error) => {
          this.saveError.set(error.message);
          this.saving.set(false);
        },
      });
  }

  private load(projectId: string): void {
    const requestToken = ++this.requestToken;
    this.loading.set(true);
    this.loadError.set(null);
    this.saveError.set(null);
    this.api
      .load(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (review) => {
          if (requestToken !== this.requestToken) {
            return;
          }
          this.review.set(review);
          this.setInputs(review);
          this.loading.set(false);
        },
        error: (error: Error) => {
          if (requestToken !== this.requestToken) {
            return;
          }
          this.loadError.set(error.message);
          this.loading.set(false);
        },
      });
  }

  private setInputs(review: ProjectDecisionReview): void {
    this.ratingForm.reset(review.inputs, { emitEvent: false });
  }
}
