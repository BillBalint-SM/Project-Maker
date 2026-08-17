import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { createServer, type Server, type Socket } from 'node:net';
import { afterEach, describe, it } from 'node:test';

import {
  SmtpDeliveryError,
  SmtpDeliveryUnknownError,
  SmtpMailerService,
} from '../src/mail-delivery/smtp-mailer.service';

describe('SMTP delivery result classification', () => {
  let server: Server | null = null;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) =>
      server!.close((error) => error ? reject(error) : resolve()),
    );
    server = null;
  });

  it('classifies an explicit post-DATA rejection as a known failure', async () => {
    server = createResultServer('REJECT');
    const port = await listen(server);
    const mailer = createMailer(port);

    await assert.rejects(
      mailer.send(message),
      (error: unknown) => error instanceof SmtpDeliveryError
        && !(error instanceof SmtpDeliveryUnknownError),
    );
  });

  it('classifies a lost post-DATA connection as an uncertain result', async () => {
    server = createResultServer('DISCONNECT');
    const port = await listen(server);
    const mailer = createMailer(port);

    await assert.rejects(
      mailer.send(message),
      (error: unknown) => error instanceof SmtpDeliveryUnknownError,
    );
  });
});

const message = {
  to: 'customer@example.test',
  subject: 'Pontosítás',
  text: 'Kérlek, válaszolj.',
};

function createMailer(port: number): SmtpMailerService {
  return new SmtpMailerService(new ConfigService({
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(port),
    SMTP_FROM: 'project-maker@example.test',
    SMTP_SECURE: 'false',
  }));
}

function createResultServer(result: 'REJECT' | 'DISCONNECT'): Server {
  return createServer((socket) => handleConnection(socket, result));
}

function handleConnection(socket: Socket, result: 'REJECT' | 'DISCONNECT'): void {
  let buffer = '';
  let dataMode = false;
  socket.setEncoding('utf8');
  socket.write('220 project-maker-test ESMTP\r\n');
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    if (dataMode) {
      const end = buffer.indexOf('\r\n.\r\n');
      if (end < 0) return;
      if (result === 'DISCONNECT') socket.destroy();
      else socket.write('554 rejected\r\n');
      buffer = buffer.slice(end + 5);
      dataMode = false;
    }
    while (!dataMode) {
      const end = buffer.indexOf('\r\n');
      if (end < 0) return;
      const command = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (/^EHLO /i.test(command)) socket.write('250 test\r\n');
      else if (/^(MAIL FROM|RCPT TO):/i.test(command)) socket.write('250 ok\r\n');
      else if (command === 'DATA') {
        dataMode = true;
        socket.write('354 continue\r\n');
      }
    }
  });
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('SMTP test port missing.');
  return address.port;
}
