import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { simpleParser } from 'mailparser';
import { generate } from 'selfsigned';
import {
  SMTPServer,
  type SMTPServerAuthentication,
  type SMTPServerDataStream,
  type SMTPServerSession,
} from 'smtp-server';

import { CustomerMailBoundaryError } from '../src/mail-delivery/customer-mail-boundary';
import { SmtpCustomerOutboundMail } from '../src/mail-delivery/smtp-customer-outbound-mail';

const tlsIdentity = createTestTlsIdentity();

describe('SMTP Customer outbound mail protocol boundary', () => {
  let server: SMTPServer | null = null;

  afterEach(async () => {
    if (!server) return;
    await close(server);
    server = null;
  });

  it('submits the reviewed Unicode content with the dedicated mailbox identity over authenticated TLS', async () => {
    const identity = await tlsIdentity;
    const received: Array<{ source: Buffer; envelopeFrom: string; envelopeTo: readonly string[] }> = [];
    server = new SMTPServer({
      secure: true,
      key: identity.key,
      cert: identity.certificate,
      authOptional: false,
      onAuth: authenticate,
      onData(stream, session, callback) {
        void collect(stream).then((source) => {
          received.push({
            source,
            envelopeFrom: session.envelope.mailFrom
              ? session.envelope.mailFrom.address
              : '',
            envelopeTo: session.envelope.rcptTo.map(({ address }) => address),
          });
          callback();
        }, callback);
      },
    });
    const port = await listen(server);
    const mail = new SmtpCustomerOutboundMail(configuration(port, identity.caCertificate));

    const result = await mail.submit({
      senderAddress: 'personal-owner@example.test',
      senderName: 'Belső projektgazda',
      recipientAddress: 'project-customer@example.test',
      replyToAddress: 'project-maker+opaque-token@example.test',
      subject: 'Felmérési összefoglaló – pontosítás',
      textContent: 'Kérlek, válaszolj a tisztázandó tételekre.',
      htmlContent: '<p>Kérlek, válaszolj a <strong>tisztázandó tételekre</strong>.</p>',
    });

    assert.equal(result.acceptance, 'ACCEPTED');
    assert.match(result.messageReference ?? '', /^<.+>$/);
    assert.equal(received.length, 1);
    assert.deepEqual(received[0]?.envelopeTo, ['project-customer@example.test']);
    assert.equal(received[0]?.envelopeFrom, 'project-maker@example.test');
    const parsed = await simpleParser(received[0]!.source);
    assert.equal(parsed.from?.value[0]?.name, 'Project Maker');
    assert.equal(parsed.from?.value[0]?.address, 'project-maker@example.test');
    assert.equal(parsed.replyTo?.value[0]?.address, 'project-maker+opaque-token@example.test');
    const parsedTo = Array.isArray(parsed.to) ? parsed.to[0] : parsed.to;
    assert.equal(parsedTo?.value[0]?.address, 'project-customer@example.test');
    assert.equal(parsed.subject, 'Felmérési összefoglaló – pontosítás');
    assert.equal(parsed.text?.trim(), 'Kérlek, válaszolj a tisztázandó tételekre.');
    assert.equal(
      parsed.html,
      '<p>Kérlek, válaszolj a <strong>tisztázandó tételekre</strong>.</p>',
    );
    assert.equal(received[0]?.source.includes(Buffer.from('personal-owner@example.test')), false);
  });

  it('maps authentication rejection to a bounded provider-neutral error', async () => {
    const identity = await tlsIdentity;
    server = new SMTPServer({
      secure: true,
      key: identity.key,
      cert: identity.certificate,
      onAuth(_auth, _session, callback) {
        const error = new Error('secret provider diagnostic') as Error & { responseCode: number };
        error.responseCode = 535;
        callback(error);
      },
    });
    const port = await listen(server);
    const mail = new SmtpCustomerOutboundMail(
      configuration(port, identity.caCertificate),
    );

    await assert.rejects(
      mail.submit({
        recipientAddress: 'project-customer@example.test',
        replyToAddress: 'project-maker+token@example.test',
        subject: 'Pontosítás',
        textContent: 'Tartalom',
      }),
      (error: unknown) => error instanceof CustomerMailBoundaryError
        && error.code === 'AUTHENTICATION_ERROR'
        && !error.message.includes('secret'),
    );
  });

  it('maps an explicit post-DATA 5xx rejection to rejected submission', async () => {
    const identity = await tlsIdentity;
    server = new SMTPServer({
      secure: true,
      key: identity.key,
      cert: identity.certificate,
      authOptional: false,
      onAuth: authenticate,
      onData(stream, _session, callback) {
        void collect(stream).then(() => {
          const error = new Error('message content rejected') as Error & { responseCode: number };
          error.responseCode = 550;
          callback(error);
        }, callback);
      },
    });
    const port = await listen(server);
    const mail = new SmtpCustomerOutboundMail(configuration(port, identity.caCertificate));

    await assert.rejects(
      mail.submit(outboundMessage()),
      boundaryError('SUBMISSION_REJECTED'),
    );
  });

  it('treats a connection loss after DATA as an unknown submission outcome', async () => {
    const identity = await tlsIdentity;
    server = new SMTPServer({
      secure: true,
      key: identity.key,
      cert: identity.certificate,
      authOptional: false,
      onAuth: authenticate,
      onData(stream, _session, _callback) {
        void collect(stream).then(() => {
          for (const connection of server!.connections) {
            connection._socket.destroy();
          }
        });
      },
    });
    const port = await listen(server);
    const mail = new SmtpCustomerOutboundMail(configuration(port, identity.caCertificate));

    await assert.rejects(mail.submit(outboundMessage()), boundaryError('OUTCOME_UNKNOWN'));
  });

  it('treats a connection loss before DATA as a retryable temporary failure', async () => {
    const identity = await tlsIdentity;
    let receivedData = false;
    server = new SMTPServer({
      secure: true,
      key: identity.key,
      cert: identity.certificate,
      authOptional: false,
      onAuth: authenticate,
      onMailFrom(_address, _session, _callback) {
        for (const connection of server!.connections) {
          connection._socket.destroy();
        }
      },
      onData(stream, _session, callback) {
        receivedData = true;
        void collect(stream).then(() => callback(), callback);
      },
    });
    const port = await listen(server);
    const mail = new SmtpCustomerOutboundMail(configuration(port, identity.caCertificate));

    await assert.rejects(mail.submit(outboundMessage()), boundaryError('TEMPORARY_FAILURE'));
    assert.equal(receivedData, false);
  });

  it('fails closed when a STARTTLS-required gateway does not advertise STARTTLS', async () => {
    let receivedData = false;
    server = new SMTPServer({
      disabledCommands: ['STARTTLS'],
      authOptional: true,
      onData(stream, _session, callback) {
        receivedData = true;
        void collect(stream).then(() => callback(), callback);
      },
    });
    const port = await listen(server);
    const mail = new SmtpCustomerOutboundMail(configuration(
      port,
      undefined,
      'STARTTLS_REQUIRED',
    ));

    await assert.rejects(mail.submit(outboundMessage()), boundaryError('TEMPORARY_FAILURE'));
    assert.equal(receivedData, false);
  });
});

function authenticate(
  auth: SMTPServerAuthentication,
  _session: SMTPServerSession,
  callback: (error: Error | null, response?: { user: string }) => void,
): void {
  if (auth.username === 'smtp-user' && auth.password === 'smtp-secret') {
    callback(null, { user: auth.username });
    return;
  }
  callback(new Error('Authentication rejected.'));
}

function outboundMessage() {
  return {
    recipientAddress: 'project-customer@example.test',
    replyToAddress: 'project-maker+token@example.test',
    subject: 'Pontosítás',
    textContent: 'Tartalom',
  };
}

function boundaryError(code: CustomerMailBoundaryError['code']) {
  return (error: unknown) => error instanceof CustomerMailBoundaryError && error.code === code;
}

function configuration(
  port: number,
  trustAnchor: string | undefined,
  security: 'IMPLICIT_TLS' | 'STARTTLS_REQUIRED' = 'IMPLICIT_TLS',
): ConfigService {
  return new ConfigService({
    CORRESPONDENCE_MAILBOX_NAME: 'Project Maker',
    CORRESPONDENCE_MAILBOX_ADDRESS: 'project-maker@example.test',
    MAIL_GATEWAY_SMTP_HOST: 'localhost',
    MAIL_GATEWAY_SMTP_PORT: String(port),
    MAIL_GATEWAY_SMTP_SECURITY: security,
    MAIL_GATEWAY_SMTP_USERNAME: 'smtp-user',
    MAIL_GATEWAY_SMTP_PASSWORD: 'smtp-secret',
    MAIL_GATEWAY_IMAP_HOST: 'imap.example.test',
    MAIL_GATEWAY_IMAP_SECURITY: 'IMPLICIT_TLS',
    MAIL_GATEWAY_IMAP_USERNAME: 'imap-user',
    MAIL_GATEWAY_IMAP_PASSWORD: 'imap-secret',
    ...(trustAnchor === undefined ? {} : {
      MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64: Buffer.from(trustAnchor).toString('base64'),
    }),
  });
}

async function collect(stream: SMTPServerDataStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function listen(server: SMTPServer): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, 'localhost', resolve);
  });
  const address = server.server.address();
  if (!address || typeof address === 'string') throw new Error('SMTP test port missing.');
  return address.port;
}

async function close(server: SMTPServer): Promise<void> {
  await new Promise<void>((resolve) => server.close(resolve));
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
  return {
    key: server.private,
    certificate: server.cert,
    caCertificate: ca.cert,
  };
}
