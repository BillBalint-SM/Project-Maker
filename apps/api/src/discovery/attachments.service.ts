import { createHash, randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  governedAttachmentOwnerKinds,
  type GovernedAttachment,
  type GovernedAttachmentOwnerKind,
} from '@project-maker/contracts';
import { DataSource, type EntityManager, In } from 'typeorm';

import {
  resolveAttachmentLimitBytes,
  validateAttachmentFile,
  type UploadedAttachmentFile,
} from '../attachments/attachment-file-policy';
import { AuditEvent } from '../audit/audit-event.entity';
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { InterviewCustomerHandoffService } from '../interview-customer-handoffs/interview-customer-handoff.service';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { EvidenceEntity } from './evidence.entity';
import { GovernedAttachmentEntity } from './governed-attachment.entity';

@Injectable()
export class AttachmentsService {
  private readonly maxAttachmentBytes: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly handoffService: InterviewCustomerHandoffService,
    config: ConfigService,
  ) {
    this.maxAttachmentBytes = resolveAttachmentLimitBytes(
      config.get<string>('ATTACHMENT_MAX_MIB'),
    );
  }

  async list(projectId: string): Promise<readonly GovernedAttachment[]> {
    await requireProject(this.dataSource.manager, projectId, false);
    return (await this.dataSource.manager.getRepository(GovernedAttachmentEntity).find({
      where: { projectId, ownerKind: In([...governedAttachmentOwnerKinds]) },
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
    const validatedFile = validateAttachmentFile(file, this.maxAttachmentBytes);
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      await requireMutableOwner(
        manager,
        this.handoffService,
        projectId,
        ownerKind,
        ownerId,
      );
      const attachment = manager.getRepository(GovernedAttachmentEntity).create({
        id: randomUUID(),
        projectId,
        ownerKind,
        ownerId,
        originalName: validatedFile.originalName,
        contentType: validatedFile.mimetype,
        sizeBytes: validatedFile.size,
        sha256: createHash('sha256').update(validatedFile.buffer).digest('hex'),
        content: validatedFile.buffer,
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
    const attachment = await this.dataSource.manager
      .getRepository(GovernedAttachmentEntity)
      .createQueryBuilder('attachment')
      .addSelect('attachment.content')
      .where('attachment.id = :attachmentId', { attachmentId })
      .andWhere('attachment.projectId = :projectId', { projectId })
      .getOne();
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
      await requireMutableOwner(
        manager,
        this.handoffService,
        projectId,
        attachment.ownerKind,
        attachment.ownerId,
      );
      if (await manager.getRepository(EvidenceEntity).existsBy({ attachmentId })) {
        throw new ConflictException('Attachment is retained by discovery evidence.');
      }
      await manager.getRepository(GovernedAttachmentEntity).remove(attachment);
      await audit(manager, projectId, 'GOVERNED_ATTACHMENT_DELETED', { attachmentId });
    });
  }
}

async function requireMutableOwner(
  manager: EntityManager,
  handoffService: InterviewCustomerHandoffService,
  projectId: string,
  ownerKind: GovernedAttachmentOwnerKind,
  ownerId: string,
): Promise<void> {
  if (ownerKind === 'DISCOVERY_FOLLOW_UP') {
    const followUp = await manager.getRepository(DiscoveryFollowUpEntity).findOneBy({
      id: ownerId,
      projectId,
    });
    if (!followUp) {
      throw new NotFoundException('Discovery follow-up owner not found.');
    }
    if (followUp.status !== 'Nyitott') {
      throw new ConflictException('Discovery follow-up is not open.');
    }
    return;
  }
  const round = await manager.getRepository(InterviewRoundEntity)
    .createQueryBuilder('round')
    .innerJoin(RoundQuestionSnapshotEntity, 'snapshot', 'snapshot.roundId = round.id')
    .where('snapshot.id = :ownerId', { ownerId })
    .andWhere('round.projectId = :projectId', { projectId })
    .andWhere('round.type = :type', { type: 'INITIAL_INTAKE' })
    .getOne();
  if (!round) throw new NotFoundException('Initial Intake snapshot owner not found.');
  await handoffService.requireEditableRound(manager, round);
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
