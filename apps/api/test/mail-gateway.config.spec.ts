import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMailGatewayConfiguration } from '../src/config/mail-gateway.config';

describe('Operator-provided mail gateway configuration', () => {
  it('accepts separate TLS-only SMTP and IMAP profiles', () => {
    const configuration = createMailGatewayConfiguration(new ConfigService({
      CORRESPONDENCE_MAILBOX_NAME: 'Project Maker',
      CORRESPONDENCE_MAILBOX_ADDRESS: 'project-maker@example.test',
      MAIL_GATEWAY_SMTP_HOST: 'smtp.example.test',
      MAIL_GATEWAY_SMTP_PORT: '587',
      MAIL_GATEWAY_SMTP_SECURITY: 'STARTTLS_REQUIRED',
      MAIL_GATEWAY_SMTP_USERNAME: 'smtp-project-maker',
      MAIL_GATEWAY_SMTP_PASSWORD: 'smtp-secret',
      MAIL_GATEWAY_IMAP_HOST: 'imap.example.test',
      MAIL_GATEWAY_IMAP_PORT: '993',
      MAIL_GATEWAY_IMAP_SECURITY: 'IMPLICIT_TLS',
      MAIL_GATEWAY_IMAP_USERNAME: 'imap-project-maker',
      MAIL_GATEWAY_IMAP_PASSWORD: 'imap-secret',
      MAIL_GATEWAY_IMAP_FOLDER: 'INBOX',
      MAIL_GATEWAY_CHECKPOINT_SECRET: 'checkpoint-secret-with-at-least-32-bytes',
    }));

    assert.deepEqual(configuration, {
      mailbox: {
        name: 'Project Maker',
        address: 'project-maker@example.test',
      },
      smtp: {
        host: 'smtp.example.test',
        port: 587,
        security: 'STARTTLS_REQUIRED',
        username: 'smtp-project-maker',
        password: 'smtp-secret',
      },
      imap: {
        host: 'imap.example.test',
        port: 993,
        security: 'IMPLICIT_TLS',
        username: 'imap-project-maker',
        password: 'imap-secret',
        folder: 'INBOX',
      },
      checkpointSecret: 'checkpoint-secret-with-at-least-32-bytes',
      tlsCaCertificate: null,
      timeoutMs: 10_000,
    });
  });

  it('fails closed without throwing when either channel is partial or plaintext', () => {
    const base = completeConfiguration();
    const invalidConfigurations = [
      { ...base, MAIL_GATEWAY_SMTP_PASSWORD: '' },
      { ...base, MAIL_GATEWAY_IMAP_HOST: '' },
      { ...base, MAIL_GATEWAY_SMTP_SECURITY: 'PLAINTEXT' },
      { ...base, MAIL_GATEWAY_IMAP_SECURITY: 'PLAINTEXT' },
      { ...base, MAIL_GATEWAY_CHECKPOINT_SECRET: 'too-short' },
      { ...base, CORRESPONDENCE_MAILBOX_NAME: 'Project\r\nMaker' },
    ];

    for (const values of invalidConfigurations) {
      assert.equal(createMailGatewayConfiguration(new ConfigService(values)), null);
    }
  });

  it('does not treat retired Graph settings as a mail gateway fallback', () => {
    const configuration = createMailGatewayConfiguration(new ConfigService({
      CORRESPONDENCE_MAILBOX_NAME: 'Project Maker',
      CORRESPONDENCE_MAILBOX_ADDRESS: 'project-maker@example.test',
      GRAPH_TENANT_ID: 'tenant',
      GRAPH_CLIENT_ID: 'client',
      GRAPH_CLIENT_CERTIFICATE_THUMBPRINT: 'A'.repeat(40),
      GRAPH_CLIENT_PRIVATE_KEY_BASE64: 'secret',
    }));

    assert.equal(configuration, null);
  });

  it('accepts a private trust anchor only as a valid PEM certificate', () => {
    const certificate = [
      '-----BEGIN CERTIFICATE-----',
      'dGVzdC1jZXJ0aWZpY2F0ZQ==',
      '-----END CERTIFICATE-----',
    ].join('\n');
    const valid = createMailGatewayConfiguration(new ConfigService({
      ...completeConfiguration(),
      MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64: Buffer.from(certificate).toString('base64'),
    }));
    const invalid = createMailGatewayConfiguration(new ConfigService({
      ...completeConfiguration(),
      MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64: Buffer.from('not a certificate').toString('base64'),
    }));

    assert.equal(valid?.tlsCaCertificate, certificate);
    assert.equal(invalid, null);
  });
});

function completeConfiguration(): Record<string, string> {
  return {
    CORRESPONDENCE_MAILBOX_NAME: 'Project Maker',
    CORRESPONDENCE_MAILBOX_ADDRESS: 'project-maker@example.test',
    MAIL_GATEWAY_SMTP_HOST: 'smtp.example.test',
    MAIL_GATEWAY_SMTP_SECURITY: 'STARTTLS_REQUIRED',
    MAIL_GATEWAY_SMTP_USERNAME: 'smtp-user',
    MAIL_GATEWAY_SMTP_PASSWORD: 'smtp-secret',
    MAIL_GATEWAY_IMAP_HOST: 'imap.example.test',
    MAIL_GATEWAY_IMAP_SECURITY: 'IMPLICIT_TLS',
    MAIL_GATEWAY_IMAP_USERNAME: 'imap-user',
    MAIL_GATEWAY_IMAP_PASSWORD: 'imap-secret',
    MAIL_GATEWAY_CHECKPOINT_SECRET: 'checkpoint-secret-with-at-least-32-bytes',
  };
}
