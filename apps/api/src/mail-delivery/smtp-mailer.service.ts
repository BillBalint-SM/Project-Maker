import { connect as connectNet, type Socket } from 'node:net';
import { connect as connectTls, type TLSSocket } from 'node:tls';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createSmtpConfiguration, type SmtpConfiguration } from '../config/email.config';

export const customerMailerToken = 'CUSTOMER_MAILER';

export interface CustomerMailerMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

export interface CustomerMailer {
  isConfigured(): boolean;
  send(message: CustomerMailerMessage): Promise<void>;
}

@Injectable()
export class SmtpMailerService implements CustomerMailer {
  private readonly configuration: SmtpConfiguration | null;

  constructor(configService: ConfigService) {
    this.configuration = createSmtpConfiguration(configService);
  }

  isConfigured(): boolean {
    return this.configuration !== null;
  }

  async send(message: CustomerMailerMessage): Promise<void> {
    const configuration = this.configuration;
    if (!configuration) throw new SmtpDeliveryError();
    validateMessage(message);
    const socket = await openSocket(configuration);
    const session = new SmtpSession(socket, configuration.timeoutMs);
    let deliveryMayHaveBeenAccepted = false;
    try {
      await session.expect([220]);
      await session.command('EHLO project-maker', [250]);
      if (configuration.username && configuration.password) {
        const credentials = Buffer.from(
          `\u0000${configuration.username}\u0000${configuration.password}`,
          'utf8',
        ).toString('base64');
        await session.command(`AUTH PLAIN ${credentials}`, [235]);
      }
      await session.command(`MAIL FROM:<${safeAddress(configuration.from)}>`, [250]);
      await session.command(`RCPT TO:<${safeAddress(message.to)}>`, [250, 251]);
      await session.command('DATA', [354]);
      deliveryMayHaveBeenAccepted = true;
      await session.writeData(createMessage(configuration.from, message));
      await session.expect([250]);
    } catch (error) {
      if (deliveryMayHaveBeenAccepted && !(error instanceof SmtpDeliveryRejectedError)) {
        throw new SmtpDeliveryUnknownError();
      }
      throw new SmtpDeliveryError();
    } finally {
      session.close();
    }
  }
}

export class SmtpDeliveryError extends Error {
  constructor() {
    super('SMTP delivery failed.');
    this.name = 'SmtpDeliveryError';
  }
}

export class SmtpDeliveryUnknownError extends Error {
  constructor() {
    super('SMTP delivery result is unknown.');
    this.name = 'SmtpDeliveryUnknownError';
  }
}

class SmtpDeliveryRejectedError extends SmtpDeliveryError {
  constructor() {
    super();
    this.name = 'SmtpDeliveryRejectedError';
  }
}

function validateMessage(message: CustomerMailerMessage): void {
  if (!isSafeAddress(message.to) || /[\r\n]/.test(message.subject)) {
    throw new SmtpDeliveryError();
  }
}

function isSafeAddress(value: string): boolean {
  return value.length > 3 && !/[\r\n<>]/.test(value) && /^[^@\s]+@[^@\s]+$/.test(value);
}

function safeAddress(value: string): string {
  if (!isSafeAddress(value)) throw new SmtpDeliveryError();
  return value;
}

function createMessage(from: string, message: CustomerMailerMessage): string {
  const headers = [
    `From: ${from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
  ];
  if (!message.html) {
    return finishMessage([
      ...headers,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.text,
    ]);
  }
  const boundary = `project-maker-${Date.now().toString(36)}`;
  return finishMessage([
    ...headers,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.text,
    `--${boundary}`,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    message.html,
    `--${boundary}--`,
  ]);
}

function finishMessage(lines: readonly string[]): string {
  const body = lines.join('\n').replace(/\r?\n/g, '\r\n');
  return `${body.split('\r\n').map((line) => line.startsWith('.') ? `.${line}` : line).join('\r\n')}\r\n.\r\n`;
}

async function openSocket(configuration: SmtpConfiguration): Promise<Socket | TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = configuration.secure
      ? connectTls({ host: configuration.host, port: configuration.port, servername: configuration.host })
      : connectNet({ host: configuration.host, port: configuration.port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new SmtpDeliveryError());
    }, configuration.timeoutMs);
    const connected = (): void => { clearTimeout(timeout); resolve(socket); };
    socket.once(configuration.secure ? 'secureConnect' : 'connect', connected);
    socket.once('error', () => { clearTimeout(timeout); reject(new SmtpDeliveryError()); });
  });
}

class SmtpSession {
  private readonly chunks: Buffer[] = [];
  private pending: { resolve: (value: string) => void; reject: (error: Error) => void } | null = null;
  private closed = false;

  constructor(private readonly socket: Socket | TLSSocket, timeoutMs: number) {
    socket.setTimeout(timeoutMs, () => this.fail());
    socket.on('data', (chunk: Buffer) => { this.chunks.push(chunk); this.flush(); });
    socket.on('error', () => this.fail());
    socket.on('close', () => this.fail());
  }

  async expect(codes: readonly number[]): Promise<void> {
    const response = await this.read();
    if (!codes.includes(Number(response.slice(0, 3)))) throw new SmtpDeliveryRejectedError();
  }

  async command(command: string, codes: readonly number[]): Promise<void> {
    await this.write(`${command}\r\n`);
    await this.expect(codes);
  }

  async writeData(value: string): Promise<void> { await this.write(value); }

  close(): void { this.closed = true; this.pending = null; this.socket.end(); this.socket.destroy(); }

  private async write(value: string): Promise<void> {
    if (this.closed) throw new SmtpDeliveryError();
    await new Promise<void>((resolve, reject) => this.socket.write(value, 'utf8', (error?: Error | null) => error ? reject(new SmtpDeliveryError()) : resolve()));
  }

  private read(): Promise<string> {
    if (this.closed) return Promise.reject(new SmtpDeliveryError());
    return new Promise((resolve, reject) => { this.pending = { resolve, reject }; this.flush(); });
  }

  private flush(): void {
    if (!this.pending) return;
    const lines = Buffer.concat(this.chunks).toString('utf8').split('\r\n');
    const last = lines.at(-2) ?? '';
    if (lines.at(-1) !== '' || !/^\d{3} /.test(last)) return;
    const pending = this.pending;
    this.pending = null;
    this.chunks.length = 0;
    pending.resolve(last);
  }

  private fail(): void {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    pending.reject(new SmtpDeliveryError());
  }
}
