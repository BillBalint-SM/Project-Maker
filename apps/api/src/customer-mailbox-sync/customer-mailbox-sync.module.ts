import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomerRepliesModule } from '../customer-replies/customer-replies.module';
import { CustomerMailboxSyncController } from './customer-mailbox-sync.controller';
import { CustomerMailboxSyncEntity } from './customer-mailbox-sync.entity';
import { CustomerMailboxSyncService } from './customer-mailbox-sync.service';
import {
  customerMailboxClockToken,
  customerMailboxRetryRuntimeToken,
} from './customer-mailbox-sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerMailboxSyncEntity]), CustomerRepliesModule],
  controllers: [CustomerMailboxSyncController],
  providers: [
    CustomerMailboxSyncService,
    { provide: customerMailboxClockToken, useValue: { now: () => new Date() } },
    {
      provide: customerMailboxRetryRuntimeToken,
      useValue: {
        random: () => Math.random(),
        wait: async (delayMs: number) => {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        },
      },
    },
  ],
  exports: [CustomerMailboxSyncService],
})
export class CustomerMailboxSyncModule {}
