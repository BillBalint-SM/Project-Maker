import { spawn } from 'node:child_process';
import { createServer as createHttpServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createServer as createTlsServer } from 'node:tls';
import { fileURLToPath } from 'node:url';

const e2eDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = resolve(e2eDirectory, '..', '..', '..');
const requireFromApi = createRequire(resolve(repositoryDirectory, 'apps', 'api', 'package.json'));
const { Client } = requireFromApi('pg');
const { SMTPServer } = requireFromApi('smtp-server');
const { simpleParser } = requireFromApi('mailparser');
const { generate } = requireFromApi('selfsigned');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required for web E2E because Playwright starts the real API and runs migrations against PostgreSQL.');
    process.exit(1);
  }
  await resetLocalE2eDatabase(process.env.DATABASE_URL);
  const fixturePort = Number(process.env.MAIL_GATEWAY_FIXTURE_PORT ?? '25260');
  const identity = await tlsIdentity();
  const gateway = new GatewayFixture(identity);
  await gateway.listen();
  const controlServer = createHttpServer((request, response) => gateway.control(request, response));
  await listen(controlServer, fixturePort, '127.0.0.1');
  await pnpm(['--dir', repositoryDirectory, '--filter', '@project-maker/api', 'migration:run']);
  await seedTestInternalUser(process.env.DATABASE_URL);
  const api = spawnPnpm(['--dir', repositoryDirectory, '--filter', '@project-maker/api', 'start'], {
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://127.0.0.1:4200',
      CUSTOMER_RESPONSE_ORIGIN: process.env.CUSTOMER_RESPONSE_ORIGIN ?? 'http://127.0.0.1:4200',
      CUSTOMER_RESPONSE_PREVIEW_SECRET: process.env.CUSTOMER_RESPONSE_PREVIEW_SECRET ?? 'playwright-customer-response-preview-secret',
      CORRESPONDENCE_MAILBOX_ADDRESS: process.env.CORRESPONDENCE_MAILBOX_ADDRESS ?? 'project-maker-e2e@example.test',
      CORRESPONDENCE_MAILBOX_NAME: process.env.CORRESPONDENCE_MAILBOX_NAME ?? 'Project Maker',
      MAIL_GATEWAY_SMTP_HOST: 'localhost', MAIL_GATEWAY_SMTP_PORT: String(gateway.smtpPort), MAIL_GATEWAY_SMTP_SECURITY: 'IMPLICIT_TLS', MAIL_GATEWAY_SMTP_USERNAME: 'playwright-smtp-user', MAIL_GATEWAY_SMTP_PASSWORD: 'playwright-smtp-password',
      MAIL_GATEWAY_IMAP_HOST: 'localhost', MAIL_GATEWAY_IMAP_PORT: String(gateway.imapPort), MAIL_GATEWAY_IMAP_SECURITY: 'IMPLICIT_TLS', MAIL_GATEWAY_IMAP_USERNAME: 'playwright-imap-user', MAIL_GATEWAY_IMAP_PASSWORD: 'playwright-imap-password', MAIL_GATEWAY_IMAP_FOLDER: 'INBOX',
      MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64: Buffer.from(identity.caCertificate).toString('base64'),
      CORRESPONDENCE_MAILBOX_POLL_INTERVAL_MS: '60000',
    }, stdio: 'inherit', windowsHide: true,
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { api.kill(signal); controlServer.close(); void gateway.close(); });
  api.on('exit', (code, signal) => signal ? process.kill(process.pid, signal) : process.exit(code ?? 1));
}
class GatewayFixture {
  constructor(identity) {
    this.identity = identity; this.sent = []; this.messages = []; this.nextUid = 1; this.readAttempts = 0; this.sockets = new Set();
    this.rejectSubmission = false; this.unknownSubmission = false; this.delayRead = false; this.failRead = false;
    this.smtp = new SMTPServer({ secure: true, key: identity.key, cert: identity.certificate, minVersion: 'TLSv1.2', authOptional: false,
      onAuth: (auth, _session, done) => auth.username === 'playwright-smtp-user' && auth.password === 'playwright-smtp-password' ? done(null, { user: auth.username }) : done(Object.assign(new Error('Authentication rejected.'), { responseCode: 535 })),
      onData: (stream, session, done) => { void this.capture(stream, session, done); },
    });
    this.imap = createTlsServer({ key: identity.key, cert: identity.certificate, minVersion: 'TLSv1.2' }, (socket) => this.handleImap(socket));
  }
  async listen() { this.smtpPort = await listenSmtp(this.smtp); this.imapPort = await listen(this.imap); }
  async close() { for (const socket of this.sockets) socket.destroy(); await Promise.all([close(this.smtp), close(this.imap)]); }
  async capture(stream, session, done) {
    const parsed = await simpleParser(await collect(stream));
    if (this.rejectSubmission) { this.rejectSubmission = false; done(Object.assign(new Error('Submission rejected.'), { responseCode: 550 })); return; }
    this.sent.push({ envelope: { from: session.envelope.mailFrom?.address ?? null, to: session.envelope.rcptTo.map(({ address }) => address) }, from: parsed.from?.value[0] ? { name: parsed.from.value[0].name ?? '', address: parsed.from.value[0].address ?? '' } : null, replyToAddress: parsed.replyTo?.value[0]?.address ?? null, recipientAddresses: parsed.to ? (Array.isArray(parsed.to) ? parsed.to : [parsed.to]).flatMap(({ value }) => value.map(({ address }) => address ?? '')) : [], subject: parsed.subject ?? null, textContent: parsed.text?.trim() ?? null, htmlContent: typeof parsed.html === 'string' ? parsed.html : null, messageReference: parsed.messageId ?? null });
    if (this.unknownSubmission) { this.unknownSubmission = false; for (const connection of this.smtp.connections) connection._socket.destroy(); return; }
    done();
  }
  control(request, response) {
    const url = request.url ?? '';
    if (request.method === 'GET' && url === '/__test/sent-messages') return json(response, this.sent);
    if (request.method === 'GET' && url === '/__test/mailbox-stats') return json(response, { readAttempts: this.readAttempts });
    if (request.method === 'POST' && url === '/__test/reset') { this.sent.length = 0; this.messages.length = 0; this.rejectSubmission = false; this.unknownSubmission = false; this.delayRead = false; this.failRead = false; return noContent(response); }
    if (request.method === 'POST' && url === '/__test/reject-next-submission') { this.rejectSubmission = true; return noContent(response); }
    if (request.method === 'POST' && url === '/__test/unknown-next-submission') { this.unknownSubmission = true; return noContent(response); }
    if (request.method === 'POST' && url === '/__test/delay-next-read') { this.delayRead = true; return noContent(response); }
    if (request.method === 'POST' && url === '/__test/fail-next-read') { this.failRead = true; return noContent(response); }
    if (request.method === 'POST' && url === '/__test/queue-imap-message') return readJson(request).then((message) => { this.messages.push({ ...message, uid: this.nextUid++ }); noContent(response); }, () => response.writeHead(400).end());
    response.writeHead(404).end();
  }
  handleImap(socket) {
    this.sockets.add(socket); socket.setEncoding('utf8'); socket.write('* OK Project Maker controlled IMAP fixture ready\r\n'); let buffer = ''; let authTag = null;
    socket.on('data', (chunk) => { buffer += chunk; for (;;) { const end = buffer.indexOf('\r\n'); if (end < 0) break; const line = buffer.slice(0, end); buffer = buffer.slice(end + 2); if (authTag) { this.authenticate(socket, authTag, line); authTag = null; continue; } const match = /^(\S+)\s+([\s\S]+)$/.exec(line); if (!match) continue; const [, tag, command] = match; const upper = command.toUpperCase();
      if (upper === 'CAPABILITY') socket.write(`* CAPABILITY IMAP4rev1 AUTH=PLAIN\r\n${tag} OK CAPABILITY completed\r\n`);
      else if (upper.startsWith('AUTHENTICATE PLAIN')) { const initial = command.split(/\s+/)[2]; if (initial) this.authenticate(socket, tag, initial); else { authTag = tag; socket.write('+ \r\n'); } }
      else if (upper === 'NAMESPACE') socket.write(`* NAMESPACE (("" "/")) NIL NIL\r\n${tag} OK NAMESPACE completed\r\n`);
      else if (upper.startsWith('LIST ') || upper.startsWith('LSUB ')) socket.write(`* LIST (\\HasNoChildren) "/" "INBOX"\r\n${tag} OK LIST completed\r\n`);
      else if (upper.startsWith('SELECT ') || upper.startsWith('EXAMINE ')) socket.write(['* FLAGS (\\Answered \\Flagged \\Deleted \\Seen \\Draft)', `* ${this.messages.length} EXISTS`, '* 0 RECENT', '* OK [UIDVALIDITY 91] UIDs valid', `* OK [UIDNEXT ${this.nextUid}] Predicted next UID`, `${tag} OK [READ-ONLY] SELECT completed`, ''].join('\r\n'));
      else if (upper.startsWith('UID SEARCH ')) this.search(socket, tag);
      else if (upper.startsWith('UID FETCH ')) this.fetch(socket, tag, command);
      else if (upper === 'NOOP') socket.write(`${tag} OK NOOP completed\r\n`);
      else if (upper === 'LOGOUT') { socket.write(`* BYE Logging out\r\n${tag} OK LOGOUT completed\r\n`); socket.end(); }
      else socket.write(`${tag} BAD Unsupported controlled IMAP command\r\n`);
    }}); socket.once('close', () => this.sockets.delete(socket));
  }
  authenticate(socket, tag, encoded) { const [, username, password] = Buffer.from(encoded, 'base64').toString('utf8').split('\0'); socket.write(username === 'playwright-imap-user' && password === 'playwright-imap-password' ? `${tag} OK AUTHENTICATE completed\r\n` : `${tag} NO [AUTHENTICATIONFAILED] Authentication rejected\r\n`); }
  search(socket, tag) { this.readAttempts += 1; if (this.failRead) { this.failRead = false; socket.destroy(); return; } const done = () => socket.write(`* SEARCH ${this.messages.map(({ uid }) => uid).join(' ')}\r\n${tag} OK SEARCH completed\r\n`); if (this.delayRead) { this.delayRead = false; setTimeout(done, 250); } else done(); }
  fetch(socket, tag, command) { const requested = new Set((/UID FETCH\s+([0-9:,]+)/i.exec(command)?.[1] ?? '').split(/[,:]/).map(Number)); const selected = this.messages.filter(({ uid }) => requested.has(uid)); selected.forEach((message, index) => this.writeFetch(socket, tag, command, message, index === selected.length - 1)); }
  writeFetch(socket, tag, command, message, complete) {
    const completion = complete ? `${tag} OK FETCH completed\r\n` : '';
    if (/BODY\.PEEK\[1\]/i.test(command)) { const body = Buffer.from(message.textContent ?? '', 'utf8'); socket.write(`* 1 FETCH (UID ${message.uid} BODY[1] {${body.length}}\r\n`); socket.write(body); socket.write(`)\r\n${completion}`); return; }
    const headerLines = Object.entries(message.headers ?? {}).map(([name, value]) => `${name}: ${value}`); if (!headerLines.some((line) => /^content-type:/i.test(line))) headerLines.push(`Content-Type: ${message.contentType ?? 'text/plain'}; charset=utf-8`); const headers = Buffer.from(headerLines.concat(['', '']).join('\r\n'));
    const requestedHeaders = /BODY\.PEEK(\[HEADER\.FIELDS \([^\]]+\)\])/i.exec(command)?.[1] ?? '[HEADER]'; const from = address(message.senderAddress ?? 'unknown@example.test'); const recipients = (message.recipientAddresses ?? []).map(address).join('') || 'NIL';
    const envelope = [`"${clean(message.receivedAt ?? new Date().toUTCString())}"`, `"${clean(message.subject ?? '')}"`, `(${from})`, `(${from})`, `(${from})`, `(${recipients})`, 'NIL', 'NIL', message.inReplyTo ? `"${clean(message.inReplyTo)}"` : 'NIL', message.internetMessageId ? `"${clean(message.internetMessageId)}"` : 'NIL'].join(' ');
    const [textTop = 'text', textSubtype = 'plain'] = String(message.contentType ?? 'text/plain').split('/'); const text = `("${clean(textTop).toUpperCase()}" "${clean(textSubtype).toUpperCase()}" ("CHARSET" "UTF-8") NIL NIL "8BIT" ${Buffer.byteLength(message.textContent ?? '')} 1 NIL NIL NIL NIL)`; const attachments = (message.attachments ?? []).map((attachment) => { const [top = 'application', subtype = 'octet-stream'] = String(attachment.contentType ?? '').split('/'); return `("${clean(top).toUpperCase()}" "${clean(subtype).toUpperCase()}" ("NAME" "${clean(attachment.name)}") NIL NIL "BASE64" ${Number(attachment.size) || 0} NIL ("ATTACHMENT" ("FILENAME" "${clean(attachment.name)}")) NIL NIL)`; }).join(''); const structure = attachments ? `(${text}${attachments} "MIXED" NIL NIL)` : text;
    socket.write(`* 1 FETCH (UID ${message.uid} INTERNALDATE "20-Aug-2026 08:01:00 +0000" ENVELOPE (${envelope}) BODYSTRUCTURE ${structure} BODY${requestedHeaders} {${headers.length}}\r\n`); socket.write(headers); socket.write(`)\r\n${completion}`);
  }
}
function address(value) { const [local, domain = 'example.test'] = String(value).split('@'); return `("" NIL "${clean(local)}" "${clean(domain)}")`; }
function clean(value) { return String(value).replace(/["\\\r\n]/g, ' '); }
function json(response, value) { response.writeHead(200, { 'content-type': 'application/json' }); response.end(JSON.stringify(value)); }
function noContent(response) { response.writeHead(204).end(); }
async function readJson(request) { let source = ''; for await (const chunk of request) source += chunk; return JSON.parse(source); }
async function collect(stream) { const chunks = []; for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)); return Buffer.concat(chunks); }
async function listen(server, port = 0, host = 'localhost') { await new Promise((resolvePromise, rejectPromise) => { server.once('error', rejectPromise); server.listen(port, host, resolvePromise); }); const address = server.address(); if (!address || typeof address === 'string') throw new Error('Controlled gateway port missing.'); return address.port; }
async function listenSmtp(server) { await new Promise((resolvePromise, rejectPromise) => { server.once('error', rejectPromise); server.listen(0, 'localhost', resolvePromise); }); const address = server.server.address(); if (!address || typeof address === 'string') throw new Error('Controlled SMTP port missing.'); return address.port; }
async function close(server) { await new Promise((resolvePromise) => server.close(resolvePromise)); }
async function tlsIdentity() { const ca = await generate([{ name: 'commonName', value: 'Project Maker E2E CA' }], { algorithm: 'sha256', keySize: 2048, notAfterDate: new Date('2036-01-01T00:00:00.000Z'), extensions: [{ name: 'basicConstraints', cA: true, critical: true }, { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true }] }); const server = await generate([{ name: 'commonName', value: 'localhost' }], { algorithm: 'sha256', keySize: 2048, notAfterDate: new Date('2036-01-01T00:00:00.000Z'), ca: { key: ca.private, cert: ca.cert }, extensions: [{ name: 'basicConstraints', cA: false, critical: true }, { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true }, { name: 'extKeyUsage', serverAuth: true }, { name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }] }); return { key: server.private, certificate: server.cert, caCertificate: ca.cert }; }
function pnpm(args) { return new Promise((resolvePromise, rejectPromise) => { const child = spawnPnpm(args, { env: process.env, stdio: 'inherit', windowsHide: true }); child.on('error', rejectPromise); child.on('exit', (code, signal) => signal ? rejectPromise(new Error(`pnpm was terminated by ${signal}.`)) : code ? rejectPromise(new Error(`pnpm exited with code ${code}.`)) : resolvePromise()); }); }
function spawnPnpm(args, options) { return process.platform === 'win32' ? spawn('cmd.exe', ['/d', '/s', '/c', 'npx', '--yes', 'pnpm@11.20.0', ...args], options) : spawn('npx', ['--yes', 'pnpm@11.20.0', ...args], options); }
async function resetLocalE2eDatabase(databaseUrl) { safeDatabaseUrl(databaseUrl); const client = new Client({ connectionString: databaseUrl }); await client.connect(); try { await client.query('DROP SCHEMA IF EXISTS public CASCADE'); await client.query('CREATE SCHEMA public'); } finally { await client.end(); } }
async function seedTestInternalUser(databaseUrl) { const client = new Client({ connectionString: databaseUrl }); await client.connect(); try { await client.query('INSERT INTO internal_users (id, email, password_hash, active) VALUES ($1, $2, $3, true)', ['00000000-0000-4000-8000-000000000001', 'e2e-user@example.test', 'playwright-test-auth-bypass-not-used']); } finally { await client.end(); } }
function safeDatabaseUrl(databaseUrl) { let url; try { url = new URL(databaseUrl); } catch { throw new Error('DATABASE_URL must be a valid local PostgreSQL URL for web E2E.'); } const name = url.pathname.replace(/^\//, ''); if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !/(^|[_-])(e2e|test)([_-]|$)/i.test(name)) throw new Error('Web E2E resets its database before migrations. DATABASE_URL must point to a localhost PostgreSQL database whose name contains test or e2e.'); }

await main();
