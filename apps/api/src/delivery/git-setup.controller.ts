import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import type { GitConnectionTestResult, GitSetup } from '@project-maker/contracts';

import { DeliveryHandoffService } from './delivery-handoff.service';
import { SaveGitSetupDto } from './dto/delivery.dto';
import { GitSetupService } from './git-setup.service';

@Controller('git-setups')
export class GitSetupController {
  constructor(private readonly service: GitSetupService, private readonly handoffs: DeliveryHandoffService) {}

  @Get() list(): Promise<readonly GitSetup[]> { return this.service.list(); }
  @Get(':id') get(@Param('id', new ParseUUIDPipe()) id: string): Promise<GitSetup> { return this.service.get(id); }
  @Post() create(@Body() input: SaveGitSetupDto): Promise<GitSetup> { return this.service.create(input); }
  @Put(':id') update(@Param('id', new ParseUUIDPipe()) id: string, @Body() input: SaveGitSetupDto): Promise<GitSetup> {
    return this.service.update(id, input);
  }
  @Post(':id/test') test(@Param('id', new ParseUUIDPipe()) id: string): Promise<GitConnectionTestResult> {
    return this.handoffs.testSetup(id);
  }
  @Delete(':id') @HttpCode(204) remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> { return this.service.remove(id); }
}
