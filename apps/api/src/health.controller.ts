import { Controller, Get } from '@nestjs/common';

import { PublicRoute } from './auth/public-route';

@Controller('health')
@PublicRoute()
export class HealthController {
  @Get()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
