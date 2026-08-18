import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type { ProjectCustomerCorrespondenceWork } from '@project-maker/contracts';

import { CustomerRepliesApiService } from './customer-replies-api.service';

@Component({
  selector: 'app-customer-correspondences-page',
  imports: [DatePipe, RouterLink],
  template: `
    <a class="back-link" [routerLink]="['/projects', projectId, 'status']">← Projektállapot</a>
    <section aria-labelledby="customer-replies-title">
      <span class="eyebrow">Customer kommunikáció</span>
      <h1 id="customer-replies-title">Customer válaszok</h1>
      @if (loading()) { <p>Válaszok betöltése…</p> }
      @else if (error()) { <p role="alert">{{ error() }}</p> }
      @else if (work(); as current) {
        <p data-testid="project-new-reply-count">{{ current.newReplyCount }} új válasz</p>
        @for (correspondence of current.correspondences; track correspondence.id) {
          <article class="correspondence" [attr.data-testid]="'correspondence-' + correspondence.id">
            <h2>{{ correspondence.status }}</h2>
            <p>{{ correspondence.unreadMessageCount }} olvasatlan üzenet</p>
            @for (message of correspondence.messages; track message.id) {
              <section class="inbound-message" [attr.data-testid]="'inbound-message-' + message.id">
                <header><strong>{{ message.senderAddress || 'Ismeretlen feladó' }}</strong><time>{{ message.receivedAt | date: 'yyyy. MM. dd. HH:mm' }}</time></header>
                @if (message.senderClassification === 'UNRECOGNIZED') { <p class="sender-warning" role="status">Nem felismert Customer válaszfeladó</p> }
                <h3>{{ message.subject || 'Tárgy nélkül' }}</h3>
                <p class="message-text">{{ message.visibleText }}</p>
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
  `,
})
export class CustomerCorrespondencesPage implements OnInit {
  private readonly api = inject(CustomerRepliesApiService);
  private readonly route = inject(ActivatedRoute);
  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly work = signal<ProjectCustomerCorrespondenceWork | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  ngOnInit(): void {
    this.api.forProject(this.projectId).subscribe({
      next: (work) => { this.work.set(work); this.loading.set(false); },
      error: (error: Error) => { this.error.set(error.message); this.loading.set(false); },
    });
  }
}
