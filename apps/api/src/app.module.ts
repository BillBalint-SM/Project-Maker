import { BadRequestException, Module, ValidationPipe, type ValidationError } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';

import { AuditModule } from './audit/audit.module';
import { DatabaseModule } from './database/database.module';
import { DiscoveryFollowUpsModule } from './discovery-follow-ups/discovery-follow-ups.module';
import { CustomerFollowUpModule } from './follow-ups/follow-up.module';
import { HealthController } from './health.controller';
import { InterviewsModule } from './interviews/interviews.module';
import { MarkdownModule } from './markdown/markdown.module';
import { ProjectsModule } from './projects/projects.module';
import { QuestionBankModule } from './question-bank/question-bank.module';
import { ReadinessModule } from './readiness/readiness.module';

@Module({
  imports: [
    ConfigModule.forRoot({ envFilePath: '../../.env', isGlobal: true }),
    TerminusModule,
    DatabaseModule,
    AuditModule,
    ProjectsModule,
    QuestionBankModule,
    InterviewsModule,
    MarkdownModule,
    CustomerFollowUpModule,
    DiscoveryFollowUpsModule,
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
