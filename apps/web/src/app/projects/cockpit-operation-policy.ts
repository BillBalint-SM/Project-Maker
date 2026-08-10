import {
  computed,
  InjectionToken,
  signal,
  type Provider,
  type Signal,
} from '@angular/core';
import { finalize, type MonoTypeOperatorFunction } from 'rxjs';

export const cockpitOperationIds = [
  'workspace-save',
  'customer-follow-up-save',
  'customer-follow-up-ping',
  'customer-review-email',
  'discovery-create',
  'discovery-update',
  'discovery-resolve',
  'project-archive',
  'project-restore',
  'project-delete',
] as const;

export type CockpitOperationId = (typeof cockpitOperationIds)[number];

export interface CockpitOperationLease {
  readonly operation: CockpitOperationId;
  release(): void;
}

export interface CockpitOperationPolicy {
  readonly activeOperation: Signal<CockpitOperationId | null>;
  readonly busy: Signal<boolean>;
  tryAcquire(operation: CockpitOperationId): CockpitOperationLease | null;
}

export const COCKPIT_OPERATION_POLICY =
  new InjectionToken<CockpitOperationPolicy>('COCKPIT_OPERATION_POLICY');

export function createCockpitOperationPolicy(): CockpitOperationPolicy {
  const activeOperationState = signal<CockpitOperationId | null>(null);
  const activeOperation = activeOperationState.asReadonly();
  const busy = computed(() => activeOperation() !== null);
  let activeLeaseToken: symbol | null = null;

  function tryAcquire(
    operation: CockpitOperationId,
  ): CockpitOperationLease | null {
    if (activeLeaseToken !== null) {
      return null;
    }

    const leaseToken = Symbol(operation);
    let released = false;
    activeLeaseToken = leaseToken;
    activeOperationState.set(operation);

    return {
      operation,
      release(): void {
        if (released) {
          throw new Error(
            'Cockpit operation lease ' + operation + ' was already released.',
          );
        }
        if (
          activeLeaseToken !== leaseToken ||
          activeOperationState() !== operation
        ) {
          throw new Error(
            'Cockpit operation lease ' + operation + ' is not active.',
          );
        }

        released = true;
        activeLeaseToken = null;
        activeOperationState.set(null);
      },
    };
  }

  return { activeOperation, busy, tryAcquire };
}

export function provideCockpitOperationPolicy(): Provider {
  return {
    provide: COCKPIT_OPERATION_POLICY,
    useFactory: createCockpitOperationPolicy,
  };
}

export function releaseCockpitOperationOnFinalize<T>(
  lease: CockpitOperationLease,
): MonoTypeOperatorFunction<T> {
  return finalize(() => lease.release());
}
