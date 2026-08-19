import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { OpenDiscoveryFollowUpQueueItem } from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { catchError, map, of, startWith, Subject, switchMap, tap } from 'rxjs';

import { DiscoveryFollowUpsApiService } from './discovery-follow-ups/discovery-follow-ups-api.service';
import { discoveryFollowUpCategoryLabel } from './discovery-follow-ups/discovery-follow-up-label';

@Component({
  selector: 'app-open-discovery-follow-ups-page',
  imports: [ButtonModule, DatePipe, ProgressSpinnerModule, RouterLink, TagModule],
  templateUrl: './open-discovery-follow-ups.page.html',
  styleUrl: './open-discovery-follow-ups.page.scss',
})
export class OpenDiscoveryFollowUpsPage implements OnInit {
  private readonly api = inject(DiscoveryFollowUpsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requestedLoads = new Subject<void>();
  private retryRequested = false;

  readonly items = signal<readonly OpenDiscoveryFollowUpQueueItem[] | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly liveStatus = signal<string | null>(null);
  readonly projectQueryParams = { returnTo: '/follow-ups' } as const;

  ngOnInit(): void {
    this.requestedLoads
      .pipe(
        startWith(undefined),
        tap(() => {
          this.loading.set(true);
          this.loadError.set(null);
        }),
        switchMap(() =>
          this.api.listOpen().pipe(
            map((items) => ({ items, error: null })),
            catchError((error: unknown) =>
              of({
                items: null,
                error:
                  error instanceof Error
                    ? error.message
                    : 'Az utánkövetések nem tölthetők be. Próbáld meg újra.',
              }),
            ),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ items, error }) => {
        if (items) {
          this.items.set(items);
          this.loadError.set(null);
          if (this.retryRequested) {
            this.liveStatus.set('Az utánkövetések ismét elérhetők.');
          }
        } else {
          this.loadError.set(error);
        }
        this.retryRequested = false;
        this.loading.set(false);
      });
  }

  retry(): void {
    this.retryRequested = true;
    this.liveStatus.set(null);
    this.requestedLoads.next();
  }

  readonly categoryLabel = discoveryFollowUpCategoryLabel;
}
