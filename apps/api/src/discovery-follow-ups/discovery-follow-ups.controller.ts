import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import type {
  DiscoveryFollowUp,
  DiscoveryFollowUpSourceOption,
} from '@project-maker/contracts';

import { CreateDiscoveryFollowUpDto } from './dto/create-discovery-follow-up.dto';
import { ResolveDiscoveryFollowUpDto } from './dto/resolve-discovery-follow-up.dto';
import { SetDiscoveryFollowUpSourceLinkDto } from './dto/set-discovery-follow-up-source-link.dto';
import { UpdateDiscoveryFollowUpDto } from './dto/update-discovery-follow-up.dto';
import { DiscoveryFollowUpsService } from './discovery-follow-ups.service';

@Controller('projects/:projectId/discovery-follow-ups')
export class DiscoveryFollowUpsController {
  constructor(private readonly discoveryFollowUpsService: DiscoveryFollowUpsService) {}

  @Get('source-options')
  listSourceOptions(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<readonly DiscoveryFollowUpSourceOption[]> {
    return this.discoveryFollowUpsService.listSourceOptions(projectId);
  }

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

  @Patch(':followUpId')
  @HttpCode(HttpStatus.OK)
  update(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
    @Body() input: UpdateDiscoveryFollowUpDto,
  ): Promise<DiscoveryFollowUp> {
    return this.discoveryFollowUpsService.update(projectId, followUpId, input);
  }

  @Put(':followUpId/source-link')
  @HttpCode(HttpStatus.OK)
  setSourceLink(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('followUpId', new ParseUUIDPipe()) followUpId: string,
    @Body() input: SetDiscoveryFollowUpSourceLinkDto,
  ): Promise<DiscoveryFollowUp> {
    return this.discoveryFollowUpsService.setSourceLink(
      projectId,
      followUpId,
      input,
    );
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
