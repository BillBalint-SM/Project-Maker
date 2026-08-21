import { BadRequestException, Module, ValidationPipe, type ValidationError } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';

import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DecisionReviewModule } from './decision-review/decision-review.module';
import { DecisionPortfolioModule } from './decision-portfolio/decision-portfolio.module';
import { DiscoveryFollowUpsModule } from './discovery-follow-ups/discovery-follow-ups.module';
import { DiscoveryModule } from './discovery/discovery.module';
import { DeliveryModule } from './delivery/delivery.module';
import { CustomerFollowUpModule } from './follow-ups/follow-up.module';
import { CustomerMailboxSyncModule } from './customer-mailbox-sync/customer-mailbox-sync.module';
import { CustomerResponseModule } from './customer-response/customer-response.module';
import { HealthController } from './health.controller';
import { InterviewsModule } from './interviews/interviews.module';
import { MarkdownModule } from './markdown/markdown.module';
import { McpModule } from './mcp/mcp.module';
import { MailDeliveryModule } from './mail-delivery/mail-delivery.module';
import { ProjectsModule } from './projects/projects.module';
import { ProjectPreparationModule } from './project-preparation/project-preparation.module';
import { QuestionBankModule } from './question-bank/question-bank.module';
import { ReadinessModule } from './readiness/readiness.module';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '../../.env', isGlobal: true }),
    DatabaseModule,
    AuthModule,
    MailDeliveryModule.gateway(),
    DecisionReviewModule,
    DecisionPortfolioModule,
    AuditModule,
    ProjectsModule,
    ProjectPreparationModule,
    QuestionBankModule,
    InterviewsModule,
    MarkdownModule,
    CustomerFollowUpModule,
    CustomerMailboxSyncModule,
    CustomerResponseModule,
    DiscoveryFollowUpsModule,
    DiscoveryModule,
    DeliveryModule,
    McpModule,
    ReadinessModule,
  ],
  controllers: [HealthController],
  providers: [
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
          exceptionFactory: (errors: ValidationError[]) =>
            new BadRequestException({
              message: 'Request validation failed.',
              fields: collectValidationFields(errors),
            }),
        }),
    },
  ],
})
export class AppModule {}

function collectValidationFields(errors: readonly ValidationError[]): readonly string[] {
  return [
    ...new Set(
      errors.flatMap((error) => [
        error.property,
        ...collectValidationFields(error.children ?? []),
      ]),
    ),
  ];
}
