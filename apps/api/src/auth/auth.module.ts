import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditActorMiddleware } from '../audit/audit-actor.middleware';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { InternalUserSession } from './internal-user-session.entity';
import { InternalUser } from './internal-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InternalUser, InternalUserSession])],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuditActorMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
