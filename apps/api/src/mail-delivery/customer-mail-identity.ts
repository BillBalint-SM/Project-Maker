import { createHash } from 'node:crypto';

import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';

export interface CustomerSenderSelection {
  readonly mode: 'DEDICATED' | 'CUSTOM';
  readonly name?: string;
  readonly address?: string;
}

export interface ResolvedCustomerSender {
  readonly name: string;
  readonly address: string;
}

export function dedicatedCustomerSender(config: ConfigService): ResolvedCustomerSender {
  const name = config.get<string>('CUSTOMER_MAILBOX_NAME')?.trim() || 'Project Maker';
  const address = config.get<string>('CUSTOMER_MAILBOX_ADDRESS')?.trim() || '';
  if (!isExactPteAddress(address)) {
    throw new ConflictException('A dedikált @pte.hu postafiók nincs beállítva.');
  }
  return { name, address };
}

export function resolveCustomerSender(
  selection: CustomerSenderSelection,
  config: ConfigService,
): ResolvedCustomerSender {
  if (selection.mode === 'DEDICATED') {
    return dedicatedCustomerSender(config);
  }
  return requireCustomerSender(selection.name, selection.address);
}

export function preferredCustomerSender(
  lastUsedName: string | null,
  lastUsedAddress: string | null,
  config: ConfigService,
): ResolvedCustomerSender {
  if (lastUsedName?.trim() && lastUsedAddress && isExactPteAddress(lastUsedAddress)) {
    return { name: lastUsedName.trim(), address: lastUsedAddress.trim() };
  }
  return dedicatedCustomerSender(config);
}

export function requireCustomerSender(
  rawName: string | undefined,
  rawAddress: string | undefined,
): ResolvedCustomerSender {
  const name = rawName?.trim() ?? '';
  const address = rawAddress?.trim() ?? '';
  if (!name || !isExactPteAddress(address)) {
    throw new BadRequestException('A feladó neve és pontos @pte.hu címe kötelező.');
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

function isExactPteAddress(value: string): boolean {
  return isEmail(value) && /^[^@\s]+@pte\.hu$/i.test(value);
}
