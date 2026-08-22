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

  it('accepts the supported business document families', () => {
    const compoundFile = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const zippedDocument = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    const cases = [
      ['scope.doc', 'application/msword', compoundFile],
      [
        'scope.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        zippedDocument,
      ],
      ['scope.rtf', 'application/rtf', Buffer.from('{\\rtf1 scope', 'ascii')],
      ['scope.odt', 'application/vnd.oasis.opendocument.text', zippedDocument],
      ['estimate.xls', 'application/vnd.ms-excel', compoundFile],
      [
        'estimate.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        zippedDocument,
      ],
      ['estimate.csv', 'text/csv', Buffer.from('item,cost\nwork,120', 'utf8')],
      ['estimate.ods', 'application/vnd.oasis.opendocument.spreadsheet', zippedDocument],
      ['deck.ppt', 'application/vnd.ms-powerpoint', compoundFile],
      [
        'deck.pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        zippedDocument,
      ],
      ['deck.odp', 'application/vnd.oasis.opendocument.presentation', zippedDocument],
      ['notes.md', 'text/markdown', Buffer.from('# Scope', 'utf8')],
      ['plan.mpp', 'application/vnd.ms-project', compoundFile],
      ['flow.vsdx', 'application/vnd.ms-visio.drawing', zippedDocument],
    ] as const;

    for (const [originalname, mimetype, buffer] of cases) {
      assert.equal(
        validateAttachmentFile(
          { originalname, mimetype, size: buffer.length, buffer },
          attachmentHardLimitBytes,
        ).originalName,
        originalname,
      );
    }
  });

  it('rejects generic archives and invalid document containers', () => {
    const zippedDocument = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
    assert.throws(
      () =>
        validateAttachmentFile(
          {
            originalname: 'documents.zip',
            mimetype: 'application/zip',
            size: zippedDocument.length,
            buffer: zippedDocument,
          },
          attachmentHardLimitBytes,
        ),
      /Attachment type and filename extension are not allowed/,
    );
    assert.throws(
      () =>
        validateAttachmentFile(
          {
            originalname: 'scope.docx',
            mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            size: 14,
            buffer: Buffer.from('not an archive'),
          },
          attachmentHardLimitBytes,
        ),
      /The uploaded document structure is invalid/,
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
