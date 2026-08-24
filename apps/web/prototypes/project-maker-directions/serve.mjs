import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const prototypeRoot = new URL('./', import.meta.url);
const prototypePort = Number.parseInt(process.env.PROJECT_MAKER_PROTOTYPE_PORT ?? '4173', 10);

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/tokens.css', ['tokens.css', 'text/css; charset=utf-8']],
  ['/prototype.css', ['prototype.css', 'text/css; charset=utf-8']],
  ['/prototype.js', ['prototype.js', 'text/javascript; charset=utf-8']],
]);

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
  const requestedFile = files.get(pathname);

  if (!requestedFile) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Prototype asset not found.');
    return;
  }

  try {
    const [filename, contentType] = requestedFile;
    const contents = await readFile(new URL(filename, prototypeRoot));
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': contentType,
    });
    response.end(contents);
  } catch (error) {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`Could not load prototype asset: ${error.message}`);
  }
});

server.listen(prototypePort, '127.0.0.1', () => {
  console.log(`Project Maker design directions: http://127.0.0.1:${prototypePort}/`);
  console.log('Variants: ledger · journey · quiet · ops · play');
});
