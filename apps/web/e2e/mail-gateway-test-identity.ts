export const correspondenceMailboxName =
  process.env.CORRESPONDENCE_MAILBOX_NAME ?? 'Project Maker';

export const correspondenceMailboxAddress =
  process.env.CORRESPONDENCE_MAILBOX_ADDRESS ?? 'project-maker-e2e@example.test';

export const correspondenceMailboxIdentity =
  `${correspondenceMailboxName} <${correspondenceMailboxAddress}>`;

export function correspondenceReplyToPattern(): RegExp {
  const at = correspondenceMailboxAddress.lastIndexOf('@');
  const local = correspondenceMailboxAddress.slice(0, at);
  const domain = correspondenceMailboxAddress.slice(at + 1);
  return new RegExp(`^${escapeRegExp(local)}\\+[a-f0-9]{48}@${escapeRegExp(domain)}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
