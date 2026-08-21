import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { DeliveryHandoff, DeliveryHandoffPreview } from '@project-maker/contracts';

import { DeliveryHandoffService } from './delivery-handoff.service';
import { ConfirmDeliveryHandoffDto, PreviewDeliveryHandoffDto } from './dto/delivery.dto';

@Controller('projects/:projectId/delivery-handoffs')
export class DeliveryHandoffController {
  constructor(private readonly service: DeliveryHandoffService) {}

  @Post('preview')
  preview(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Body() input: PreviewDeliveryHandoffDto): Promise<DeliveryHandoffPreview> {
    return this.service.preview(projectId, input.gitSetupId);
  }

  @Post('confirm')
  confirm(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Body() input: ConfirmDeliveryHandoffDto): Promise<DeliveryHandoff> {
    return this.service.confirm(projectId, input.previewToken);
  }

  @Get()
  list(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<readonly DeliveryHandoff[]> {
    return this.service.list(projectId);
  }

  @Post(':handoffId/retry')
  retry(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('handoffId', new ParseUUIDPipe()) handoffId: string,
  ): Promise<DeliveryHandoff> { return this.service.retry(projectId, handoffId); }
}
