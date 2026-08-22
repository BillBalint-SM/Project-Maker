import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';

export interface UploadedAttachmentFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
}

export interface ValidatedAttachmentFile extends UploadedAttachmentFile {
  readonly originalName: string;
}

export const attachmentHardLimitBytes = 50 * 1024 * 1024;

const allowedExtensions: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'text/plain': ['.txt', '.md', '.csv'],
  'text/markdown': ['.md'],
  'text/csv': ['.csv'],
  'application/csv': ['.csv'],
  'application/rtf': ['.rtf'],
  'text/rtf': ['.rtf'],
  'application/msword': ['.doc'],
  'application/vnd.ms-excel': ['.xls', '.csv'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.ms-project': ['.mpp'],
  'application/x-msproject': ['.mpp'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.oasis.opendocument.text': ['.odt'],
  'application/vnd.oasis.opendocument.spreadsheet': ['.ods'],
  'application/vnd.oasis.opendocument.presentation': ['.odp'],
  'application/vnd.ms-visio.drawing': ['.vsdx'],
};

const textExtensions = new Set(['.txt', '.md', '.csv']);
const compoundDocumentExtensions = new Set(['.doc', '.xls', '.ppt', '.mpp']);
const zippedDocumentExtensions = new Set([
  '.docx',
  '.xlsx',
  '.pptx',
  '.odt',
  '.ods',
  '.odp',
  '.vsdx',
]);
const compoundDocumentSignature = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const zippedDocumentSignature = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

export function resolveAttachmentLimitBytes(configuredMiB: string | undefined): number {
  if (configuredMiB === undefined || configuredMiB.trim() === '') {
    return attachmentHardLimitBytes;
  }
  const value = Number(configuredMiB);
  if (!Number.isInteger(value) || value < 1 || value > 50) {
    throw new Error('ATTACHMENT_MAX_MIB must be a whole number between 1 and 50.');
  }
  return value * 1024 * 1024;
}

export function validateAttachmentFile(
  file: UploadedAttachmentFile,
  maxBytes: number,
): ValidatedAttachmentFile {
  const originalName = requireSafeFilename(file.originalname);
  if (file.size < 1 || file.size > maxBytes || file.buffer.length !== file.size) {
    throw new BadRequestException(
      `Attachment size must be between 1 byte and ${maxBytes / 1024 / 1024} MiB.`,
    );
  }
  const extension = extname(originalName).toLowerCase();
  if (!allowedExtensions[file.mimetype]?.includes(extension)) {
    throw new BadRequestException('Attachment type and filename extension are not allowed.');
  }
  if (file.mimetype === 'application/pdf' && file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new BadRequestException('The uploaded PDF structure is invalid.');
  }
  if (
    file.mimetype === 'image/png' &&
    !file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    throw new BadRequestException('The uploaded PNG structure is invalid.');
  }
  if (
    file.mimetype === 'image/jpeg' &&
    !file.buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
  ) {
    throw new BadRequestException('The uploaded JPEG structure is invalid.');
  }
  if (textExtensions.has(extension)) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw new BadRequestException('Text attachments must contain valid UTF-8.');
    }
    if (file.buffer.includes(0)) {
      throw new BadRequestException('Text attachments must be inert plain text.');
    }
  }
  if (extension === '.rtf' && file.buffer.subarray(0, 5).toString('ascii') !== '{\\rtf') {
    throw new BadRequestException('The uploaded document structure is invalid.');
  }
  if (
    compoundDocumentExtensions.has(extension) &&
    !file.buffer.subarray(0, compoundDocumentSignature.length).equals(compoundDocumentSignature)
  ) {
    throw new BadRequestException('The uploaded document structure is invalid.');
  }
  if (
    zippedDocumentExtensions.has(extension) &&
    !file.buffer.subarray(0, zippedDocumentSignature.length).equals(zippedDocumentSignature)
  ) {
    throw new BadRequestException('The uploaded document structure is invalid.');
  }
  return { ...file, originalName };
}

export function attachmentContentDisposition(filename: string): string {
  const extension = filename.match(/\.[A-Za-z0-9]+$/)?.[0] ?? '';
  return `attachment; filename="attachment${extension}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function requireSafeFilename(value: string): string {
  const decodedValue = decodeMultipartFilename(value);
  if (
    decodedValue.length === 0 ||
    decodedValue !== decodedValue.trim() ||
    decodedValue === '.' ||
    decodedValue === '..' ||
    [...decodedValue].length > 255 ||
    /[\u0000-\u001f\u007f<>:"/\\|?*]/u.test(decodedValue)
  ) {
    throw new BadRequestException('Attachment filename is invalid.');
  }
  return decodedValue;
}

function decodeMultipartFilename(value: string): string {
  const decoded = Buffer.from(value, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? value : decoded;
}
