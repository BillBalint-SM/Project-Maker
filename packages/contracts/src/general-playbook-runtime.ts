import { generalPlaybookV1, type GeneralPlaybook } from './index.js';

export function loadGeneralPlaybookV1(): Promise<GeneralPlaybook> {
  return Promise.resolve(generalPlaybookV1);
}
