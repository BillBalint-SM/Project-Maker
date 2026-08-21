import { Injectable, NestMiddleware } from '@nestjs/common';

import { runWithAuditActor, systemAuditActorId } from './audit-actor';

@Injectable()
export class AuditActorMiddleware implements NestMiddleware {
  use(_request: unknown, _response: unknown, next: () => void): void {
    runWithAuditActor(systemAuditActorId, next);
  }
}
