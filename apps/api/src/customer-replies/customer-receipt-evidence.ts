import type { EntityManager } from 'typeorm';

export async function hasCustomerReceiptEvidence(
  manager: EntityManager,
  correspondenceId: string | null,
): Promise<boolean> {
  if (!correspondenceId) return false;
  const rows = await manager.query(
    `SELECT EXISTS (
       SELECT 1 FROM "customer_inbound_messages"
       WHERE "correspondence_id" = $1
     ) AS "present"`,
    [correspondenceId],
  ) as Array<{ present: boolean }>;
  return rows[0]?.present ?? false;
}
