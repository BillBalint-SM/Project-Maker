import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GraphMailClientError, type GraphMailClient, type GraphMailboxPage, type GraphOutboundMessage } from './graph-customer-mail-boundary';

@Injectable()
export class MicrosoftGraphMailClient implements GraphMailClient {
  private readonly baseUrl: string;
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly staticAccessToken: string;
  private readonly mailboxAddress: string;

  constructor(config: ConfigService) {
    this.baseUrl = normalizeUrl(config.get<string>('GRAPH_BASE_URL') ?? 'https://graph.microsoft.com');
    this.tenantId = config.get<string>('GRAPH_TENANT_ID')?.trim() ?? '';
    this.clientId = config.get<string>('GRAPH_CLIENT_ID')?.trim() ?? '';
    this.clientSecret = config.get<string>('GRAPH_CLIENT_SECRET') ?? '';
    this.staticAccessToken = config.get<string>('GRAPH_ACCESS_TOKEN') ?? '';
    this.mailboxAddress = config.get<string>('CUSTOMER_MAILBOX_ADDRESS')?.trim() ?? '';
  }

  isConfigured(): boolean {
    return this.mailboxAddress.length > 0 && (this.staticAccessToken.length > 0 || (this.tenantId.length > 0 && this.clientId.length > 0 && this.clientSecret.length > 0));
  }

  async submit(outbound: GraphOutboundMessage) {
    this.requireConfigured();
    const token = await this.accessToken();
    const url = `${this.baseUrl}/v1.0/users/${encodeURIComponent(outbound.senderAddress)}/sendMail`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: outbound.subject,
            body: outbound.body,
            toRecipients: outbound.toRecipients,
            replyTo: outbound.replyTo,
          },
          saveToSentItems: outbound.saveToSentItems,
        }),
      });
    } catch {
      throw new GraphMailClientError('UNKNOWN_OUTCOME');
    }
    if (response.status === 202) return { accepted: true, id: null } as const;
    if (response.status === 401 || response.status === 403) throw new GraphMailClientError('AUTHENTICATION');
    if (response.status === 429) throw new GraphMailClientError('THROTTLED');
    if (response.status >= 500) throw new GraphMailClientError('TEMPORARY');
    return { accepted: false } as const;
  }

  async readMailboxPage(checkpoint: string | null): Promise<GraphMailboxPage> {
    this.requireConfigured();
    const initial = `${this.baseUrl}/v1.0/users/${encodeURIComponent(this.mailboxAddress)}/mailFolders/inbox/messages/delta`;
    const url = checkpoint ?? initial;
    if (!url.startsWith(`${this.baseUrl}/`)) throw new GraphMailClientError('INVALID_CURSOR');
    let response: Response;
    try {
      response = await fetch(url, { headers: { authorization: `Bearer ${await this.accessToken()}` } });
    } catch {
      throw new GraphMailClientError('TEMPORARY');
    }
    if (response.status === 401 || response.status === 403) throw new GraphMailClientError('AUTHENTICATION');
    if (response.status === 410) throw new GraphMailClientError('INVALID_CURSOR');
    if (response.status === 429) throw new GraphMailClientError('THROTTLED');
    if (!response.ok) throw new GraphMailClientError(response.status >= 500 ? 'TEMPORARY' : 'REJECTED');
    const body = await response.json() as { value?: unknown; '@odata.nextLink'?: unknown; '@odata.deltaLink'?: unknown };
    if (!Array.isArray(body.value)) throw new GraphMailClientError('TEMPORARY');
    return {
      value: body.value as GraphMailboxPage['value'],
      nextCheckpoint: typeof body['@odata.nextLink'] === 'string' ? body['@odata.nextLink'] : null,
      completedCheckpoint: typeof body['@odata.deltaLink'] === 'string' ? body['@odata.deltaLink'] : null,
    };
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) throw new GraphMailClientError('CONFIGURATION');
  }

  private async accessToken(): Promise<string> {
    if (this.staticAccessToken) return this.staticAccessToken;
    const body = new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' });
    let response: Response;
    try {
      response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    } catch {
      throw new GraphMailClientError('AUTHENTICATION');
    }
    if (!response.ok) throw new GraphMailClientError('AUTHENTICATION');
    const payload = await response.json() as { access_token?: unknown };
    if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) throw new GraphMailClientError('AUTHENTICATION');
    return payload.access_token;
  }
}

function normalizeUrl(value: string): string { return value.trim().replace(/\/+$/, ''); }
