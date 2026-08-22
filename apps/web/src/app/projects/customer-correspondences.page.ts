import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  CustomerCorrespondenceCommand,
  CustomerCorrespondenceStatus,
  CustomerCorrespondenceView,
  CustomerInboundMessageClassification,
  ProjectCustomerCorrespondenceWork,
} from '@project-maker/contracts';
import { customerInboundMessageClassifications } from '@project-maker/contracts/customer-mail';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { CustomerRepliesApiService } from './customer-replies-api.service';
import { CustomerResponseComponent } from './customer-response/customer-response.component';
import { NotificationsApiService } from '../notifications/notifications-api.service';
import { CustomerFollowUpComponent } from './customer-follow-up/customer-follow-up.component';
import { InterviewReplyOutcomeComponent } from '../interviews/interview-handoff/interview-reply-outcome.component';
import { DiscoveryReplyOutcomeComponent } from './discovery-follow-ups/discovery-reply-outcome.component';

@Component({
  selector: 'app-customer-correspondences-page',
  imports: [
    CustomerFollowUpComponent,
    CustomerResponseComponent,
    ButtonModule,
    DatePipe,
    DiscoveryReplyOutcomeComponent,
    InterviewReplyOutcomeComponent,
    ProgressSpinnerModule,
    RouterLink,
  ],
  template: `
    <section aria-labelledby="customer-replies-title">
      <span class="eyebrow">Customer communication</span>
      <h1 id="customer-replies-title">Customer correspondence</h1>
      <p class="page-lead">Process Customer responses and prepare follow-ups in one place.</p>
      @if (loading()) {
        <div class="state-panel" aria-live="polite">
          <p-progress-spinner ariaLabel="Loading Customer correspondence" />
          <p>Loading Customer correspondence…</p>
        </div>
      }
      @else if (loadError()) {
        <div class="state-panel" role="alert">
          <h2>Customer correspondence could not be loaded</h2>
          <p>{{ loadError() }}</p>
          <p-button label="Reload Customer correspondence" (onClick)="reload()" />
        </div>
      }
      @else if (correspondenceWork(); as current) {
        @if (current.projectArchived) {
          <p role="status">The archived project's correspondence is read-only. Restore the project to process replies or change the source workflow.</p>
        }
        <app-customer-response [projectId]="projectId" [archived]="current.projectArchived" />
        <app-customer-follow-up
          [projectId]="projectId"
          [archived]="current.projectArchived"
          mode="work"
        />
        @if (commandError()) {
          <div class="command-error" role="alert">
            <p>{{ commandError() }}</p>
            <p-button type="button" label="Reload Customer correspondence" (onClick)="reload()" />
          </div>
        }
        <p class="reply-summary" data-testid="project-new-reply-count">
          {{ current.newReplyCount }} unprocessed Customer {{ current.newReplyCount === 1 ? 'response' : 'responses' }}
        </p>
        @if (current.correspondences.length === 0) {
          <div class="state-panel">
            <h2>No Customer responses yet</h2>
            <p>Responses to sent interview summaries and follow-ups will appear here.</p>
            <a pButton [routerLink]="['/projects', projectId, 'interview']" fragment="customer-handoff">
              Prepare interview summary
            </a>
          </div>
        }
        @for (correspondence of current.correspondences; track correspondence.id) {
          <article class="correspondence" [attr.data-testid]="'correspondence-' + correspondence.id">
            <h2>{{ statusLabel(correspondence.status) }}</h2>
            <p>{{ correspondence.unreadMessageCount }} unread {{ correspondence.unreadMessageCount === 1 ? 'message' : 'messages' }}</p>
            <div class="processing-actions">
              <button pButton type="button" class="p-button-outlined"
                [attr.data-testid]="'mark-reviewed-' + correspondence.id"
                [disabled]="busy() || current.projectArchived || correspondence.unreadMessageCount === 0"
                (click)="markReviewed(correspondence)">Mark as reviewed</button>
              @if (correspondence.status === 'Új válasz' || correspondence.status === 'Lezárva') {
                <button pButton type="button" [disabled]="busy() || current.projectArchived" (click)="setStatus(correspondence, 'Feldolgozás alatt')">Start processing</button>
              }
              @if (correspondence.status !== 'Lezárva') {
                <button pButton type="button" [class.p-button-outlined]="correspondence.status === 'Új válasz'" [disabled]="busy() || current.projectArchived" (click)="setStatus(correspondence, 'Lezárva')">Close correspondence</button>
              }
            </div>
            @if (correspondence.unknownDeliveryReceiptEvidence) {
              <p class="receipt-evidence" data-testid="unknown-delivery-receipt-evidence">The Customer response confirms receipt. The uncertain delivery outcome remains recorded; do not resend.</p>
            }
            <app-interview-reply-outcome
              [projectId]="projectId"
              [projectArchived]="current.projectArchived"
              [correspondence]="correspondence"
            />
            <app-discovery-reply-outcome
              [projectId]="projectId"
              [correspondence]="correspondence"
            />
            @for (message of correspondence.messages; track message.id) {
              <section class="inbound-message" [attr.data-testid]="'inbound-message-' + message.id">
                <header><strong>{{ message.senderAddress || 'Unknown sender' }}</strong><time>{{ message.receivedAt | date: 'dd MMM yyyy, HH:mm' }}</time></header>
                @if (message.senderClassification === 'UNRECOGNIZED') { <p class="sender-warning" role="status">Reply sender is not listed among Project contacts</p> }
                <h3>{{ message.subject || 'No subject' }}</h3>
                <p class="message-text">{{ message.visibleText }}</p>
                <label>
                  Manual classification
                  <select [attr.data-testid]="'classification-' + message.id"
                    [disabled]="busy() || current.projectArchived"
                    (change)="classify(correspondence, message.id, $event)">
                    <option value="" [selected]="!message.classification">Select classification</option>
                    @for (classification of classifications; track classification) {
                      <option [value]="classification" [selected]="message.classification === classification">{{ classificationLabel(classification) }}</option>
                    }
                  </select>
                </label>
                @if (message.quotedText) { <details><summary>Earlier quoted correspondence</summary><pre>{{ message.quotedText }}</pre></details> }
                @if (message.attachmentCount > 0) {
                  <p>{{ message.attachmentCount }} {{ message.attachmentCount === 1 ? 'attachment' : 'attachments' }}</p><ul>
                    @for (attachment of message.attachments; track attachment.name + attachment.size) { <li>{{ attachment.name }} — {{ attachment.contentType }} — {{ attachment.size }} {{ attachment.size === 1 ? 'byte' : 'bytes' }}</li> }
                  </ul>
                }
              </section>
            }
          </article>
        }
      }
    </section>
  `,
  styles: `
    .page-lead { max-width: 48rem; color: var(--p-text-muted-color); }
    .state-panel { display: grid; justify-items: start; gap: .75rem; padding: 1.25rem; border: 1px solid var(--pm-border); border-radius: var(--pm-radius-md); }
    .state-panel :is(h2, p) { margin: 0; }
    .reply-summary { color: var(--pm-cyan); font-weight: 750; }
    .correspondence { background: linear-gradient(145deg, color-mix(in oklch, var(--pm-surface-2) 82%, transparent), color-mix(in oklch, var(--pm-surface-1) 96%, transparent)); border: 1px solid var(--pm-border); border-radius: var(--pm-radius-md); box-shadow: var(--pm-shadow-sm); overflow: hidden; padding: 1.1rem; margin-top: 1rem; position: relative; }
    .correspondence::before { background: linear-gradient(90deg, var(--pm-blue), var(--pm-magenta), var(--pm-yellow)); content: ''; height: 1px; inset: 0 12% auto; position: absolute; }
    .inbound-message { background: color-mix(in oklch, var(--pm-surface-3) 52%, transparent); border: 1px solid color-mix(in oklch, var(--pm-border) 75%, transparent); border-radius: var(--pm-radius-sm); padding: 1rem; margin-top: 1rem; }
    .inbound-message header { align-items: baseline; display: flex; flex-wrap: wrap; justify-content: space-between; gap: .5rem 1rem; }
    .inbound-message time { color: var(--pm-text-muted); font-size: .82rem; font-variant-numeric: tabular-nums; }
    .message-text, pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
    pre { background: var(--pm-canvas-deep); border: 1px solid var(--pm-border); border-radius: var(--pm-radius-sm); padding: .85rem; }
    .sender-warning { color: var(--p-orange-700); font-weight: 700; }
    .receipt-evidence { color: var(--p-green-700); font-weight: 700; }
    .processing-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    label { display: grid; gap: .35rem; margin-block: .75rem; max-width: 22rem; }
  `,
})
export class CustomerCorrespondencesPage implements OnInit {
  private readonly api = inject(CustomerRepliesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notifications = inject(NotificationsApiService);
  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly correspondenceWork = signal<ProjectCustomerCorrespondenceWork | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly commandError = signal<string | null>(null);
  readonly busy = signal(false);
  readonly classifications = customerInboundMessageClassifications;
  ngOnInit(): void {
    this.load();
  }

  reload(): void {
    this.loading.set(true);
    this.commandError.set(null);
    this.load();
  }

  private load(): void {
    this.loadError.set(null);
    this.api.forProject(this.projectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (correspondenceWork) => {
        this.correspondenceWork.set(correspondenceWork);
        this.loading.set(false);
      },
      error: (error: Error) => { this.loadError.set(error.message); this.loading.set(false); },
    });
  }

  markReviewed(correspondence: CustomerCorrespondenceView): void {
    this.execute(correspondence, {
      command: 'MARK_REVIEWED',
      expectedVersion: correspondence.processingVersion,
    });
  }

  setStatus(correspondence: CustomerCorrespondenceView, status: CustomerCorrespondenceStatus): void {
    this.execute(correspondence, {
      command: 'SET_STATUS',
      expectedVersion: correspondence.processingVersion,
      status,
    });
  }

  classify(correspondence: CustomerCorrespondenceView, messageId: string, event: Event): void {
    const classification = (event.target as HTMLSelectElement).value as CustomerInboundMessageClassification | '';
    if (!classification) return;
    this.execute(correspondence, {
      command: 'CLASSIFY_MESSAGE',
      expectedVersion: correspondence.processingVersion,
      messageId,
      classification,
    });
  }

  private execute(correspondence: CustomerCorrespondenceView, command: CustomerCorrespondenceCommand): void {
    this.busy.set(true);
    this.commandError.set(null);
    this.api.command(this.projectId, correspondence.id, command)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: (updated) => {
        this.correspondenceWork.update((work) => work && ({
          ...work,
          newReplyCount: work.correspondences.reduce(
            (sum, item) => sum + (item.id === updated.id ? updated.unreadMessageCount : item.unreadMessageCount),
            0,
          ),
          correspondences: work.correspondences.map((item) => item.id === updated.id ? updated : item),
        }));
        this.busy.set(false);
        this.api.summary().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
        this.notifications.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
      },
      error: () => {
        this.commandError.set('This operation cannot be completed with the current data. Reload the data, then try again.');
        this.busy.set(false);
      },
      });
  }

  statusLabel(status: CustomerCorrespondenceStatus): string {
    return ({ 'Válaszra vár': 'Awaiting response', 'Új válasz': 'New response', 'Feldolgozás alatt': 'Processing', Lezárva: 'Closed' })[status] ?? status;
  }

  classificationLabel(classification: CustomerInboundMessageClassification): string {
    return ({
      Elfogadva: 'Accepted',
      'Módosítást kér': 'Change requested',
      'Kérdés vagy válasz': 'Question or answer',
      Egyéb: 'Other',
    } as const)[classification] ?? classification;
  }
}
