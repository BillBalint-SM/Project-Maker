import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { CustomerCorrespondenceView } from '@project-maker/contracts';

import { InterviewHandoffApiService } from './interview-handoff-api.service';

@Component({
  selector: 'app-interview-reply-outcome',
  template: `
    @if (offersRevision()) {
      <button type="button"
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
    this.api.start(this.projectId(), correspondence.source.roundId).subscribe({
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
