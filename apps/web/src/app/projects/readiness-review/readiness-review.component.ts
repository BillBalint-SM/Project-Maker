import { ViewportScroller } from '@angular/common';
import {
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import type {
  AvailableProjectReadiness,
  ProjectReadiness,
  UnavailableProjectReadiness,
} from '@project-maker/contracts';

import { ReadinessReviewApiService } from './readiness-review-api.service';

@Component({
  selector: 'app-readiness-review',
  standalone: true,
  imports: [ButtonModule, CardModule, ProgressSpinnerModule],
  providers: [ReadinessReviewApiService],
  templateUrl: './readiness-review.component.html',
  styleUrl: './readiness-review.component.scss',
})
export class ReadinessReviewComponent {
  readonly projectId = input.required<string>();
  readonly refreshKey = input.required<number>();
  readonly dedicatedPage = input(false);

  private readonly api = inject(ReadinessReviewApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);
  private requestToken = 0;

  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly available = signal<AvailableProjectReadiness | null>(null);
  readonly unavailable = signal<UnavailableProjectReadiness | null>(null);

  constructor() {
    effect(() => {
      const projectId = this.projectId();
      this.refreshKey();
      this.loadReadiness(projectId);
    });
  }

  retry(): void {
    this.loadReadiness(this.projectId());
  }

  scrollToWorkspace(): void {
    if (this.dedicatedPage()) {
      void this.router.navigate(['/projects', this.projectId()], { fragment: 'workspace' });
      return;
    }
    this.viewportScroller.scrollToAnchor('workspace');
  }

  openChecklistGap(snapshotId: string | null): void {
    if (!snapshotId) {
      throw new Error('Az ellenőrzőlista-hiányhoz nem érkezett kérdésazonosító.');
    }

    void this.router.navigate(
      ['/projects', this.projectId(), 'interview'],
      { fragment: 'round-question-' + snapshotId },
    );
  }

  scrollToDiscoveryFollowUps(): void {
    if (this.dedicatedPage()) {
      void this.router.navigate(['/projects', this.projectId()], {
        fragment: 'discovery-follow-ups',
      });
      return;
    }
    this.viewportScroller.scrollToAnchor('discovery-follow-ups');
  }

  private loadReadiness(projectId: string): void {
    const requestToken = ++this.requestToken;
    this.loading.set(true);
    this.loadError.set(null);
    this.available.set(null);
    this.unavailable.set(null);

    this.api
      .load(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (readiness: ProjectReadiness) => {
          if (requestToken !== this.requestToken) {
            return;
          }

          if (readiness.available) {
            this.available.set(readiness);
          } else {
            this.unavailable.set(readiness);
          }
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
}
