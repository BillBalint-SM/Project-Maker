import { createHash } from 'node:crypto';

import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exactPteCustomerSenderAddressPattern } from '@project-maker/contracts/customer-mail';
import { isEmail } from 'class-validator';

export interface CustomerSenderSelection {
  readonly mode: 'DEDICATED' | 'CUSTOM';
  readonly address?: string;
}

export interface ResolvedCustomerSender {
  readonly address: string;
}

export function dedicatedCustomerSender(config: ConfigService): ResolvedCustomerSender {
  const address = config.get<string>('CUSTOMER_MAILBOX_ADDRESS')?.trim() || '';
  if (!isExactPteAddress(address)) {
    throw new ConflictException('A dedikált @pte.hu postafiók nincs beállítva.');
  }
  return { address };
}

export function resolveCustomerSender(
  selection: CustomerSenderSelection,
  config: ConfigService,
): ResolvedCustomerSender {
  if (selection.mode === 'DEDICATED') {
    return dedicatedCustomerSender(config);
  }
  return requireCustomerSender(selection.address);
}

export function preferredCustomerSender(
  lastUsedAddress: string | null,
  config: ConfigService,
): ResolvedCustomerSender {
  if (lastUsedAddress && isExactPteAddress(lastUsedAddress)) {
    const address = lastUsedAddress.trim();
    return { address };
  }
  return dedicatedCustomerSender(config);
}

export function requireCustomerSender(
  rawAddress: string | undefined,
): ResolvedCustomerSender {
  const address = rawAddress?.trim() ?? '';
  if (!isExactPteAddress(address)) {
    throw new BadRequestException('A feladó pontos @pte.hu címe kötelező.');
  }
  return { address };
}

export function customerMailDigest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function customerReplyToAddress(mailbox: string, token: string): string {
  const at = mailbox.lastIndexOf('@');
  return `${mailbox.slice(0, at)}+${token}${mailbox.slice(at)}`;
}

function isExactPteAddress(value: string): boolean {
  return isEmail(value) && exactPteCustomerSenderAddressPattern.test(value);
}
