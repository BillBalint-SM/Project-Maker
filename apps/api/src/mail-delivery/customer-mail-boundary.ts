import type {
  CustomerMailErrorCode,
  CustomerMailboxCheckpoint,
  CustomerMailboxChangePage,
  MailSubmissionResult,
  OutboundCustomerMessage,
} from '@project-maker/contracts';
import { Injectable } from '@nestjs/common';

export const customerOutboundMailToken = 'CUSTOMER_OUTBOUND_MAIL';
export const customerMailboxChangesToken = 'CUSTOMER_MAILBOX_CHANGES';

export interface CustomerOutboundMail {
  isConfigured(): boolean;
  submit(message: OutboundCustomerMessage): Promise<MailSubmissionResult>;
}

export interface CustomerMailboxChanges {
  isConfigured(): boolean;
  readChanges(checkpoint: CustomerMailboxCheckpoint | null): Promise<CustomerMailboxChangePage>;
}

export function immutableOutboundCustomerMessage(
  message: OutboundCustomerMessage,
): OutboundCustomerMessage {
  return Object.freeze({
    ...(message.senderAddress === undefined ? {} : { senderAddress: message.senderAddress }),
    ...(message.senderName === undefined ? {} : { senderName: message.senderName }),
    recipientAddress: message.recipientAddress,
    ...(message.replyToAddress === undefined ? {} : { replyToAddress: message.replyToAddress }),
    subject: message.subject,
    textContent: message.textContent,
    ...(message.htmlContent === undefined ? {} : { htmlContent: message.htmlContent }),
  });
}

export class CustomerMailBoundaryError extends Error {
  constructor(
    readonly code: CustomerMailErrorCode,
    readonly retryAfterMs?: number,
  ) {
    super('Customer mail operation failed.');
    this.name = 'CustomerMailBoundaryError';
  }
}

@Injectable()
export class UnavailableCustomerMailboxChanges implements CustomerMailboxChanges {
  isConfigured(): boolean {
    return false;
  }

  async readChanges(_checkpoint: CustomerMailboxCheckpoint | null): Promise<CustomerMailboxChangePage> {
    throw new CustomerMailBoundaryError('CONFIGURATION_ERROR');
  }
}
