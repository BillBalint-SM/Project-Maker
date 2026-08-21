import {
  findPackagedPlaybook,
  generalPlaybookV1,
  packagedPlaybookSummaries,
  type GeneralPlaybook,
  type PackagedPlaybookSummary,
} from './index.js';

export function loadGeneralPlaybookV1(): Promise<GeneralPlaybook> {
  return Promise.resolve(generalPlaybookV1);
}

export function loadPackagedPlaybook(id: string, version: number): Promise<GeneralPlaybook | null> {
  return Promise.resolve(findPackagedPlaybook(id, version));
}

export function loadPackagedPlaybookSummaries(): Promise<readonly PackagedPlaybookSummary[]> {
  return Promise.resolve(packagedPlaybookSummaries);
}
