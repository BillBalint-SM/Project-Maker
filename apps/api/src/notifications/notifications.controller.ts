import { Controller, Get } from '@nestjs/common';
import type { NotificationList } from '@project-maker/contracts';

import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(): Promise<NotificationList> {
    return this.notifications.list();
  }
}
