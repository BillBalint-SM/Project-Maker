import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProjectContact } from '@project-maker/contracts';
import { DataSource, type EntityManager } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { SaveProjectContactDto } from './dto/save-project-contact.dto';
import { ProjectContactEntity } from './project-contact.entity';

@Injectable()
export class ContactsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(projectId: string): Promise<readonly ProjectContact[]> {
    await requireProject(this.dataSource.manager, projectId, false);
    return (await this.dataSource.manager.getRepository(ProjectContactEntity).find({
      where: { projectId },
      order: { name: 'ASC', id: 'ASC' },
    })).map(toContact);
  }

  async create(projectId: string, input: SaveProjectContactDto): Promise<ProjectContact> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const contact = manager.getRepository(ProjectContactEntity).create({
        id: randomUUID(),
        projectId,
        ...normalizedContact(input),
      });
      const saved = await manager.getRepository(ProjectContactEntity).save(contact);
      await audit(manager, projectId, 'PROJECT_CONTACT_CREATED', { contactId: saved.id });
      return toContact(saved);
    });
  }

  async update(
    projectId: string,
    contactId: string,
    input: SaveProjectContactDto,
  ): Promise<ProjectContact> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const contact = await manager.getRepository(ProjectContactEntity).findOneBy({
        id: contactId,
        projectId,
      });
      if (!contact) throw new NotFoundException('Project contact not found.');
      Object.assign(contact, normalizedContact(input));
      const saved = await manager.getRepository(ProjectContactEntity).save(contact);
      await audit(manager, projectId, 'PROJECT_CONTACT_UPDATED', { contactId });
      return toContact(saved);
    });
  }

  async delete(projectId: string, contactId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const contact = await manager.getRepository(ProjectContactEntity).findOneBy({
        id: contactId,
        projectId,
      });
      if (!contact) throw new NotFoundException('Project contact not found.');
      await manager.getRepository(ProjectContactEntity).remove(contact);
      await audit(manager, projectId, 'PROJECT_CONTACT_DELETED', { contactId });
    });
  }
}

async function requireProject(manager: EntityManager, projectId: string, mutable: boolean): Promise<void> {
  const project = await manager.getRepository(Project).findOneBy({ id: projectId });
  if (!project) throw new NotFoundException('Project not found.');
  if (mutable && project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot change contacts.');
  }
}

function normalizedContact(input: SaveProjectContactDto): Pick<ProjectContactEntity, 'name' | 'email' | 'phone' | 'note'> {
  return {
    name: required(input.name, 'name'),
    email: optional(input.email)?.toLowerCase() ?? null,
    phone: optional(input.phone),
    note: optional(input.note),
  };
}

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException(`${field} must not be blank.`);
  return normalized;
}

function optional(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const normalized = value.trim();
  return normalized || null;
}

function toContact(contact: ProjectContactEntity): ProjectContact {
  return {
    id: contact.id,
    projectId: contact.projectId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    note: contact.note,
    createdAt: contact.createdAt.toISOString(),
    updatedAt: contact.updatedAt.toISOString(),
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
