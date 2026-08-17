import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EntityManager, FindOperator } from 'typeorm';

import { findCurrentInitialIntakeSource } from '../src/interviews/current-initial-intake-source';
import { InterviewRoundEntity } from '../src/interviews/interview-round.entity';

describe('findCurrentInitialIntakeSource', () => {
  it('selects the most recently created OPEN or ENDED round in one ordered query', async () => {
    const expected = { id: 'most-recent-round' } as InterviewRoundEntity;
    let observedOptions: Record<string, unknown> | null = null;
    const manager = {
      getRepository: () => ({
        findOne: async (options: Record<string, unknown>) => {
          observedOptions = options;
          return expected;
        },
      }),
    } as unknown as EntityManager;

    assert.equal(await findCurrentInitialIntakeSource(manager, 'project-1'), expected);
    assert.ok(observedOptions);
    const where = observedOptions['where'] as Record<string, unknown>;
    assert.equal(where['projectId'], 'project-1');
    assert.equal(where['type'], 'INITIAL_INTAKE');
    assert.ok(where['status'] instanceof FindOperator);
    assert.deepEqual((where['status'] as FindOperator<string>).value, ['OPEN', 'ENDED']);
    assert.deepEqual(observedOptions['order'], { createdAt: 'DESC', id: 'ASC' });
  });
});
