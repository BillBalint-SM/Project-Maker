import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/runtime-cjs', { recursive: true });
await writeFile('dist/runtime-cjs/package.json', '{"type":"commonjs"}\n', 'utf8');
