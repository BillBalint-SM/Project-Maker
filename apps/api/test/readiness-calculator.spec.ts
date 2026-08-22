import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { AvailableProjectReadiness, GeneralPlaybook } from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';

interface ReadinessCalculatorInput {
  readonly project: {
    readonly id: string;
    readonly name: string | null;
    readonly customerContactName: string | null;
    readonly customerContactEmail: string | null;
    readonly ballOwner: string | null;
  };
  readonly sourceRound: {
    readonly id: string;
    readonly status: string;
  };
  readonly snapshots: readonly {
    readonly id: string;
    readonly stableKey: string;
    readonly required: boolean;
    readonly blocking: boolean;
    readonly order: number;
    readonly checklistStatus: string;
  }[];
  readonly followUps: readonly {
    readonly id: string;
    readonly status: string;
    readonly dueDate: string;
    readonly createdAt: string;
  }[];
  readonly policy: GeneralPlaybook;
}

type CalculateProjectReadiness = (
  input: ReadinessCalculatorInput,
) => AvailableProjectReadiness;

const { calculateProjectReadiness } = require('../src/readiness/readiness-calculator') as {
  readonly calculateProjectReadiness: CalculateProjectReadiness;
};

describe('calculateProjectReadiness', () => {
  let generalPlaybook: GeneralPlaybook;

  before(async () => {
    generalPlaybook = await loadGeneralPlaybookV1();
  });

  it('derives all policy factors and deterministic redacted gaps from normalized state', () => {
    const policy = generalPlaybook;
    const completeStatus = checklistStatusForValue(policy, 1);
    const partialStatus = checklistStatusForValue(policy, 0.5);
    const missingStatus = checklistStatusForValue(policy, 0);
    const excludedStatus = policy.scoring.readiness.excludedChecklistStatus;
    const resolvedStatus = policy.scoring.readiness.resolvedFollowUpStatuses[0];
    const blockedStatus = blockedFollowUpStatus(policy);
    const openStatus = policy.statuses.followUp.find(
      (status) =>
        !policy.scoring.readiness.resolvedFollowUpStatuses.includes(status) &&
        status !== blockedStatus,
    );
    assert.ok(resolvedStatus);
    assert.ok(openStatus);

    const input = createInput(
      policy,
      {
        id: 'project-1',
        name: 'Project',
        customerContactName: 'Contact',
        customerContactEmail: 'contact@example.test',
        ballOwner: null,
      },
      canonicalSnapshots(policy, (itemId) => {
        if (itemId === 1) {
          return completeStatus;
        }
        if (itemId === 2) {
          return partialStatus;
        }
        if (itemId === 4) {
          return missingStatus;
        }
        return excludedStatus;
      }),
      [
        {
          id: 'follow-up-open',
          status: openStatus,
          dueDate: '2026-08-11',
          createdAt: '2026-08-10T10:00:00.000Z',
        },
        {
          id: 'follow-up-blocked',
          status: blockedStatus,
          dueDate: '2026-08-12',
          createdAt: '2026-08-10T11:00:00.000Z',
        },
        {
          id: 'follow-up-resolved',
          status: resolvedStatus,
          dueDate: '2026-08-13',
          createdAt: '2026-08-10T12:00:00.000Z',
        },
      ],
    );
    const inputWithHiddenBusinessContent = {
      ...input,
      snapshots: input.snapshots.map((snapshot) => ({
        ...snapshot,
        answer: 'secret-answer-value',
        assessmentRationale: 'secret-assessment-rationale',
      })),
      followUps: input.followUps.map((followUp) => ({
        ...followUp,
        question: 'secret-discovery-question',
        owner: 'secret-discovery-owner',
        decisionOrAnswer: 'secret-discovery-decision',
        nextStep: 'secret-discovery-next-step',
      })),
    } as ReadinessCalculatorInput;

    const result = calculateProjectReadiness(inputWithHiddenBusinessContent);

    assert.equal(result.completionPercentage, 50);
    assert.equal(result.completionLabel, 'In progress');
    assert.equal(result.readinessPercentage, 55);
    assert.equal(result.readinessBand, 'Ready for estimation preparation');
    assert.deepEqual(
      result.factors.map((factor) => ({
        id: factor.id,
        weight: factor.weight,
        percentage: factor.percentage,
      })),
      [
        { id: 'baseInfo', weight: policy.scoring.readiness.weights.baseInfo, percentage: 100 },
        { id: 'business', weight: policy.scoring.readiness.weights.business, percentage: 75 },
        { id: 'ownership', weight: policy.scoring.readiness.weights.ownership, percentage: 0 },
        { id: 'checklist', weight: policy.scoring.readiness.weights.checklist, percentage: 50 },
        {
          id: 'followUpResolution',
          weight: policy.scoring.readiness.weights.followUpResolution,
          percentage: 33,
        },
      ],
    );
    assert.ok(result.factors.every((factor) => factor.label.length > 0));
    assert.ok(result.factors.every((factor) => factor.helpText.length > 0));
    assert.deepEqual(
      result.gaps.map((gap) => ({
        id: gap.id,
        severity: gap.severity,
        category: gap.category,
        target: gap.target,
        snapshotId: gap.snapshotId,
        followUpId: gap.followUpId,
      })),
      [
        {
          id: 'checklist-general-004',
          severity: 'Critical',
          category: 'Readiness checklist',
          target: 'checklist',
          snapshotId: 'snapshot-4',
          followUpId: null,
        },
        {
          id: 'follow-up-follow-up-blocked',
          severity: 'Critical',
          category: 'Discovery follow-up',
          target: 'follow-ups',
          snapshotId: null,
          followUpId: 'follow-up-blocked',
        },
        {
          id: 'overview-ball-owner',
          severity: 'Important',
          category: 'Ownership',
          target: 'overview',
          snapshotId: null,
          followUpId: null,
        },
        {
          id: 'checklist-general-002',
          severity: 'Important',
          category: 'Readiness checklist',
          target: 'checklist',
          snapshotId: 'snapshot-2',
          followUpId: null,
        },
        {
          id: 'follow-up-follow-up-open',
          severity: 'Important',
          category: 'Discovery follow-up',
          target: 'follow-ups',
          snapshotId: null,
          followUpId: 'follow-up-open',
        },
      ],
    );
    for (const gap of result.gaps) {
      assert.ok(gap.message.length > 0);
      assert.ok(gap.nextStep.length > 0);
    }
    const serialized = JSON.stringify(result);
    assert.doesNotMatch(serialized, /secret-answer-value/);
    assert.doesNotMatch(serialized, /secret-assessment-rationale/);
    assert.doesNotMatch(serialized, /secret-discovery-question/);
    assert.doesNotMatch(serialized, /secret-discovery-owner/);
    assert.doesNotMatch(serialized, /secret-discovery-decision/);
    assert.doesNotMatch(serialized, /secret-discovery-next-step/);
  });

  it('returns zero for an empty relevant checklist denominator and full resolution with no follow-ups', () => {
    const policy = generalPlaybook;
    const result = calculateProjectReadiness(
      createInput(
        policy,
        {
          id: 'project-empty',
          name: null,
          customerContactName: null,
          customerContactEmail: null,
          ballOwner: null,
        },
        canonicalSnapshots(
          policy,
          () => policy.scoring.readiness.excludedChecklistStatus,
        ),
        [],
      ),
    );

    assert.equal(result.completionPercentage, 0);
    assert.equal(result.completionLabel, 'Clarification required');
    assert.equal(result.readinessPercentage, 15);
    assert.equal(result.readinessBand, 'Clarification required');
    assert.deepEqual(
      result.factors.map((factor) => ({ id: factor.id, percentage: factor.percentage })),
      [
        { id: 'baseInfo', percentage: 0 },
        { id: 'business', percentage: 0 },
        { id: 'ownership', percentage: 0 },
        { id: 'checklist', percentage: 0 },
        { id: 'followUpResolution', percentage: 100 },
      ],
    );
    assert.deepEqual(result.gaps.map((gap) => gap.id), ['overview-ball-owner']);
  });

  it('changes readiness bands exactly at policy thresholds and completion labels at zero and one hundred', () => {
    const policy = generalPlaybook;
    const completeStatus = checklistStatusForValue(policy, 1);
    const missingStatus = checklistStatusForValue(policy, 0);
    const excludedStatus = policy.scoring.readiness.excludedChecklistStatus;
    const unresolvedStatus = policy.statuses.followUp.find(
      (status) => !policy.scoring.readiness.resolvedFollowUpStatuses.includes(status),
    );
    assert.ok(unresolvedStatus);

    const atZero = calculateProjectReadiness(
      createInput(
        policy,
        {
          id: 'project-zero',
          name: null,
          customerContactName: null,
          customerContactEmail: null,
          ballOwner: null,
        },
        canonicalSnapshots(policy, () => missingStatus),
        [
          {
            id: 'follow-up-unresolved-zero',
            status: unresolvedStatus,
            dueDate: '2026-08-10',
            createdAt: '2026-08-10T00:00:00.000Z',
          },
        ],
      ),
    );
    const atEstimatePreparation = calculateProjectReadiness(
      createInput(
        policy,
        projectWithoutOwner('project-estimate-preparation'),
        canonicalSnapshots(policy, (itemId) => {
          if (itemId <= 3) {
            return completeStatus;
          }
          if (itemId <= 12) {
            return missingStatus;
          }
          return excludedStatus;
        }),
        [
          {
            id: 'follow-up-unresolved-preparation',
            status: unresolvedStatus,
            dueDate: '2026-08-10',
            createdAt: '2026-08-10T00:00:00.000Z',
          },
        ],
      ),
    );
    const atEstimateReady = calculateProjectReadiness(
      createInput(
        policy,
        completeProject('project-estimate-ready'),
        canonicalSnapshots(policy, (itemId) => {
          if (itemId <= 3) {
            return completeStatus;
          }
          if (itemId <= 18) {
            return missingStatus;
          }
          return excludedStatus;
        }),
        [],
      ),
    );
    const atDevelopmentReady = calculateProjectReadiness(
      createInput(
        policy,
        completeProject('project-development-ready'),
        canonicalSnapshots(
          policy,
          (itemId) => (itemId <= 20 ? completeStatus : missingStatus),
        ),
        [],
      ),
    );
    const complete = calculateProjectReadiness(
      createInput(
        policy,
        completeProject('project-complete'),
        canonicalSnapshots(policy, () => completeStatus),
        [],
      ),
    );

    assert.deepEqual(
      [
        [atZero.readinessPercentage, atZero.readinessBand, atZero.completionLabel],
        [
          atEstimatePreparation.readinessPercentage,
          atEstimatePreparation.readinessBand,
          atEstimatePreparation.completionLabel,
        ],
        [
          atEstimateReady.readinessPercentage,
          atEstimateReady.readinessBand,
          atEstimateReady.completionLabel,
        ],
        [
          atDevelopmentReady.readinessPercentage,
          atDevelopmentReady.readinessBand,
          atDevelopmentReady.completionLabel,
        ],
        [complete.readinessPercentage, complete.readinessBand, complete.completionLabel],
      ],
      [
        [0, 'Clarification required', 'Clarification required'],
        [
          policy.scoring.readiness.thresholds.estimatePreparationFrom,
          'Ready for estimation preparation',
          'In progress',
        ],
        [
          policy.scoring.readiness.thresholds.estimateReadyFrom,
          'Ready for estimation',
          'In progress',
        ],
        [
          policy.scoring.readiness.thresholds.developmentReadyFrom,
          'Ready for development',
          'In progress',
        ],
        [100, 'Ready for development', 'Complete'],
      ],
    );
  });
});

function createInput(
  policy: GeneralPlaybook,
  project: ReadinessCalculatorInput['project'],
  snapshots: ReadinessCalculatorInput['snapshots'],
  followUps: ReadinessCalculatorInput['followUps'],
): ReadinessCalculatorInput {
  return {
    project,
    sourceRound: { id: 'round-1', status: 'OPEN' },
    snapshots,
    followUps,
    policy,
  };
}

function completeProject(projectId: string): ReadinessCalculatorInput['project'] {
  return {
    id: projectId,
    name: 'Project',
    customerContactName: 'Contact',
    customerContactEmail: 'contact@example.test',
    ballOwner: 'Owner',
  };
}

function projectWithoutOwner(projectId: string): ReadinessCalculatorInput['project'] {
  return {
    id: projectId,
    name: 'Project',
    customerContactName: 'Contact',
    customerContactEmail: 'contact@example.test',
    ballOwner: null,
  };
}

function canonicalSnapshots(
  policy: GeneralPlaybook,
  statusForItem: (itemId: number) => string,
): ReadinessCalculatorInput['snapshots'] {
  return policy.items.map((item) => ({
    id: `snapshot-${item.id}`,
    stableKey: `${policy.id}-${String(item.id).padStart(3, '0')}`,
    required: item.requiredForEstimate,
    blocking: item.blockingIfMissing,
    order: item.id,
    checklistStatus: statusForItem(item.id),
  }));
}

function checklistStatusForValue(policy: GeneralPlaybook, value: number): string {
  const entries = Object.entries(policy.scoring.readiness.checklistStatusValue);
  const status = entries.find(([, candidateValue]) => candidateValue === value)?.[0];
  if (!status) {
    throw new Error(`No checklist status exists for policy value ${value}.`);
  }
  return status;
}

function blockedFollowUpStatus(policy: GeneralPlaybook): string {
  const status = policy.statuses.followUp.find((candidate) => candidate === 'Blokkolt');
  if (!status) {
    throw new Error('Canonical policy does not define a blocked discovery follow-up status.');
  }
  return status;
}
