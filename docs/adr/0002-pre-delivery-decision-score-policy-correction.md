---
status: accepted
---

# Correct the unshipped `general` v1 Decision Score policy in place

`general` v1 already contains a Decision Score policy, but SCORE-01.2 has not
yet delivered a calculator, recommendation, or stored Score to any project.
The agreed SCORE-01.2 thresholds and recommendation precedence
will therefore be corrected in the canonical `general.v1.json` contract before
the first use of that policy.

The correction will set the agreed score labels and recommendation thresholds while
retaining the existing six inputs, weighting model, scale, and immutable intake
schema. It is a narrow pre-delivery policy correction, not a precedent for
changing a published playbook policy in place.

## Considered options

- Introduce `general` v2 now. This would require project playbook selection and
  migration behavior that the current product does not support, despite no
  historical Decision Score result existing to preserve.
- Retain the old v1 thresholds. That would contradict the agreed SCORE-01.2
  decision policy.

## Consequences

- The first SCORE-01.2 release will have one canonical policy source and no
  artificial project migration.
- The correction must be covered by contract and behavioral tests before
  delivery.
- After a Decision Score policy is delivered for use, a material policy change
  requires a new playbook version and explicit treatment of historical project
  data; it must not silently modify `general` v1.
