import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourcePath = resolve(
  process.cwd(),
  '../../packages/contracts/playbooks/general.v1.json',
);
const targetDirectory = resolve(process.cwd(), 'dist/playbooks');
const targetPath = resolve(targetDirectory, 'general.v1.json');

await mkdir(targetDirectory, { recursive: true });
await copyFile(sourcePath, targetPath);
