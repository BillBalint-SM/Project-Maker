import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import type { AuditEventPage } from '@project-maker/contracts';

import { AuditService } from './audit.service';
import { ListAuditEventsDto } from './dto/list-audit-events.dto';

@Controller('projects/:projectId/audit-events')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() query: ListAuditEventsDto,
  ): Promise<AuditEventPage> {
    return this.auditService.listProjectEvents(projectId, query);
  }
}
