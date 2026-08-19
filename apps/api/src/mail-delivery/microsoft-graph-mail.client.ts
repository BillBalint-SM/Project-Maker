import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign, randomUUID } from 'node:crypto';

import { GraphMailClientError, type GraphMailClient, type GraphMailboxPage, type GraphOutboundMessage } from './graph-customer-mail-boundary';

@Injectable()
export class MicrosoftGraphMailClient implements GraphMailClient {
  private readonly baseUrl: string;
  private readonly loginBaseUrl: string;
  private readonly tenantId: string;
  private readonly clientId: string;
  private readonly certificateThumbprint: string;
  private readonly privateKeyBase64: string;
  private readonly mailboxAddress: string;

  constructor(config: ConfigService) {
    this.baseUrl = normalizeUrl(config.get<string>('GRAPH_BASE_URL') ?? 'https://graph.microsoft.com');
    this.loginBaseUrl = normalizeUrl(config.get<string>('GRAPH_LOGIN_BASE_URL') ?? 'https://login.microsoftonline.com');
    this.tenantId = config.get<string>('GRAPH_TENANT_ID')?.trim() ?? '';
    this.clientId = config.get<string>('GRAPH_CLIENT_ID')?.trim() ?? '';
    this.certificateThumbprint = config.get<string>('GRAPH_CLIENT_CERTIFICATE_THUMBPRINT')?.trim() ?? '';
    this.privateKeyBase64 = config.get<string>('GRAPH_CLIENT_PRIVATE_KEY_BASE64')?.trim() ?? '';
    this.mailboxAddress = config.get<string>('CORRESPONDENCE_MAILBOX_ADDRESS')?.trim() ?? '';
  }

  isConfigured(): boolean {
    return this.mailboxAddress.length > 0
      && this.tenantId.length > 0
      && this.clientId.length > 0
      && /^[0-9a-f]{40}$/i.test(this.certificateThumbprint)
      && this.privateKeyBase64.length > 0;
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
            from: outbound.from,
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
    if (response.status === 429) {
      throw new GraphMailClientError('THROTTLED', undefined, parseRetryAfterMs(response));
    }
    if (response.status >= 500) throw new GraphMailClientError('TEMPORARY');
    return { accepted: false } as const;
  }

  async readMailboxPage(checkpoint: string | null): Promise<GraphMailboxPage> {
    this.requireConfigured();
    const selectedFields = 'id,internetMessageId,internetMessageHeaders,from,toRecipients,ccRecipients,bccRecipients,subject,body,receivedDateTime';
    const initial = `${this.baseUrl}/v1.0/users/${encodeURIComponent(this.mailboxAddress)}/mailFolders/inbox/messages/delta?$select=${selectedFields}&$expand=attachments($select=name,contentType,size)`;
    const url = checkpoint ?? initial;
    if (!url.startsWith(`${this.baseUrl}/`)) throw new GraphMailClientError('INVALID_CURSOR');
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          authorization: `Bearer ${await this.accessToken()}`,
          prefer: 'IdType="ImmutableId"',
        },
      });
    } catch {
      throw new GraphMailClientError('TEMPORARY');
    }
    if (response.status === 401 || response.status === 403) throw new GraphMailClientError('AUTHENTICATION');
    if (response.status === 410) throw new GraphMailClientError('INVALID_CURSOR');
    if (response.status === 429) {
      throw new GraphMailClientError('THROTTLED', undefined, parseRetryAfterMs(response));
    }
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
    const tokenUrl = `${this.loginBaseUrl}/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`;
    let clientAssertion: string;
    try {
      clientAssertion = this.createClientAssertion(tokenUrl);
    } catch {
      throw new GraphMailClientError('AUTHENTICATION');
    }
    const body = new URLSearchParams({
      client_id: this.clientId,
      client_assertion: clientAssertion,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });
    let response: Response;
    try {
      response = await fetch(tokenUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
    } catch {
      throw new GraphMailClientError('AUTHENTICATION');
    }
    if (!response.ok) throw new GraphMailClientError('AUTHENTICATION');
    const payload = await response.json() as { access_token?: unknown };
    if (typeof payload.access_token !== 'string' || payload.access_token.length === 0) throw new GraphMailClientError('AUTHENTICATION');
    return payload.access_token;
  }

  private createClientAssertion(audience: string): string {
    const now = Math.floor(Date.now() / 1000);
    const header = encodeJwtPart({
      alg: 'RS256',
      typ: 'JWT',
      x5t: Buffer.from(this.certificateThumbprint, 'hex').toString('base64url'),
    });
    const payload = encodeJwtPart({
      aud: audience,
      exp: now + 600,
      iss: this.clientId,
      jti: randomUUID(),
      nbf: now - 60,
      sub: this.clientId,
    });
    const unsignedAssertion = `${header}.${payload}`;
    const privateKey = Buffer.from(this.privateKeyBase64, 'base64').toString('utf8');
    const signature = createSign('RSA-SHA256').update(unsignedAssertion).end().sign(privateKey).toString('base64url');
    return `${unsignedAssertion}.${signature}`;
  }
}

function normalizeUrl(value: string): string { return value.trim().replace(/\/+$/, ''); }

function encodeJwtPart(value: Readonly<Record<string, string | number>>): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function parseRetryAfterMs(response: Response): number | undefined {
  const value = response.headers.get('retry-after')?.trim();
  if (!value) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const milliseconds = Number(value) * 1_000;
    return Number.isSafeInteger(milliseconds) && milliseconds >= 0
      ? milliseconds
      : undefined;
  }
  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return undefined;
  return Math.max(0, retryAt - Date.now());
}
