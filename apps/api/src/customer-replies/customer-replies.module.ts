import { Module } from '@nestjs/common';

import { CustomerRepliesController } from './customer-replies.controller';
import { CustomerReplyIngestionService } from './customer-reply-ingestion.service';
import { CustomerRepliesService } from './customer-replies.service';
import { CustomerMailTriageController } from './customer-mail-triage.controller';
import { CustomerMailTriageService } from './customer-mail-triage.service';

@Module({
  controllers: [CustomerMailTriageController, CustomerRepliesController],
  providers: [CustomerMailTriageService, CustomerReplyIngestionService, CustomerRepliesService],
  exports: [CustomerReplyIngestionService],
})
export class CustomerRepliesModule {}
