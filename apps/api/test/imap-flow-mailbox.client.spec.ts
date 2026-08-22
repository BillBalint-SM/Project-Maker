import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { createServer, type Server as TlsServer, type TLSSocket } from 'node:tls';
import { afterEach, describe, it } from 'node:test';
import { generate } from 'selfsigned';

import { CustomerMailBoundaryError } from '../src/mail-delivery/customer-mail-boundary';
import { ImapCustomerMailboxChanges } from '../src/mail-delivery/imap-customer-mailbox-changes';
import { ImapFlowMailboxClientFactory } from '../src/mail-delivery/imap-flow-mailbox.client';

const tlsIdentity = createTestTlsIdentity();

describe('IMAP protocol client', () => {
  let server: ControlledImapServer | null = null;

  afterEach(async () => {
    await server?.close();
    server = null;
  });

  it('reads one bounded Customer reply through authenticated implicit TLS', async () => {
    const identity = await tlsIdentity;
    server = new ControlledImapServer(identity, 'ACCEPT');
    const port = await server.listen();
    const mailbox = new ImapCustomerMailboxChanges(
      configuration(port, identity.caCertificate),
      new ImapFlowMailboxClientFactory(),
    );

    const page = await mailbox.readChanges(null, '2026-08-20T08:00:00.000Z');

    assert.deepEqual(page.changes, [{
      changeType: 'UPSERTED',
      automationKind: 'HUMAN',
      messageReference: '91:7',
      internetMessageId: '<reply-7@example.test>',
      inReplyTo: '<outbound@example.test>',
      senderAddress: 'customer@example.test',
      recipientAddresses: ['project-maker+opaque-token@example.test'],
      subject: 'Re: Project summary',
      textContent: 'Köszönöm, a projekt folytatható.',
      receivedAt: '2026-08-20T08:01:00.000Z',
      attachmentCount: 0,
      attachments: [],
    }]);
    assert.equal(page.nextPageCheckpoint, null);
    assert.ok(page.completedCheckpoint);
    assert.equal(server.authenticatedUsername, 'imap-user');
    assert.equal(server.commands.some((command) => command.includes('UID SEARCH')), true);
    assert.equal(server.commands.some((command) => command.includes('UID FETCH')), true);
    assert.equal(server.commands.join('\n').includes('imap-secret'), false);
  });

  it('maps an IMAP authentication rejection without leaking server diagnostics', async () => {
    const identity = await tlsIdentity;
    server = new ControlledImapServer(identity, 'REJECT');
    const port = await server.listen();
    const mailbox = new ImapCustomerMailboxChanges(
      configuration(port, identity.caCertificate),
      new ImapFlowMailboxClientFactory(),
    );

    await assert.rejects(
      mailbox.readChanges(null, null),
      (error: unknown) => error instanceof CustomerMailBoundaryError
        && error.code === 'AUTHENTICATION_ERROR'
        && !error.message.includes('secret provider diagnostic'),
    );
  });

  it('treats a connection loss during SEARCH as a retryable boundary failure', async () => {
    const identity = await tlsIdentity;
    server = new ControlledImapServer(identity, 'DISCONNECT_ON_SEARCH');
    const port = await server.listen();
    const mailbox = new ImapCustomerMailboxChanges(
      configuration(port, identity.caCertificate),
      new ImapFlowMailboxClientFactory(),
    );

    await assert.rejects(
      mailbox.readChanges(null, '2026-08-20T08:00:00.000Z'),
      (error: unknown) => error instanceof CustomerMailBoundaryError
        && error.code === 'TEMPORARY_FAILURE',
    );
    assert.equal(server.commands.some((command) => command.includes('UID SEARCH')), true);
  });
});

class ControlledImapServer {
  readonly commands: string[] = [];
  authenticatedUsername: string | null = null;
  private readonly server: TlsServer;
  private sockets = new Set<TLSSocket>();

  constructor(
    identity: { readonly key: string; readonly certificate: string },
    private readonly authentication: 'ACCEPT' | 'REJECT' | 'DISCONNECT_ON_SEARCH',
  ) {
    this.server = createServer(
      { key: identity.key, cert: identity.certificate, minVersion: 'TLSv1.2' },
      (socket) => this.handle(socket),
    );
  }

  async listen(): Promise<number> {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, 'localhost', resolve);
    });
    const address = this.server.address();
    if (!address || typeof address === 'string') throw new Error('IMAP test port missing.');
    return address.port;
  }

  async close(): Promise<void> {
    for (const socket of this.sockets) socket.destroy();
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }

  private handle(socket: TLSSocket): void {
    this.sockets.add(socket);
    socket.setEncoding('utf8');
    socket.write('* OK Project Maker IMAP test server ready\r\n');
    let buffer = '';
    let authenticationTag: string | null = null;
    socket.on('data', (chunk: string) => {
      buffer += chunk;
      for (;;) {
        const lineEnd = buffer.indexOf('\r\n');
        if (lineEnd < 0) break;
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        if (authenticationTag) {
          this.completeAuthentication(socket, authenticationTag, line);
          authenticationTag = null;
          continue;
        }
        this.commands.push(redactCommand(line));
        const match = /^(\S+)\s+([\s\S]+)$/.exec(line);
        if (!match) continue;
        const [, tag, command] = match;
        const upper = command.toUpperCase();
        if (upper === 'CAPABILITY') {
          socket.write(`* CAPABILITY IMAP4rev1 AUTH=PLAIN\r\n${tag} OK CAPABILITY completed\r\n`);
        } else if (upper.startsWith('AUTHENTICATE PLAIN')) {
          const initial = command.split(/\s+/)[2];
          if (initial) this.completeAuthentication(socket, tag, initial);
          else {
            authenticationTag = tag;
            socket.write('+ \r\n');
          }
        } else if (upper.startsWith('LOGIN ')) {
          this.finishAuthentication(socket, tag, 'imap-user');
        } else if (upper === 'NAMESPACE') {
          socket.write(`* NAMESPACE (("" "/")) NIL NIL\r\n${tag} OK NAMESPACE completed\r\n`);
        } else if (upper.startsWith('LIST ') || upper.startsWith('LSUB ')) {
          socket.write(`* LIST (\\HasNoChildren) "/" "INBOX"\r\n${tag} OK LIST completed\r\n`);
        } else if (upper.startsWith('SELECT ') || upper.startsWith('EXAMINE ')) {
          socket.write([
            '* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)',
            '* 1 EXISTS',
            '* 0 RECENT',
            '* OK [UIDVALIDITY 91] UIDs valid',
            '* OK [UIDNEXT 8] Predicted next UID',
            `${tag} OK [READ-ONLY] SELECT completed`,
            '',
          ].join('\r\n'));
        } else if (upper.startsWith('UID SEARCH ')) {
          if (this.authentication === 'DISCONNECT_ON_SEARCH') socket.destroy();
          else socket.write(`* SEARCH 7\r\n${tag} OK SEARCH completed\r\n`);
        } else if (upper.startsWith('UID FETCH ')) {
          this.respondToFetch(socket, tag, command);
        } else if (upper === 'NOOP') {
          socket.write(`${tag} OK NOOP completed\r\n`);
        } else if (upper === 'LOGOUT') {
          socket.write(`* BYE Logging out\r\n${tag} OK LOGOUT completed\r\n`);
          socket.end();
        } else {
          socket.write(`${tag} BAD Unsupported test command\r\n`);
        }
      }
    });
    socket.once('close', () => this.sockets.delete(socket));
  }

  private completeAuthentication(socket: TLSSocket, tag: string, encoded: string): void {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8').split('\0');
    const username = decoded.at(-2) ?? '';
    const password = decoded.at(-1) ?? '';
    this.finishAuthentication(
      socket,
      tag,
      username === 'imap-user' && password === 'imap-secret' ? username : '',
    );
  }

  private finishAuthentication(socket: TLSSocket, tag: string, username: string): void {
    if (this.authentication !== 'REJECT' && username) {
      this.authenticatedUsername = username;
      socket.write(`${tag} OK AUTHENTICATE completed\r\n`);
      return;
    }
    socket.write(`${tag} NO [AUTHENTICATIONFAILED] secret provider diagnostic\r\n`);
  }

  private respondToFetch(socket: TLSSocket, tag: string, command: string): void {
    if (/BODY\.PEEK\[1\]/i.test(command)) {
      const body = Buffer.from('Köszönöm, a projekt folytatható.\r\n', 'utf8');
      socket.write(`* 1 FETCH (UID 7 BODY[1] {${body.length}}\r\n`);
      socket.write(body);
      socket.write(`)\r\n${tag} OK FETCH completed\r\n`);
      return;
    }
    const headers = Buffer.from([
      'Auto-Submitted: no',
      'Content-Type: text/plain; charset=utf-8',
      '',
      '',
    ].join('\r\n'), 'utf8');
    const requestedHeaders = /BODY\.PEEK(\[HEADER\.FIELDS \([^\]]+\)\])/i.exec(command)?.[1]
      ?? '[HEADER]';
    const envelope = [
      '"Thu, 20 Aug 2026 08:01:00 +0000"',
      '"Re: Project summary"',
      '(("Customer" NIL "customer" "example.test"))',
      '(("Customer" NIL "customer" "example.test"))',
      '(("Customer" NIL "customer" "example.test"))',
      '(("Project Maker" NIL "project-maker+opaque-token" "example.test"))',
      'NIL',
      'NIL',
      '"<outbound@example.test>"',
      '"<reply-7@example.test>"',
    ].join(' ');
    const bodyStructure = '("TEXT" "PLAIN" ("CHARSET" "UTF-8") NIL NIL "8BIT" 39 1 NIL NIL NIL NIL)';
    socket.write(
      `* 1 FETCH (UID 7 INTERNALDATE "20-Aug-2026 08:01:00 +0000" ENVELOPE (${envelope}) BODYSTRUCTURE ${bodyStructure} BODY${requestedHeaders} {${headers.length}}\r\n`,
    );
    socket.write(headers);
    socket.write(`)\r\n${tag} OK FETCH completed\r\n`);
  }
}

function configuration(port: number, caCertificate: string): ConfigService {
  return new ConfigService({
    CORRESPONDENCE_MAILBOX_NAME: 'Project Maker',
    CORRESPONDENCE_MAILBOX_ADDRESS: 'project-maker@example.test',
    MAIL_GATEWAY_SMTP_HOST: 'smtp.example.test',
    MAIL_GATEWAY_SMTP_SECURITY: 'STARTTLS_REQUIRED',
    MAIL_GATEWAY_SMTP_USERNAME: 'smtp-user',
    MAIL_GATEWAY_SMTP_PASSWORD: 'smtp-secret',
    MAIL_GATEWAY_IMAP_HOST: 'localhost',
    MAIL_GATEWAY_IMAP_PORT: String(port),
    MAIL_GATEWAY_IMAP_SECURITY: 'IMPLICIT_TLS',
    MAIL_GATEWAY_IMAP_USERNAME: 'imap-user',
    MAIL_GATEWAY_IMAP_PASSWORD: 'imap-secret',
    MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64: Buffer.from(caCertificate).toString('base64'),
  });
}

function redactCommand(command: string): string {
  return /^\S+\s+AUTHENTICATE\s+/i.test(command)
    ? command.replace(/(AUTHENTICATE\s+\S+).*/i, '$1 [REDACTED]')
    : command;
}

async function createTestTlsIdentity(): Promise<{
  readonly key: string;
  readonly certificate: string;
  readonly caCertificate: string;
}> {
  const ca = await generate([{ name: 'commonName', value: 'Project Maker test CA' }], {
    algorithm: 'sha256',
    keySize: 2048,
    notAfterDate: new Date('2036-01-01T00:00:00.000Z'),
    extensions: [
      { name: 'basicConstraints', cA: true, critical: true },
      { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
    ],
  });
  const server = await generate([{ name: 'commonName', value: 'localhost' }], {
    algorithm: 'sha256',
    keySize: 2048,
    notAfterDate: new Date('2036-01-01T00:00:00.000Z'),
    ca: { key: ca.private, cert: ca.cert },
    extensions: [
      { name: 'basicConstraints', cA: false, critical: true },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
      { name: 'extKeyUsage', serverAuth: true },
      { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] },
    ],
  });
  return { key: server.private, certificate: server.cert, caCertificate: ca.cert };
}
