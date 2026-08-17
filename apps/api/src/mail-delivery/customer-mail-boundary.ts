import type {
  CustomerMailErrorCode,
  CustomerMailboxChangePage,
  MailSubmissionResult,
  OutboundCustomerMessage,
} from '@project-maker/contracts';

export const customerOutboundMailToken = 'CUSTOMER_OUTBOUND_MAIL';
export const customerMailboxChangesToken = 'CUSTOMER_MAILBOX_CHANGES';

export interface CustomerOutboundMail {
  isConfigured(): boolean;
  submit(message: OutboundCustomerMessage): Promise<MailSubmissionResult>;
}

export interface CustomerMailboxChanges {
  readChanges(checkpoint: string | null): Promise<CustomerMailboxChangePage>;
}

export class CustomerMailBoundaryError extends Error {
  constructor(readonly code: CustomerMailErrorCode) {
    super('Customer mail operation failed.');
    this.name = 'CustomerMailBoundaryError';
  }
}
