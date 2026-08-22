import { randomUUID } from 'node:crypto';

import type { EntityManager } from 'typeorm';

import { CustomerCorrespondenceEntity } from './customer-correspondence.entity';
import { CustomerOutboundAttemptEntity } from './customer-outbound-attempt.entity';
import { CustomerOutboundCommunicationEntity } from './customer-outbound-communication.entity';

export interface CanonicalOutboundSnapshot {
  readonly projectId: string;
  readonly sourceType: CustomerOutboundCommunicationEntity['sourceType'];
  readonly sourceId: string;
  readonly senderName: string;
  readonly senderAddress: string;
  readonly recipientName: string;
  readonly recipientAddress: string;
  readonly subject: string;
  readonly htmlContent: string;
  readonly textContent: string;
  readonly sourceContentVersion: number;
  readonly previewDigest: string;
  readonly replyToAddress: string;
  readonly replyTokenHash: string;
  readonly predecessorId?: string | null;
  readonly sourceFollowUpId?: string | null;
  readonly sourceFollowUpVersion?: number | null;
}

/** The sole write seam for an immutable outbound snapshot and its reply anchor. */
export async function createCanonicalOutbound(
  manager: EntityManager,
  snapshot: CanonicalOutboundSnapshot,
): Promise<{
  readonly outbound: CustomerOutboundCommunicationEntity;
  readonly correspondence: CustomerCorrespondenceEntity;
}> {
  const outbound = await manager
    .getRepository(CustomerOutboundCommunicationEntity)
    .save({
      id: randomUUID(),
      projectId: snapshot.projectId,
      sourceType: snapshot.sourceType,
      sourceId: snapshot.sourceId,
      senderName: snapshot.senderName,
      senderAddress: snapshot.senderAddress,
      recipientName: snapshot.recipientName,
      recipientAddress: snapshot.recipientAddress,
      subject: snapshot.subject,
      htmlContent: snapshot.htmlContent,
      textContent: snapshot.textContent,
      sourceContentVersion: snapshot.sourceContentVersion,
      previewDigest: snapshot.previewDigest,
      replyToAddress: snapshot.replyToAddress,
      replyTokenHash: snapshot.replyTokenHash,
    });
  const correspondence = await manager
    .getRepository(CustomerCorrespondenceEntity)
    .save({
      id: randomUUID(),
      projectId: snapshot.projectId,
      outboundCommunicationId: outbound.id,
      predecessorId: snapshot.predecessorId ?? null,
      sourceFollowUpId: snapshot.sourceFollowUpId ?? null,
      sourceFollowUpVersion: snapshot.sourceFollowUpVersion ?? null,
      status: 'Válaszra vár',
      unreadMessageCount: 0,
    });
  return { outbound, correspondence };
}

export async function appendCanonicalOutboundAttempt(
  manager: EntityManager,
  outboundCommunicationId: string,
  result: CustomerOutboundAttemptEntity['result'],
  failureCode: string | null,
  messageReference: string | null,
): Promise<CustomerOutboundAttemptEntity> {
  return manager.getRepository(CustomerOutboundAttemptEntity).save({
    id: randomUUID(),
    outboundCommunicationId,
    result,
    failureCode,
    messageReference,
  });
}
