import { Controller, Get } from '@nestjs/common';
import type { PackagedPlaybookSummary } from '@project-maker/contracts';
import { loadPackagedPlaybookSummaries } from '@project-maker/contracts/general-playbook-runtime';

@Controller('playbooks')
export class PlaybooksController {
  @Get()
  list(): Promise<readonly PackagedPlaybookSummary[]> {
    return loadPackagedPlaybookSummaries();
  }
}
