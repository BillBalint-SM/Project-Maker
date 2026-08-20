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
import { provideProjectOperationPolicy } from './project-operation-policy';
import { CustomerFollowUpComponent } from './customer-follow-up/customer-follow-up.component';
import { InterviewReplyOutcomeComponent } from '../interviews/interview-handoff/interview-reply-outcome.component';
import { DiscoveryReplyOutcomeComponent } from './discovery-follow-ups/discovery-reply-outcome.component';

@Component({
  selector: 'app-customer-correspondences-page',
  imports: [
    CustomerFollowUpComponent,
    ButtonModule,
    DatePipe,
    DiscoveryReplyOutcomeComponent,
    InterviewReplyOutcomeComponent,
    ProgressSpinnerModule,
    RouterLink,
  ],
  providers: [provideProjectOperationPolicy()],
  template: `
    <section aria-labelledby="customer-replies-title">
      <span class="eyebrow">Ügyfélkapcsolat</span>
      <h1 id="customer-replies-title">Ügyféllevelezés</h1>
      <p class="page-lead">Az ügyfélválaszok feldolgozása és az emlékeztetők előkészítése egy helyen.</p>
      @if (loading()) {
        <div class="state-panel" aria-live="polite">
          <p-progress-spinner ariaLabel="Ügyféllevelezés betöltése" />
          <p>Az ügyféllevelezés betöltése folyamatban van…</p>
        </div>
      }
      @else if (loadError()) {
        <div class="state-panel" role="alert">
          <h2>Az ügyféllevelezés most nem tölthető be</h2>
          <p>{{ loadError() }}</p>
          <p-button label="Ügyféllevelezés újratöltése" (onClick)="reload()" />
        </div>
      }
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
            <p-button type="button" label="Ügyféllevelezés újratöltése" (onClick)="reload()" />
          </div>
        }
        <p class="reply-summary" data-testid="project-new-reply-count">
          {{ current.newReplyCount }} feldolgozatlan ügyfélválasz
        </p>
        @if (current.correspondences.length === 0) {
          <div class="state-panel">
            <h2>Még nincs ügyfélválasz</h2>
            <p>Az elküldött összefoglalókra és emlékeztetőkre érkező válaszok itt jelennek meg.</p>
            <a pButton [routerLink]="['/projects', projectId, 'interview']" fragment="customer-handoff">
              Felmérési összefoglaló előkészítése
            </a>
          </div>
        }
        @for (correspondence of current.correspondences; track correspondence.id) {
          <article class="correspondence" [attr.data-testid]="'correspondence-' + correspondence.id">
            <h2>{{ correspondence.status }}</h2>
            <p>{{ correspondence.unreadMessageCount }} olvasatlan üzenet</p>
            <div class="processing-actions">
              <button pButton type="button" class="p-button-outlined"
                [attr.data-testid]="'mark-reviewed-' + correspondence.id"
                [disabled]="busy() || current.projectArchived || correspondence.unreadMessageCount === 0"
                (click)="markReviewed(correspondence)">Átnéztem</button>
              @if (correspondence.status === 'Új válasz' || correspondence.status === 'Lezárva') {
                <button pButton type="button" [disabled]="busy() || current.projectArchived" (click)="setStatus(correspondence, 'Feldolgozás alatt')">Feldolgozás megkezdése</button>
              }
              @if (correspondence.status !== 'Lezárva') {
                <button pButton type="button" [class.p-button-outlined]="correspondence.status === 'Új válasz'" [disabled]="busy() || current.projectArchived" (click)="setStatus(correspondence, 'Lezárva')">Lezárás</button>
              }
            </div>
            @if (correspondence.unknownDeliveryReceiptEvidence) {
              <p class="receipt-evidence" data-testid="unknown-delivery-receipt-evidence">Az ügyfél válasza igazolja az átvételt. A bizonytalan kézbesítési eredmény változatlanul megmarad; újraküldés nem javasolt.</p>
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
                @if (message.senderClassification === 'UNRECOGNIZED') { <p class="sender-warning" role="status">Az ügyfélkapcsolatok között nem szereplő válaszfeladó</p> }
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
    .page-lead { max-width: 48rem; color: var(--p-text-muted-color); }
    .state-panel { display: grid; justify-items: start; gap: .75rem; padding: 1.25rem; border: 1px solid var(--p-content-border-color); border-radius: .8rem; }
    .state-panel :is(h2, p) { margin: 0; }
    .reply-summary { font-weight: 700; }
    .correspondence, .inbound-message { border: 1px solid var(--p-content-border-color); border-radius: .8rem; padding: 1rem; margin-top: 1rem; }
    .inbound-message header { display: flex; justify-content: space-between; gap: 1rem; }
    .message-text, pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
    .sender-warning { color: var(--p-orange-700); font-weight: 700; }
    .receipt-evidence { color: var(--p-green-700); font-weight: 700; }
    .processing-actions { display: flex; flex-wrap: wrap; gap: .5rem; }
    label { display: grid; gap: .35rem; margin-block: .75rem; max-width: 22rem; }
    @media (max-width: 30rem) {
      .inbound-message header { align-items: flex-start; flex-direction: column; }
      .processing-actions > * { width: 100%; }
    }
  `,
})
export class CustomerCorrespondencesPage implements OnInit {
  private readonly api = inject(CustomerRepliesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
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
      },
      error: () => {
        this.commandError.set('A művelet nem hajtható végre a jelenlegi adatokkal. Töltsd újra az adatokat, majd próbáld meg ismét.');
        this.busy.set(false);
      },
      });
  }
}
