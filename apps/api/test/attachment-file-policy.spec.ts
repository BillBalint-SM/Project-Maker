import { BadRequestException } from '@nestjs/common';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  attachmentHardLimitBytes,
  resolveAttachmentLimitBytes,
  validateAttachmentFile,
} from '../src/attachments/attachment-file-policy';

describe('Attachment file policy', () => {
  it('defaults to 50 MiB and only accepts a smaller whole-MiB Operator limit', () => {
    assert.equal(resolveAttachmentLimitBytes(undefined), attachmentHardLimitBytes);
    assert.equal(resolveAttachmentLimitBytes('12'), 12 * 1024 * 1024);

    for (const value of ['0', '51', '1.5', 'twelve']) {
      assert.throws(
        () => resolveAttachmentLimitBytes(value),
        /ATTACHMENT_MAX_MIB must be a whole number between 1 and 50/,
      );
    }
  });

  it('rejects unsafe filenames instead of silently rewriting them', () => {
    assert.throws(
      () => validateAttachmentFile(textFile('scope<final>.txt'), attachmentHardLimitBytes),
      (error: unknown) =>
        error instanceof BadRequestException &&
        error.message === 'Attachment filename is invalid.',
    );
  });

  it('accepts a Hungarian UTF-8 filename and rejects mismatched content', () => {
    const accepted = validateAttachmentFile(
      textFile('ügyfél-igény.txt'),
      attachmentHardLimitBytes,
    );
    assert.equal(accepted.originalName, 'ügyfél-igény.txt');

    assert.throws(
      () => validateAttachmentFile({
        originalname: 'scope.pdf',
        mimetype: 'application/pdf',
        size: 9,
        buffer: Buffer.from('not a pdf'),
      }, attachmentHardLimitBytes),
      (error: unknown) =>
        error instanceof BadRequestException &&
        error.message === 'The uploaded PDF structure is invalid.',
    );
  });
});

function textFile(originalname: string): {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
} {
  const buffer = Buffer.from('scope', 'utf8');
  return {
    originalname,
    mimetype: 'text/plain',
    size: buffer.length,
    buffer,
  };
}
