import { Body, Controller, Get, Param, ParseUUIDPipe, Put, Res } from '@nestjs/common';
import type { DeliveryPackage, DeliveryPackageArtifact } from '@project-maker/contracts';
import type { Response } from 'express';

import { DeliveryPackageService } from './delivery-package.service';
import { SaveDeliveryPackageDto } from './dto/delivery.dto';

@Controller('projects/:projectId/delivery-package')
export class DeliveryPackageController {
  constructor(private readonly service: DeliveryPackageService) {}

  @Put()
  save(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Body() input: SaveDeliveryPackageDto): Promise<DeliveryPackage> {
    return this.service.save(projectId, input);
  }

  @Get()
  get(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<DeliveryPackage> {
    return this.service.get(projectId);
  }

  @Get('artifact')
  artifact(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<DeliveryPackageArtifact> {
    return this.service.artifact(projectId);
  }

  @Get('export.md')
  async markdown(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Res() response: Response): Promise<void> {
    const artifact = await this.service.artifact(projectId);
    response.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${artifact.filename}"`);
    response.send(artifact.content);
  }

  @Get('export.csv')
  async csv(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Res() response: Response): Promise<void> {
    const csv = await this.service.csv(projectId);
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${csv.filename}"`);
    response.send(csv.content);
  }

  @Get('print')
  async print(@Param('projectId', new ParseUUIDPipe()) projectId: string, @Res() response: Response): Promise<void> {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'");
    response.send(await this.service.printHtml(projectId));
  }
}
