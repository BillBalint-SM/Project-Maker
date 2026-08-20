import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  MailSubmissionResult,
  OutboundCustomerMessage,
} from '@project-maker/contracts';
import nodemailer, { type Transporter } from 'nodemailer';
import type { Logger } from 'nodemailer/lib/shared';

import {
  createMailGatewayConfiguration,
  type MailGatewayConfiguration,
} from '../config/mail-gateway.config';
import {
  CustomerMailBoundaryError,
  type CustomerOutboundMail,
} from './customer-mail-boundary';

interface NodemailerFailure {
  readonly code?: unknown;
  readonly command?: unknown;
  readonly responseCode?: unknown;
}

@Injectable()
export class SmtpCustomerOutboundMail implements CustomerOutboundMail {
  private readonly configuration: MailGatewayConfiguration | null;

  constructor(config: ConfigService) {
    this.configuration = createMailGatewayConfiguration(config);
  }

  isConfigured(): boolean {
    return this.configuration !== null;
  }

  async submit(message: OutboundCustomerMessage): Promise<MailSubmissionResult> {
    const configuration = this.configuration;
    if (!configuration) {
      throw new CustomerMailBoundaryError('CONFIGURATION_ERROR');
    }
    requireSafeMessage(message);
    let messageStreamCompleted = false;
    const transporter = createTransporter(configuration, () => {
      messageStreamCompleted = true;
    });
    try {
      const result = await transporter.sendMail({
        from: {
          name: configuration.mailbox.name,
          address: configuration.mailbox.address,
        },
        to: message.recipientAddress,
        replyTo: message.replyToAddress ?? configuration.mailbox.address,
        subject: message.subject,
        text: message.textContent,
        ...(message.htmlContent === undefined ? {} : { html: message.htmlContent }),
        envelope: {
          from: configuration.mailbox.address,
          to: [message.recipientAddress],
        },
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      const acceptedAddresses: readonly unknown[] = Array.isArray(result.accepted)
        ? result.accepted
        : [];
      const accepted = acceptedAddresses.some(
        (address) => String(address).toLowerCase() === message.recipientAddress.toLowerCase(),
      );
      return Object.freeze({
        acceptance: accepted ? 'ACCEPTED' : 'REJECTED',
        messageReference: accepted && typeof result.messageId === 'string'
          ? result.messageId
          : null,
      });
    } catch (error) {
      throw normalizeSmtpFailure(error, messageStreamCompleted);
    }
  }
}

function createTransporter(
  configuration: MailGatewayConfiguration,
  onMessageStreamCompleted: () => void,
): Transporter {
  const implicitTls = configuration.smtp.security === 'IMPLICIT_TLS';
  return nodemailer.createTransport({
    host: configuration.smtp.host,
    port: configuration.smtp.port,
    secure: implicitTls,
    requireTLS: !implicitTls,
    auth: {
      user: configuration.smtp.username,
      pass: configuration.smtp.password,
    },
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      servername: configuration.smtp.host,
      ...(configuration.tlsCaCertificate === null
        ? {}
        : { ca: configuration.tlsCaCertificate }),
    },
    connectionTimeout: configuration.timeoutMs,
    greetingTimeout: configuration.timeoutMs,
    socketTimeout: configuration.timeoutMs,
    logger: createSubmissionPhaseObserver(onMessageStreamCompleted),
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

function createSubmissionPhaseObserver(onMessageStreamCompleted: () => void): Logger {
  const discard = (..._parameters: unknown[]): void => undefined;
  return {
    level: discard,
    trace: discard,
    debug: discard,
    info(metadata: unknown) {
      // Nodemailer emits this event after the complete DATA stream is handed to the socket.
      // Observe only that phase marker; never retain or emit its diagnostic arguments.
      if (
        isRecord(metadata)
        && metadata.tnx === 'message'
        && typeof metadata.inByteCount === 'number'
        && typeof metadata.outByteCount === 'number'
      ) {
        onMessageStreamCompleted();
      }
    },
    warn: discard,
    error: discard,
    fatal: discard,
  };
}

function requireSafeMessage(message: OutboundCustomerMessage): void {
  if (
    !safeAddress(message.recipientAddress)
    || (message.replyToAddress !== undefined && !safeAddress(message.replyToAddress))
    || /[\r\n]/.test(message.subject)
  ) {
    throw new CustomerMailBoundaryError('SUBMISSION_REJECTED');
  }
}

function safeAddress(value: string): boolean {
  return value.length <= 320
    && !/[\r\n<>]/.test(value)
    && /^[^@\s]+@[^@\s]+$/.test(value);
}

function normalizeSmtpFailure(
  error: unknown,
  messageStreamCompleted: boolean,
): CustomerMailBoundaryError {
  const failure = isFailure(error) ? error : {};
  const code = typeof failure.code === 'string' ? failure.code.toUpperCase() : '';
  const command = typeof failure.command === 'string'
    ? failure.command.toUpperCase()
    : '';
  const responseCode = typeof failure.responseCode === 'number'
    ? failure.responseCode
    : null;

  if (code === 'EAUTH' || responseCode === 530 || responseCode === 534 || responseCode === 535) {
    return new CustomerMailBoundaryError('AUTHENTICATION_ERROR');
  }
  if (command === 'STARTTLS') {
    return new CustomerMailBoundaryError('TEMPORARY_FAILURE');
  }
  if (responseCode !== null && responseCode >= 500) {
    return new CustomerMailBoundaryError('SUBMISSION_REJECTED');
  }
  if (responseCode !== null && responseCode >= 400) {
    return new CustomerMailBoundaryError('TEMPORARY_FAILURE');
  }
  if (command === 'DATA' || messageStreamCompleted) {
    return new CustomerMailBoundaryError('OUTCOME_UNKNOWN');
  }
  return new CustomerMailBoundaryError('TEMPORARY_FAILURE');
}

function isFailure(value: unknown): value is NodemailerFailure {
  return typeof value === 'object' && value !== null;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}
