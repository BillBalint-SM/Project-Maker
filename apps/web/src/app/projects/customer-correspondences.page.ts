import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type {
  CustomerCorrespondenceCommand,
  CustomerCorrespondenceStatus,
  CustomerCorrespondenceView,
  CustomerInboundMessageClassification,
  ProjectCustomerCorrespondenceWork,
} from '@project-maker/contracts';
import { customerInboundMessageClassifications } from '@project-maker/contracts/customer-mail';

import { CustomerRepliesApiService } from './customer-replies-api.service';
import { provideCockpitOperationPolicy } from './cockpit-operation-policy';
import { CustomerFollowUpComponent } from './customer-follow-up/customer-follow-up.component';
import { InterviewReplyOutcomeComponent } from '../interviews/interview-handoff/interview-reply-outcome.component';
import { DiscoveryReplyOutcomeComponent } from './discovery-follow-ups/discovery-reply-outcome.component';

@Component({
  selector: 'app-customer-correspondences-page',
  imports: [
    CustomerFollowUpComponent,
    DatePipe,
    DiscoveryReplyOutcomeComponent,
    InterviewReplyOutcomeComponent,
  ],
  providers: [provideCockpitOperationPolicy()],
  template: `
    <section aria-labelledby="customer-replies-title">
      <span class="eyebrow">Customer kommunikáció</span>
      <h1 id="customer-replies-title">Customer válaszok</h1>
      @if (loading()) { <p>Válaszok betöltése…</p> }
      @else if (loadError()) { <p role="alert">{{ loadError() }}</p> }
      @else if (correspondenceWork(); as current) {
        @if (current.projectArchived) {
          <p role="status">Az archivált projekt levelezése olvasható. A feldolgozáshoz vagy a forrásfolyamat módosításához előbb állítsd vissza a projektet.</p>
        }
        <app-customer-follow-up
          [projectId]="projectId"
          [archived]="current.projectArchived"
          mode="work"
        />
        @if (commandError()) {
          <div class="command-error" role="alert">
            <p>{{ commandError() }}</p>
            <button type="button" (click)="reload()">Adatok újratöltése</button>
          </div>
        }
        <p data-testid="project-new-reply-count">{{ current.newReplyCount }} új válasz</p>
        @for (correspondence of current.correspondences; track correspondence.id) {
          <article class="correspondence" [attr.data-testid]="'correspondence-' + correspondence.id">
            <h2>{{ correspondence.status }}</h2>
            <p>{{ correspondence.unreadMessageCount }} olvasatlan üzenet</p>
            <div class="processing-actions">
              <button type="button"
                [attr.data-testid]="'mark-reviewed-' + correspondence.id"
                [disabled]="busy() || current.projectArchived || correspondence.unreadMessageCount === 0"
                (click)="markReviewed(correspondence)">Átnéztem</button>
              @if (correspondence.status === 'Új válasz' || correspondence.status === 'Lezárva') {
                <button type="button" [disabled]="busy() || current.projectArchived" (click)="setStatus(correspondence, 'Feldolgozás alatt')">Feldolgozás megkezdése</button>
              }
              @if (correspondence.status !== 'Lezárva') {
                <button type="button" [disabled]="busy() || current.projectArchived" (click)="setStatus(correspondence, 'Lezárva')">Lezárás</button>
              }
            </div>
            @if (correspondence.unknownDeliveryReceiptEvidence) {
              <p class="receipt-evidence" data-testid="unknown-delivery-receipt-evidence">A Customer válasza átvételi bizonyíték; az ismeretlen kézbesítési eredmény változatlanul megmarad, újraküldés nem javasolt.</p>
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
                <header><strong>{{ message.senderAddress || 'Ismeretlen feladó' }}</strong><time>{{ message.receivedAt | date: 'yyyy. MM. dd. HH:mm' }}</time></header>
                @if (message.senderClassification === 'UNRECOGNIZED') { <p class="sender-warning" role="status">Nem felismert Customer válaszfeladó</p> }
                <h3>{{ message.subject || 'Tárgy nélkül' }}</h3>
                <p class="message-text">{{ message.visibleText }}</p>
                <label>
                  Kézi besorolás
                  <select [attr.data-testid]="'classification-' + message.id"
                    [disabled]="busy() || current.projectArchived"
                    (change)="classify(correspondence, message.id, $event)">
                    <option value="" [selected]="!message.classification">Válassz besorolást</option>
                    @for (classification of classifications; track classification) {
                      <option [value]="classification" [selected]="message.classification === classification">{{ classification }}</option>
                    }
                  </select>
                </label>
                @if (message.quotedText) { <details><summary>Korábbi idézett levelezés</summary><pre>{{ message.quotedText }}</pre></details> }
                @if (message.attachmentCount > 0) {
                  <p>{{ message.attachmentCount }} melléklet</p><ul>
                    @for (attachment of message.attachments; track attachment.name + attachment.size) { <li>{{ attachment.name }} — {{ attachment.contentType }} — {{ attachment.size }} byte</li> }
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
    .correspondence, .inbound-message { border: 1px solid var(--p-content-border-color); border-radius: .8rem; padding: 1rem; margin-top: 1rem; }
    .inbound-message header { display: flex; justify-content: space-between; gap: 1rem; }
    .message-text, pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
    .sender-warning { color: var(--p-orange-700); font-weight: 700; }
    .receipt-evidence { color: var(--p-green-700); font-weight: 700; }
    .processing-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    label { display: grid; gap: .35rem; margin-block: .75rem; max-width: 22rem; }
  `,
})
export class CustomerCorrespondencesPage implements OnInit {
  private readonly api = inject(CustomerRepliesApiService);
  private readonly route = inject(ActivatedRoute);
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
    this.api.forProject(this.projectId).subscribe({
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
    this.api.command(this.projectId, correspondence.id, command).subscribe({
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
        this.api.summary().subscribe({ error: () => undefined });
      },
      error: () => {
        this.commandError.set('A művelet nem hajtható végre a jelenlegi adatokkal. Töltsd újra az adatokat, majd próbáld meg ismét.');
        this.busy.set(false);
      },
    });
  }
}
