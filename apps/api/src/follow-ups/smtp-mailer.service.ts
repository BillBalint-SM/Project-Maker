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
    if (!configuration) {
      throw new SmtpDeliveryError();
    }

    validateMessage(message);
    const socket = await openSocket(configuration);
    const session = new SmtpSession(socket, configuration.timeoutMs);
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

      const sender = sanitizeAddress(configuration.from);
      const recipient = sanitizeAddress(message.to);
      await session.command(`MAIL FROM:<${sender}>`, [250]);
      await session.command(`RCPT TO:<${recipient}>`, [250, 251]);
      await session.command('DATA', [354]);
      await session.writeData(createMessage(configuration.from, message));
      await session.expect([250]);
    } catch {
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

function validateMessage(message: CustomerMailerMessage): void {
  if (!isSafeAddress(message.to) || message.subject.includes('\r') || message.subject.includes('\n')) {
    throw new SmtpDeliveryError();
  }
}

function isSafeAddress(value: string): boolean {
  return value.length > 3 && !/[\r\n<>]/.test(value) && /^[^@\s]+@[^@\s]+$/.test(value);
}

function sanitizeAddress(value: string): string {
  if (!isSafeAddress(value)) {
    throw new SmtpDeliveryError();
  }
  return value;
}

function createMessage(from: string, message: CustomerMailerMessage): string {
  const body = message.text.replace(/\r?\n/g, '\r\n');
  const stuffedBody = body
    .split('\r\n')
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
  return [
    `From: ${from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    stuffedBody,
    '.',
    '',
  ].join('\r\n');
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
    const connected = (): void => {
      clearTimeout(timeout);
      resolve(socket);
    };
    if (configuration.secure) {
      socket.once('secureConnect', connected);
    } else {
      socket.once('connect', connected);
    }
    socket.once('error', () => {
      clearTimeout(timeout);
      reject(new SmtpDeliveryError());
    });
  });
}

class SmtpSession {
  private readonly chunks: Buffer[] = [];
  private pendingRead: {
    readonly resolve: (value: string) => void;
    readonly reject: (error: Error) => void;
  } | null = null;
  private closed = false;

  constructor(
    private readonly socket: Socket | TLSSocket,
    timeoutMs: number,
  ) {
    socket.setTimeout(timeoutMs, () => this.fail());
    socket.on('data', (chunk: Buffer) => {
      this.chunks.push(chunk);
      this.flushRead();
    });
    socket.on('error', () => this.fail());
    socket.on('close', () => this.fail());
  }

  async expect(expectedCodes: readonly number[]): Promise<void> {
    const response = await this.readResponse();
    const code = Number(response.slice(0, 3));
    if (!expectedCodes.includes(code)) {
      throw new SmtpDeliveryError();
    }
  }

  async command(command: string, expectedCodes: readonly number[]): Promise<void> {
    await this.write(`${command}\r\n`);
    await this.expect(expectedCodes);
  }

  async writeData(data: string): Promise<void> {
    await this.write(data);
  }

  close(): void {
    this.closed = true;
    this.pendingRead = null;
    this.socket.end();
    this.socket.destroy();
  }

  private async write(value: string): Promise<void> {
    if (this.closed) {
      throw new SmtpDeliveryError();
    }
    await new Promise<void>((resolve, reject) => {
      this.socket.write(value, 'utf8', (error?: Error | null) => {
        if (error) {
          reject(new SmtpDeliveryError());
        } else {
          resolve();
        }
      });
    });
  }

  private readResponse(): Promise<string> {
    if (this.closed) {
      return Promise.reject(new SmtpDeliveryError());
    }
    return new Promise((resolve, reject) => {
      this.pendingRead = { resolve, reject };
      this.flushRead();
    });
  }

  private flushRead(): void {
    const pending = this.pendingRead;
    if (!pending) {
      return;
    }
    const value = Buffer.concat(this.chunks).toString('utf8');
    const lines = value.split('\r\n');
    if (lines.length < 2 || lines.at(-1) !== '') {
      return;
    }
    const completeLines = lines.slice(0, -1);
    const finalLine = completeLines.at(-1) ?? '';
    if (!/^\d{3}([ -])/.test(finalLine) || finalLine[3] === '-') {
      return;
    }
    this.chunks.length = 0;
    this.pendingRead = null;
    pending.resolve(finalLine);
  }

  private fail(): void {
    if (!this.pendingRead) {
      return;
    }
    const pending = this.pendingRead;
    this.pendingRead = null;
    pending.reject(new SmtpDeliveryError());
  }
}
