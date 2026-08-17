import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import {
  CustomerMailBoundaryError,
  GraphCustomerMailBoundary,
  GraphMailClientError,
  type GraphMailClient,
  type GraphMailboxPage,
  type GraphOutboundMessage,
  graphMailClientToken,
} from '../src/mail-delivery/graph-customer-mail-boundary';
import { customerMailboxChangesToken, customerOutboundMailToken, type CustomerMailboxChanges, type CustomerOutboundMail, UnavailableCustomerMailboxChanges } from '../src/mail-delivery/customer-mail-boundary';
import { MailDeliveryModule } from '../src/mail-delivery/mail-delivery.module';

@Injectable()
class FollowUpMailProbe {
  constructor(@Inject(customerOutboundMailToken) readonly mail: CustomerOutboundMail) {}
}

@Module({ providers: [FollowUpMailProbe], exports: [FollowUpMailProbe] })
class FollowUpFeatureProbeModule {}

@Injectable()
class HandoffMailProbe {
  constructor(@Inject(customerOutboundMailToken) readonly mail: CustomerOutboundMail) {}
}

@Module({ providers: [HandoffMailProbe], exports: [HandoffMailProbe] })
class HandoffFeatureProbeModule {}

class ControlledGraphMailClient implements GraphMailClient {
  readonly submitted: GraphOutboundMessage[] = [];
  submitFailure: GraphMailClientError | null = null;
  submissionAccepted = true;
  pages = new Map<string, GraphMailboxPage>();
  readFailure = new Map<string, GraphMailClientError>();
  configured = true;

  isConfigured(): boolean {
    return this.configured;
  }

  async submit(message: GraphOutboundMessage): Promise<
    { readonly accepted: true; readonly id: string | null } | { readonly accepted: false }
  > {
    if (this.submitFailure) throw this.submitFailure;
    this.submitted.push(message);
    return this.submissionAccepted
      ? { accepted: true, id: 'graph-message-1' }
      : { accepted: false };
  }

  async readMailboxPage(cursor: string | null): Promise<GraphMailboxPage> {
    const key = cursor ?? 'initial';
    const failure = this.readFailure.get(key);
    if (failure) throw failure;
    const page = this.pages.get(key);
    if (!page) throw new Error('Controlled page is missing.');
    return page;
  }
}

describe('Graph customer mail boundary', () => {
  it('fails closed when the default SMTP composition has no mailbox reader', async () => {
    await assert.rejects(
      new UnavailableCustomerMailboxChanges().readChanges(null),
      (error) => isSafeBoundaryError(error, 'CONFIGURATION_ERROR'),
    );
  });

  it('shares the selected Graph provider with feature-module scopes', async () => {
    const client = new ControlledGraphMailClient();
    client.pages.set('initial', { value: [], nextCheckpoint: null, completedCheckpoint: 'baseline' });
    const module = await Test.createTestingModule({
      imports: [
        MailDeliveryModule.graph({ provide: graphMailClientToken, useValue: client }),
        FollowUpFeatureProbeModule,
        HandoffFeatureProbeModule,
      ],
    }).compile();

    const followUpMail = module.get(FollowUpMailProbe).mail;
    const handoffMail = module.get(HandoffMailProbe).mail;
    assert.strictEqual(followUpMail, handoffMail);
    assert.equal(followUpMail.isConfigured(), true);
    assert.deepEqual(
      await module.get<CustomerMailboxChanges>(customerMailboxChangesToken).readChanges(null),
      { changes: [], nextPageCheckpoint: null, completedCheckpoint: { value: 'baseline' } },
    );
    await module.close();
  });

  it('normalizes submission acceptance without exposing the Graph response', async () => {
    const client = new ControlledGraphMailClient();
    const boundary = new GraphCustomerMailBoundary(client);

    const result = await boundary.submit({
      senderAddress: 'po.peter@pte.hu',
      senderName: 'PO Péter',
      recipientAddress: 'customer@example.test',
      replyToAddress: 'project-maker+opaque-token@pte.hu',
      subject: 'Kérdésséma',
      textContent: 'Tartalom',
    });

    assert.deepEqual(result, { acceptance: 'ACCEPTED', messageReference: 'graph-message-1' });
    assert.deepEqual(client.submitted, [{
      senderAddress: 'po.peter@pte.hu',
      from: { emailAddress: { name: 'PO Péter', address: 'po.peter@pte.hu' } },
      toRecipients: [{ emailAddress: { address: 'customer@example.test' } }],
      replyTo: [{ emailAddress: { address: 'project-maker+opaque-token@pte.hu' } }],
      subject: 'Kérdésséma',
      body: { contentType: 'Text', content: 'Tartalom' },
      saveToSentItems: true,
    }]);
  });

  it('reports Graph configuration without claiming a fallback transport', () => {
    const client = new ControlledGraphMailClient();
    client.configured = false;

    assert.equal(new GraphCustomerMailBoundary(client).isConfigured(), false);
  });

  it('represents provider rejection as mail-system rejection, not delivery state', async () => {
    const client = new ControlledGraphMailClient();
    client.submissionAccepted = false;
    const boundary = new GraphCustomerMailBoundary(client);

    const result = await boundary.submit({
      senderAddress: 'project-maker@pte.hu',
      recipientAddress: 'customer@example.test',
      replyToAddress: 'project-maker+token@pte.hu',
      subject: 'Kérdésséma',
      textContent: 'Tartalom',
    });

    assert.deepEqual(result, { acceptance: 'REJECTED', messageReference: null });
    assert.equal('delivery' in result, false);
    assert.equal('reply' in result, false);
    assert.equal('correspondenceStatus' in result, false);
  });

  it('normalizes paged mailbox changes and preserves replay for the same checkpoint', async () => {
    const client = new ControlledGraphMailClient();
    client.pages.set('initial', {
      value: [{
        id: 'message-1',
        '@removed': undefined,
        internetMessageId: '<reply@example.test>',
        internetMessageHeaders: [{ name: 'In-Reply-To', value: '<original@example.test>' }],
        from: { emailAddress: { address: 'customer@example.test' } },
        subject: 'Re: Kérdésséma',
        body: { contentType: 'text', content: 'Válasz' },
        receivedDateTime: '2026-08-17T08:00:00.000Z',
      }],
      nextCheckpoint: 'page-2',
      completedCheckpoint: null,
    });
    const boundary = new GraphCustomerMailBoundary(client);

    const first = await boundary.readChanges(null);
    const replay = await boundary.readChanges(null);

    assert.deepEqual(first, replay);
    assert.deepEqual(first, {
      changes: [{
        changeType: 'UPSERTED',
        messageReference: 'message-1',
        internetMessageId: '<reply@example.test>',
        inReplyTo: '<original@example.test>',
        senderAddress: 'customer@example.test',
        subject: 'Re: Kérdésséma',
        textContent: 'Válasz',
        receivedAt: '2026-08-17T08:00:00.000Z',
      }],
      nextPageCheckpoint: { value: 'page-2' },
      completedCheckpoint: null,
    });
  });

  it('converts untrusted Graph HTML bodies to safe plain text', async () => {
    const client = new ControlledGraphMailClient();
    client.pages.set('initial', {
      value: [{
        id: 'message-html',
        body: {
          contentType: 'html',
          content: '<p>Hello<br>World &amp; team</p><script>steal()</script><img src=x onerror=steal()>',
        },
      }],
      nextCheckpoint: null,
      completedCheckpoint: 'done',
    });

    const page = await new GraphCustomerMailBoundary(client).readChanges(null);

    assert.equal(page.changes[0]?.textContent, 'Hello\nWorld & team');
    assert.equal(page.changes[0]?.textContent?.includes('<'), false);
    assert.equal(page.changes[0]?.textContent?.includes('steal'), false);
  });

  it('maps provider failures to bounded, provider-neutral errors', async () => {
    const client = new ControlledGraphMailClient();
    const boundary = new GraphCustomerMailBoundary(client);
    const cases = [
      ['CONFIGURATION', 'CONFIGURATION_ERROR'],
      ['AUTHENTICATION', 'AUTHENTICATION_ERROR'],
      ['REJECTED', 'SUBMISSION_REJECTED'],
      ['THROTTLED', 'THROTTLED'],
      ['INVALID_CURSOR', 'INVALID_CURSOR'],
      ['TEMPORARY', 'TEMPORARY_FAILURE'],
      ['UNKNOWN_OUTCOME', 'OUTCOME_UNKNOWN'],
    ] as const;

    for (const [providerCode, expectedCode] of cases) {
      client.submitFailure = new GraphMailClientError(providerCode, 'secret-token customer@example.test raw-response');
      await assert.rejects(
        boundary.submit({ senderAddress: 'project-maker@pte.hu', recipientAddress: 'customer@example.test', replyToAddress: 'project-maker+token@pte.hu', subject: 'S', textContent: 'secret body' }),
        (error: unknown) => isSafeBoundaryError(error, expectedCode),
      );
    }
  });

  it('maps throttled and invalid mailbox checkpoints without leaking provider details', async () => {
    const client = new ControlledGraphMailClient();
    const boundary = new GraphCustomerMailBoundary(client);
    client.readFailure.set('throttled', new GraphMailClientError('THROTTLED', 'Bearer secret-token'));
    client.readFailure.set('expired', new GraphMailClientError('INVALID_CURSOR', 'https://graph.example/delta?secret=1'));

    await assert.rejects(boundary.readChanges({ value: 'throttled' }), (error) => isSafeBoundaryError(error, 'THROTTLED'));
    await assert.rejects(boundary.readChanges({ value: 'expired' }), (error) => isSafeBoundaryError(error, 'INVALID_CURSOR'));
  });
});

function isSafeBoundaryError(error: unknown, expectedCode: string): boolean {
  if (!(error instanceof CustomerMailBoundaryError)) return false;
  return error.code === expectedCode
    && !JSON.stringify(error).includes('secret')
    && !error.message.includes('customer@example.test');
}
