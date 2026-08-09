import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type { DiscoveryFollowUp } from '@project-maker/contracts';

import { CreateDiscoveryFollowUpDto } from './dto/create-discovery-follow-up.dto';
import { ResolveDiscoveryFollowUpDto } from './dto/resolve-discovery-follow-up.dto';
import { DiscoveryFollowUpsService } from './discovery-follow-ups.service';

@Controller('projects/:projectId/discovery-follow-ups')
export class DiscoveryFollowUpsController {
  constructor(private readonly discoveryFollowUpsService: DiscoveryFollowUpsService) {}

  @Get()
  list(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<readonly DiscoveryFollowUp[]> {
    return this.discoveryFollowUpsService.list(projectId);
  }

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: CreateDiscoveryFollowUpDto,
  ): Promise<DiscoveryFollowUp> {
    return this.discoveryFollowUpsService.create(projectId, input);
  }

  @Post(':followUpId/resolve')
  @HttpCode(HttpStatus.OK)
  resolve(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
    @Body() input: ResolveDiscoveryFollowUpDto,
  ): Promise<DiscoveryFollowUp> {
    return this.discoveryFollowUpsService.resolve(projectId, followUpId, input);
  }
}
