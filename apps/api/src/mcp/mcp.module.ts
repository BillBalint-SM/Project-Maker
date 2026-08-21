import { Module } from '@nestjs/common';

import { DeliveryModule } from '../delivery/delivery.module';
import { MarkdownModule } from '../markdown/markdown.module';
import { ProjectsModule } from '../projects/projects.module';
import { QuestionBankModule } from '../question-bank/question-bank.module';
import { McpController } from './mcp.controller';
import { ProjectMakerMcpEndpoint } from './project-maker-mcp.endpoint';
import { ProjectMakerMcpFacade } from './project-maker-mcp.facade';

@Module({
  imports: [ProjectsModule, MarkdownModule, QuestionBankModule, DeliveryModule],
  controllers: [McpController],
  providers: [ProjectMakerMcpFacade, ProjectMakerMcpEndpoint],
})
export class McpModule {}
