import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type {
  CustomerMailTriageCommand,
  CustomerMailTriageCommandResult,
  CustomerMailTriageView,
} from '@project-maker/contracts';

import { CustomerMailTriageService } from './customer-mail-triage.service';
import { CustomerMailTriageCommandDto } from './dto/customer-mail-triage-command.dto';

@Controller('customer-mail-triage')
export class CustomerMailTriageController {
  constructor(private readonly triage: CustomerMailTriageService) {}

  @Get()
  view(): Promise<CustomerMailTriageView> {
    return this.triage.view();
  }

  @Post(':messageId/commands')
  command(
    @Param('messageId', new ParseUUIDPipe()) messageId: string,
    @Body() input: CustomerMailTriageCommandDto,
  ): Promise<CustomerMailTriageCommandResult> {
    return this.triage.command(messageId, input as CustomerMailTriageCommand);
  }
}
