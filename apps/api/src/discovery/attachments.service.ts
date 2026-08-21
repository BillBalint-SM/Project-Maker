import { createHash, randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { GovernedAttachment, GovernedAttachmentOwnerKind } from '@project-maker/contracts';
import { DataSource, type EntityManager } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from '../question-bank/base-question.entity';
import { EvidenceEntity } from './evidence.entity';
import { GovernedAttachmentEntity } from './governed-attachment.entity';

export interface UploadedAttachmentFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly size: number;
  readonly buffer: Buffer;
}

const maxAttachmentBytes = 50 * 1024 * 1024;
const allowedExtensions: Readonly<Record<string, readonly string[]>> = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'text/plain': ['.txt'],
};

@Injectable()
export class AttachmentsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(projectId: string): Promise<readonly GovernedAttachment[]> {
    await requireProject(this.dataSource.manager, projectId, false);
    return (await this.dataSource.manager.getRepository(GovernedAttachmentEntity).find({
      where: { projectId },
      order: { createdAt: 'DESC', id: 'ASC' },
    })).map(toAttachment);
  }

  async upload(
    projectId: string,
    ownerKind: GovernedAttachmentOwnerKind,
    ownerId: string,
    file: UploadedAttachmentFile | undefined,
  ): Promise<GovernedAttachment> {
    if (!file) throw new BadRequestException('One attachment file is required.');
    const originalName = safeStoredName(file.originalname);
    validateFile(file, originalName);
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      await requireOwner(manager, projectId, ownerKind, ownerId);
      const attachment = manager.getRepository(GovernedAttachmentEntity).create({
        id: randomUUID(),
        projectId,
        ownerKind,
        ownerId,
        originalName,
        contentType: file.mimetype,
        sizeBytes: file.size,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        content: file.buffer,
      });
      const saved = await manager.getRepository(GovernedAttachmentEntity).save(attachment);
      await audit(manager, projectId, 'GOVERNED_ATTACHMENT_CREATED', {
        attachmentId: saved.id,
        ownerKind,
        ownerId,
      });
      return toAttachment(saved);
    });
  }

  async download(projectId: string, attachmentId: string): Promise<GovernedAttachmentEntity> {
    await requireProject(this.dataSource.manager, projectId, false);
    const attachment = await this.dataSource.manager.getRepository(GovernedAttachmentEntity).findOneBy({
      id: attachmentId,
      projectId,
    });
    if (!attachment) throw new NotFoundException('Attachment not found.');
    return attachment;
  }

  async delete(projectId: string, attachmentId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const attachment = await manager.getRepository(GovernedAttachmentEntity).findOneBy({
        id: attachmentId,
        projectId,
      });
      if (!attachment) throw new NotFoundException('Attachment not found.');
      if (await manager.getRepository(EvidenceEntity).existsBy({ attachmentId })) {
        throw new ConflictException('Attachment is retained by discovery evidence.');
      }
      await manager.getRepository(GovernedAttachmentEntity).remove(attachment);
      await audit(manager, projectId, 'GOVERNED_ATTACHMENT_DELETED', { attachmentId });
    });
  }
}

async function requireOwner(
  manager: EntityManager,
  projectId: string,
  ownerKind: GovernedAttachmentOwnerKind,
  ownerId: string,
): Promise<void> {
  if (ownerKind === 'QUESTION_BANK') {
    if (!await manager.getRepository(BaseQuestionEntity).existsBy({ id: ownerId })) {
      throw new NotFoundException('Question Bank owner not found.');
    }
    return;
  }
  if (ownerKind === 'DISCOVERY_FOLLOW_UP') {
    if (!await manager.getRepository(DiscoveryFollowUpEntity).existsBy({ id: ownerId, projectId })) {
      throw new NotFoundException('Discovery follow-up owner not found.');
    }
    return;
  }
  const snapshot = await manager.getRepository(RoundQuestionSnapshotEntity)
    .createQueryBuilder('snapshot')
    .innerJoin(InterviewRoundEntity, 'round', 'round.id = snapshot.roundId')
    .where('snapshot.id = :ownerId', { ownerId })
    .andWhere('round.projectId = :projectId', { projectId })
    .andWhere('round.type = :type', { type: 'INITIAL_INTAKE' })
    .getOne();
  if (!snapshot) throw new NotFoundException('Initial Intake snapshot owner not found.');
}

function validateFile(file: UploadedAttachmentFile, name: string): void {
  if (file.size < 1 || file.size > maxAttachmentBytes || file.buffer.length !== file.size) {
    throw new BadRequestException('Attachment size must be between 1 byte and 50 MiB.');
  }
  const extension = extname(name).toLowerCase();
  if (!allowedExtensions[file.mimetype]?.includes(extension)) {
    throw new BadRequestException('Attachment type and filename extension are not allowed.');
  }
  if (file.mimetype === 'application/pdf' && file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new BadRequestException('The uploaded PDF structure is invalid.');
  }
  if (file.mimetype === 'image/png' && !file.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    throw new BadRequestException('The uploaded PNG structure is invalid.');
  }
  if (file.mimetype === 'image/jpeg' && !file.buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
    throw new BadRequestException('The uploaded JPEG structure is invalid.');
  }
  if (file.mimetype === 'text/plain') {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw new BadRequestException('Text attachments must contain valid UTF-8.');
    }
    if (file.buffer.includes(0)) throw new BadRequestException('Text attachments must be inert plain text.');
  }
}

function safeStoredName(value: string): string {
  const leaf = basename(value.replaceAll('\\', '/')).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!leaf || leaf === '.' || leaf === '..') throw new BadRequestException('Attachment filename is invalid.');
  return [...leaf].slice(0, 255).join('');
}

async function requireProject(manager: EntityManager, projectId: string, mutable: boolean): Promise<void> {
  const project = await manager.getRepository(Project).findOneBy({ id: projectId });
  if (!project) throw new NotFoundException('Project not found.');
  if (mutable && project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot change attachments.');
  }
}

function toAttachment(attachment: GovernedAttachmentEntity): GovernedAttachment {
  return {
    id: attachment.id,
    projectId: attachment.projectId,
    ownerKind: attachment.ownerKind,
    ownerId: attachment.ownerId,
    originalName: attachment.originalName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    sha256: attachment.sha256,
    createdAt: attachment.createdAt.toISOString(),
  };
}

async function audit(
  manager: EntityManager,
  projectId: string,
  eventType: string,
  payload: Readonly<Record<string, string>>,
): Promise<void> {
  await manager.getRepository(AuditEvent).save({ id: randomUUID(), projectId, eventType, payload });
}
