import { Module } from '@nestjs/common';

import { CustomerRepliesController } from './customer-replies.controller';
import { CustomerReplyIngestionService } from './customer-reply-ingestion.service';
import { CustomerRepliesService } from './customer-replies.service';

@Module({
  controllers: [CustomerRepliesController],
  providers: [CustomerReplyIngestionService, CustomerRepliesService],
  exports: [CustomerReplyIngestionService],
})
export class CustomerRepliesModule {}
