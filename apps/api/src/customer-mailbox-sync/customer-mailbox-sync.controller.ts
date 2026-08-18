import { Controller, Get, Post } from '@nestjs/common';
import type { CustomerMailboxSyncStatus } from '@project-maker/contracts';

import { CustomerMailboxSyncService } from './customer-mailbox-sync.service';

@Controller('customer-mailbox-sync')
export class CustomerMailboxSyncController {
  constructor(private readonly mailboxSync: CustomerMailboxSyncService) {}

  @Get()
  status(): Promise<CustomerMailboxSyncStatus> {
    return this.mailboxSync.status();
  }

  @Post('refresh')
  refresh(): Promise<CustomerMailboxSyncStatus> {
    return this.mailboxSync.refresh();
  }
}
