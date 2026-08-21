import { AsyncLocalStorage } from 'node:async_hooks';

export const systemAuditActorId = 'system';

interface AuditActorStore {
  actorId: string;
}

const auditActor = new AsyncLocalStorage<AuditActorStore>();

export function runWithAuditActor<T>(actorId: string, action: () => T): T {
  return auditActor.run({ actorId }, action);
}

export function setCurrentAuditActor(actorId: string): void {
  const store = auditActor.getStore();
  if (store) {
    store.actorId = actorId;
  }
}

export function currentAuditActorId(): string {
  return auditActor.getStore()?.actorId ?? systemAuditActorId;
}
