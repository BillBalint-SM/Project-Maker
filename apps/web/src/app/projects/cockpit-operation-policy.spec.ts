import { NEVER, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';

import {
  createCockpitOperationPolicy,
  releaseCockpitOperationOnFinalize,
} from './cockpit-operation-policy';

describe('cockpit operation policy', () => {
  it('acquires one typed operation and rejects a concurrent mutation', () => {
    const policy = createCockpitOperationPolicy();

    expect(policy.activeOperation()).toBeNull();
    expect(policy.busy()).toBe(false);

    const lease = policy.tryAcquire('workspace-save');

    expect(lease?.operation).toBe('workspace-save');
    expect(policy.activeOperation()).toBe('workspace-save');
    expect(policy.busy()).toBe(true);
    expect(policy.tryAcquire('project-archive')).toBeNull();

    lease?.release();

    expect(policy.activeOperation()).toBeNull();
    expect(policy.busy()).toBe(false);
  });

  it('fails fast when the same lease is released twice', () => {
    const policy = createCockpitOperationPolicy();
    const lease = policy.tryAcquire('project-delete');

    expect(lease).not.toBeNull();
    lease?.release();

    expect(() => lease?.release()).toThrowError(
      'Cockpit operation lease project-delete was already released.',
    );
  });

  it('releases on Observable completion, error, and explicit unsubscribe', () => {
    const completedPolicy = createCockpitOperationPolicy();
    const completedLease =
      completedPolicy.tryAcquire('customer-follow-up-save');
    expect(completedLease).not.toBeNull();
    of('saved')
      .pipe(releaseCockpitOperationOnFinalize(completedLease!))
      .subscribe();
    expect(completedPolicy.busy()).toBe(false);

    const failedPolicy = createCockpitOperationPolicy();
    const failedLease = failedPolicy.tryAcquire('discovery-create');
    expect(failedLease).not.toBeNull();
    throwError(() => new Error('expected failure'))
      .pipe(releaseCockpitOperationOnFinalize(failedLease!))
      .subscribe({ error: () => undefined });
    expect(failedPolicy.busy()).toBe(false);

    const cancelledPolicy = createCockpitOperationPolicy();
    const cancelledLease =
      cancelledPolicy.tryAcquire('customer-follow-up-ping');
    expect(cancelledLease).not.toBeNull();
    const subscription = NEVER.pipe(
      releaseCockpitOperationOnFinalize(cancelledLease!),
    ).subscribe();
    subscription.unsubscribe();
    expect(cancelledPolicy.busy()).toBe(false);
  });
});
