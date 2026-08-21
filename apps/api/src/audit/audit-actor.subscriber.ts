import {
  EventSubscriber,
  type EntitySubscriberInterface,
  type InsertEvent,
} from 'typeorm';

import { currentAuditActorId } from './audit-actor';
import { AuditEvent } from './audit-event.entity';

@EventSubscriber()
export class AuditActorSubscriber implements EntitySubscriberInterface<AuditEvent> {
  listenTo(): typeof AuditEvent {
    return AuditEvent;
  }

  beforeInsert(event: InsertEvent<AuditEvent>): void {
    if (event.entity) {
      event.entity.actorId = currentAuditActorId();
    }
  }
}
