import { createHash } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';

export interface ResolvedCustomerSender {
  readonly name: string;
  readonly address: string;
}

export function dedicatedCustomerSender(config: ConfigService): ResolvedCustomerSender {
  const name = config.get<string>('CORRESPONDENCE_MAILBOX_NAME')?.trim() ?? '';
  const address = config.get<string>('CORRESPONDENCE_MAILBOX_ADDRESS')?.trim() || '';
  if (
    !name
    || name.length > 255
    || /[\r\n\0]/.test(name)
    || !isEmail(address)
    || /[\r\n<>]/.test(address)
  ) {
    throw new ConflictException('The correspondence mailbox is not configured correctly.');
  }
  return { name, address };
}

export function customerMailDigest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function customerReplyToAddress(mailbox: string, token: string): string {
  const at = mailbox.lastIndexOf('@');
  return `${mailbox.slice(0, at)}+${token}${mailbox.slice(at)}`;
}
