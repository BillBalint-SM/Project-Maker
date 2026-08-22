import type { EntityManager } from 'typeorm';

export async function hasCustomerReceiptEvidence(
  manager: EntityManager,
  correspondenceId: string | null,
): Promise<boolean> {
  if (!correspondenceId) return false;
  return (
    await findCorrespondencesWithCustomerReceiptEvidence(manager, [
      correspondenceId,
    ])
  ).has(correspondenceId);
}

export async function findCorrespondencesWithCustomerReceiptEvidence(
  manager: EntityManager,
  correspondenceIds: readonly string[],
): Promise<ReadonlySet<string>> {
  const uniqueIds = [...new Set(correspondenceIds)];
  if (uniqueIds.length === 0) return new Set();
  const rows = await manager.query<Array<{ correspondenceId: string }>>(
    `SELECT DISTINCT "correspondence_id" AS "correspondenceId"
     FROM "customer_inbound_messages"
     WHERE "correspondence_id" = ANY($1::uuid[])`,
    [uniqueIds],
  );
  return new Set(rows.map(({ correspondenceId }) => correspondenceId));
}
