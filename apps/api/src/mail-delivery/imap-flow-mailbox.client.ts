import type { CustomerMailboxAttachmentMetadata } from '@project-maker/contracts';
import { Injectable } from '@nestjs/common';
import {
  ImapFlow,
  type FetchMessageObject,
  type MessageAddressObject,
  type MessageStructureObject,
} from 'imapflow';

import type { MailGatewayConfiguration } from '../config/mail-gateway.config';
import type {
  ImapMailboxClient,
  ImapMailboxClientFactory,
  ImapMailboxRecord,
  ImapMailboxSearch,
} from './imap-customer-mailbox-changes';

const maximumTextPartBytes = 256 * 1024;

@Injectable()
export class ImapFlowMailboxClientFactory implements ImapMailboxClientFactory {
  create(configuration: MailGatewayConfiguration): ImapMailboxClient {
    return new ImapFlowMailboxClient(configuration);
  }
}

class ImapFlowMailboxClient implements ImapMailboxClient {
  private readonly client: ImapFlow;
  private connected = false;

  constructor(private readonly configuration: MailGatewayConfiguration) {
    const implicitTls = configuration.imap.security === 'IMPLICIT_TLS';
    this.client = new ImapFlow({
      host: configuration.imap.host,
      port: configuration.imap.port,
      secure: implicitTls,
      doSTARTTLS: implicitTls ? false : true,
      servername: configuration.imap.host,
      auth: {
        user: configuration.imap.username,
        pass: configuration.imap.password,
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
        servername: configuration.imap.host,
        ...(configuration.tlsCaCertificate === null
          ? {}
          : { ca: configuration.tlsCaCertificate }),
      },
      connectionTimeout: configuration.timeoutMs,
      greetingTimeout: configuration.timeoutMs,
      socketTimeout: configuration.timeoutMs,
      disableAutoIdle: true,
      logger: false,
      logRaw: false,
      emitLogs: false,
      maxLineLength: 64 * 1024,
      maxLiteralSize: maximumTextPartBytes + 64 * 1024,
      maxResponseSize: maximumTextPartBytes + 128 * 1024,
    });
    // Provider diagnostics can contain message or account data. Commands still
    // reject to the bounded boundary mapper; the event is intentionally silent.
    this.client.on('error', () => undefined);
  }

  async open(folder: string): Promise<{ uidValidity: string; uidNext: number }> {
    await this.client.connect();
    this.connected = true;
    const mailbox = await this.client.mailboxOpen(folder, { readOnly: true });
    return {
      uidValidity: mailbox.uidValidity.toString(10),
      uidNext: mailbox.uidNext,
    };
  }

  async search(search: ImapMailboxSearch): Promise<readonly number[]> {
    const result = await this.client.search({
      uid: `${search.fromUid}:${search.toUid}`,
      ...(search.since === null ? {} : { since: new Date(search.since) }),
    }, { uid: true });
    return result === false ? [] : result;
  }

  async fetch(uids: readonly number[]): Promise<readonly ImapMailboxRecord[]> {
    if (uids.length === 0) return [];
    const metadata = await this.client.fetchAll([...uids], {
      uid: true,
      envelope: true,
      internalDate: true,
      bodyStructure: true,
      headers: [
        'Auto-Submitted',
        'Content-Type',
        'X-Autoreply',
        'X-Autorespond',
        'X-Failed-Recipients',
      ],
    }, { uid: true });
    const records: ImapMailboxRecord[] = [];
    for (const message of metadata) {
      records.push(await this.toRecord(message));
    }
    return records;
  }

  async close(): Promise<void> {
    if (!this.connected) {
      this.client.close();
      return;
    }
    this.connected = false;
    try {
      await this.client.logout();
    } catch {
      this.client.close();
    }
  }

  private async toRecord(message: FetchMessageObject): Promise<ImapMailboxRecord> {
    const textPart = preferredTextPart(message.bodyStructure);
    const textContent = textPart
      ? await this.readTextPart(message.uid, textPart)
      : null;
    const envelope = message.envelope;
    return Object.freeze({
      uid: message.uid,
      internetMessageId: envelope?.messageId ?? null,
      inReplyTo: envelope?.inReplyTo ?? null,
      senderAddress: firstAddress(envelope?.from),
      recipientAddresses: Object.freeze([
        ...addresses(envelope?.to),
        ...addresses(envelope?.cc),
        ...addresses(envelope?.bcc),
      ]),
      subject: envelope?.subject ?? null,
      textContent,
      receivedAt: isoTimestamp(message.internalDate),
      contentType: formattedContentType(message.bodyStructure),
      headers: Object.freeze(parseHeaders(message.headers)),
      attachments: Object.freeze(attachmentMetadata(message.bodyStructure)),
    });
  }

  private async readTextPart(
    uid: number,
    part: MessageStructureObject,
  ): Promise<string | null> {
    const partNumber = part.part ?? '1';
    const fetched = await this.client.fetchOne(uid, {
      bodyParts: [{ key: partNumber, start: 0, maxLength: maximumTextPartBytes }],
    }, { uid: true, binary: true });
    if (fetched === false) return null;
    const body = fetched.bodyParts?.get(partNumber);
    if (!body) return null;
    const transferDecoded = fetched.binaryParts?.has(partNumber)
      ? body
      : decodeTransfer(body, part.encoding);
    const decoded = decodeCharset(transferDecoded, part.parameters?.charset);
    const normalized = part.type.toLowerCase() === 'text/html'
      ? htmlToPlainText(decoded)
      : decoded.replace(/\r\n?/g, '\n').trim();
    return normalized.length > 0 ? normalized.slice(0, maximumTextPartBytes) : null;
  }
}

function preferredTextPart(
  root: MessageStructureObject | undefined,
): MessageStructureObject | null {
  if (!root) return null;
  const candidates: MessageStructureObject[] = [];
  visitStructure(root, (node) => {
    if (
      node.type.toLowerCase().startsWith('text/')
      && node.disposition?.toLowerCase() !== 'attachment'
    ) candidates.push(node);
  });
  return candidates.find(({ type }) => type.toLowerCase() === 'text/plain')
    ?? candidates.find(({ type }) => type.toLowerCase() === 'text/html')
    ?? null;
}

function attachmentMetadata(
  root: MessageStructureObject | undefined,
): CustomerMailboxAttachmentMetadata[] {
  if (!root) return [];
  const result: CustomerMailboxAttachmentMetadata[] = [];
  visitStructure(root, (node) => {
    const type = node.type.toLowerCase();
    const topLevelType = type.split('/')[0];
    const attachment = node.disposition?.toLowerCase() === 'attachment'
      || (topLevelType !== 'text' && topLevelType !== 'multipart' && !node.childNodes?.length);
    if (!attachment) return;
    result.push(Object.freeze({
      name: node.dispositionParameters?.filename
        ?? node.parameters?.name
        ?? 'Névtelen melléklet',
      contentType: type || 'application/octet-stream',
      size: Number.isSafeInteger(node.size) && (node.size ?? -1) >= 0
        ? node.size!
        : 0,
    }));
  });
  return result;
}

function visitStructure(
  node: MessageStructureObject,
  visitor: (node: MessageStructureObject) => void,
): void {
  visitor(node);
  for (const child of node.childNodes ?? []) visitStructure(child, visitor);
}

function formattedContentType(root: MessageStructureObject | undefined): string {
  if (!root) return '';
  const parameters = Object.entries(root.parameters ?? {})
    .map(([name, value]) => `${name.toLowerCase()}=${value}`)
    .join('; ');
  return parameters ? `${root.type}; ${parameters}` : root.type;
}

function firstAddress(values: readonly MessageAddressObject[] | undefined): string | null {
  return addresses(values)[0] ?? null;
}

function addresses(values: readonly MessageAddressObject[] | undefined): string[] {
  return (values ?? [])
    .map(({ address }) => address?.trim() ?? '')
    .filter((address) => address.length > 0);
}

function isoTimestamp(value: Date | string | undefined): string | null {
  if (value === undefined) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseHeaders(value: Buffer | undefined): Record<string, string> {
  if (!value) return {};
  const unfolded = value.toString('utf8').replace(/\r?\n[\t ]+/g, ' ');
  const headers: Record<string, string> = {};
  for (const line of unfolded.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim().toLowerCase();
    const headerValue = line.slice(separator + 1).trim();
    if (name && headerValue) headers[name] = headerValue;
  }
  return headers;
}

function decodeTransfer(value: Buffer, encoding: string | undefined): Buffer {
  const normalized = encoding?.trim().toLowerCase();
  if (normalized === 'base64') {
    return Buffer.from(value.toString('ascii').replace(/\s+/g, ''), 'base64');
  }
  if (normalized === 'quoted-printable') {
    const source = value.toString('latin1').replace(/=\r?\n/g, '');
    const bytes: number[] = [];
    for (let index = 0; index < source.length; index += 1) {
      const hexadecimal = source.slice(index + 1, index + 3);
      if (source[index] === '=' && /^[0-9a-f]{2}$/i.test(hexadecimal)) {
        bytes.push(Number.parseInt(hexadecimal, 16));
        index += 2;
      } else {
        bytes.push(source.charCodeAt(index) & 0xff);
      }
    }
    return Buffer.from(bytes);
  }
  return value;
}

function decodeCharset(value: Buffer, charset: string | undefined): string {
  try {
    return new TextDecoder(charset?.trim() || 'utf-8').decode(value);
  } catch {
    return new TextDecoder('utf-8').decode(value);
  }
}

function htmlToPlainText(html: string): string {
  const withoutExecutableBlocks = html.replace(
    /<(script|style|template|head|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    '',
  );
  const withLineBreaks = withoutExecutableBlocks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n');
  return decodeHtmlEntities(withLineBreaks.replace(/<[^>]*>/g, ''))
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t\f\v ]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function decodeHtmlEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, (entity, key: string) => {
    if (!key.startsWith('#')) return named[key.toLowerCase()] ?? entity;
    const hexadecimal = key[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return entity;
    }
  });
}
