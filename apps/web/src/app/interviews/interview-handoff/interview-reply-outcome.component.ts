import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import type { CustomerCorrespondenceView } from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';

import { InterviewHandoffApiService } from './interview-handoff-api.service';

@Component({
  selector: 'app-interview-reply-outcome',
  imports: [ButtonModule],
  template: `
    @if (offersRevision()) {
      <button pButton type="button" class="p-button-outlined"
        [disabled]="busy() || projectArchived()"
        [attr.data-testid]="'start-handoff-revision-' + correspondence().id"
        (click)="startRevision()">Új összefoglaló-verzió készítése</button>
    }
    @if (error()) { <p role="alert">{{ error() }}</p> }
  `,
})
export class InterviewReplyOutcomeComponent {
  private readonly api = inject(InterviewHandoffApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly projectId = input.required<string>();
  readonly projectArchived = input.required<boolean>();
  readonly correspondence = input.required<CustomerCorrespondenceView>();
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  offersRevision(): boolean {
    const correspondence = this.correspondence();
    return correspondence.source.type === 'INTERVIEW_HANDOFF'
      && correspondence.messages.some((message) => message.classification === 'Módosítást kér');
  }

  startRevision(): void {
    const correspondence = this.correspondence();
    if (this.projectArchived() || correspondence.source.type !== 'INTERVIEW_HANDOFF') return;
    this.busy.set(true);
    this.error.set(null);
    this.api.start(this.projectId(), correspondence.source.roundId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: () => {
        void this.router.navigate(['/projects', this.projectId(), 'interview'], {
          queryParams: { roundId: correspondence.source.type === 'INTERVIEW_HANDOFF' ? correspondence.source.roundId : null },
          queryParamsHandling: 'merge',
          fragment: 'customer-handoff',
        });
      },
      error: () => {
        this.error.set('Az új összefoglaló-verzió nem indítható. Töltsd újra az adatokat, és ellenőrizd a projekt állapotát.');
        this.busy.set(false);
      },
      });
  }
}
