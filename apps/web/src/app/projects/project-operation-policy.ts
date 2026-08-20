import {
  computed,
  InjectionToken,
  signal,
  type Provider,
  type Signal,
} from '@angular/core';
import { finalize, type MonoTypeOperatorFunction } from 'rxjs';

export const projectOperationIds = [
  'workspace-save',
  'project-basics-save',
  'project-status-save',
  'customer-follow-up-save',
  'customer-follow-up-preview',
  'customer-follow-up-ping',
  'discovery-create',
  'discovery-update',
  'discovery-source-link',
  'discovery-resolve',
  'decision-review-save',
  'project-archive',
  'project-restore',
  'project-delete',
] as const;

export type ProjectOperationId = (typeof projectOperationIds)[number];

export interface ProjectOperationLease {
  readonly operation: ProjectOperationId;
  release(): void;
}

export interface ProjectOperationPolicy {
  readonly activeOperation: Signal<ProjectOperationId | null>;
  readonly busy: Signal<boolean>;
  tryAcquire(operation: ProjectOperationId): ProjectOperationLease | null;
}

export const PROJECT_OPERATION_POLICY =
  new InjectionToken<ProjectOperationPolicy>('PROJECT_OPERATION_POLICY');

export function createProjectOperationPolicy(): ProjectOperationPolicy {
  const activeOperationState = signal<ProjectOperationId | null>(null);
  const activeOperation = activeOperationState.asReadonly();
  const busy = computed(() => activeOperation() !== null);
  let activeLeaseToken: symbol | null = null;

  function tryAcquire(
    operation: ProjectOperationId,
  ): ProjectOperationLease | null {
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
            'Project operation lease ' + operation + ' was already released.',
          );
        }
        if (
          activeLeaseToken !== leaseToken ||
          activeOperationState() !== operation
        ) {
          throw new Error(
            'Project operation lease ' + operation + ' is not active.',
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

export function provideProjectOperationPolicy(): Provider {
  return {
    provide: PROJECT_OPERATION_POLICY,
    useFactory: createProjectOperationPolicy,
  };
}

export function releaseProjectOperationOnFinalize<T>(
  lease: ProjectOperationLease,
): MonoTypeOperatorFunction<T> {
  return finalize(() => lease.release());
}
