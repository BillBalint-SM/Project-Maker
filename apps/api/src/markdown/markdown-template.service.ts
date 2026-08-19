import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateMarkdownTemplateInput,
  MarkdownTemplatePreview,
  MarkdownTemplateSummary,
  UpdateMarkdownTemplateDraftInput,
} from '@project-maker/contracts';
import {
  markdownTemplatePlaceholderDefinitions,
  markdownTemplatePlaceholderNames,
  type MarkdownTemplatePlaceholderName,
} from '@project-maker/contracts/markdown-templates';
import { DataSource, QueryFailedError } from 'typeorm';

import { MarkdownTemplateEntity, MarkdownTemplateVersionEntity } from './markdown-template.entity';

const placeholderPattern = /{{\s*([a-zA-Z][a-zA-Z0-9.]*)\s*(\?)?\s*}}/g;
const allowedPlaceholders = new Set<string>(markdownTemplatePlaceholderNames);
const placeholderDefinitions = new Map(
  markdownTemplatePlaceholderDefinitions.map((definition) => [definition.name, definition]),
);
const optionalPlaceholderBlockPattern = /^{{\s*([a-zA-Z][a-zA-Z0-9.]*)\s*\?\s*}}$/;
const headingBlockPattern = /^#{1,6}[ \t]+\S[^\r\n]*$/;

const previewValues: Readonly<Record<string, string | null>> = {
  'project.name': 'Minta projekt',
  'revision.metadata': '## Specifikációverzió\n\n- Ok: Kézi generálás\n- Verzió: 1',
  'project.context': '## Projektkontextus\n\n- Ügyfél: Minta ügyfél\n- Felelős: Minta tulajdonos',
  'project.schema': '## Elfogadott kérdésséma\n\n30 kiválasztott kérdés.',
  'project.initialIntake': '## Initial Intake\n\nA minta felmérés lezárult.',
  'project.readiness': '## Felkészültség\n\n65 pont.',
  'project.decisionReview': '## Döntési értékelés\n\nBecslés előkészíthető.',
};

@Injectable()
export class MarkdownTemplateService {
  constructor(private readonly dataSource: DataSource) {}

  async list(): Promise<readonly MarkdownTemplateSummary[]> {
    const templates = await this.dataSource.getRepository(MarkdownTemplateEntity).find({
      order: { isDefault: 'DESC', name: 'ASC', id: 'ASC' },
    });
    const versions = await this.dataSource.getRepository(MarkdownTemplateVersionEntity).find({
      order: { templateId: 'ASC', version: 'DESC' },
    });
    const latestVersion = new Map<string, number>();
    for (const version of versions) {
      if (!latestVersion.has(version.templateId)) {
        latestVersion.set(version.templateId, version.version);
      }
    }
    return templates.map((template) => toSummary(template, latestVersion.get(template.id) ?? null));
  }

  async create(input: CreateMarkdownTemplateInput): Promise<MarkdownTemplateSummary> {
    const name = requireText(input.name, 'A sablon neve');
    const draftContent = requireText(input.draftContent, 'A sablon piszkozata');
    validateTemplateContent(draftContent);
    const template = this.dataSource.getRepository(MarkdownTemplateEntity).create({
      id: randomUUID(),
      name,
      draftContent,
      isDefault: false,
    });
    try {
      return toSummary(await this.dataSource.getRepository(MarkdownTemplateEntity).save(template), null);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Már létezik ilyen nevű specifikációs sablon.');
      }
      throw error;
    }
  }

  async updateDraft(id: string, input: UpdateMarkdownTemplateDraftInput): Promise<MarkdownTemplateSummary> {
    const template = await this.findTemplate(id);
    template.name = requireText(input.name, 'A sablon neve');
    template.draftContent = requireText(input.draftContent, 'A sablon piszkozata');
    validateTemplateContent(template.draftContent);
    try {
      const saved = await this.dataSource.getRepository(MarkdownTemplateEntity).save(template);
      return toSummary(saved, await this.latestVersion(id));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Már létezik ilyen nevű specifikációs sablon.');
      }
      throw error;
    }
  }

  async preview(id: string): Promise<MarkdownTemplatePreview> {
    const template = await this.findTemplate(id);
    return { content: renderTemplate(template.draftContent, previewValues) };
  }

  async publish(id: string): Promise<MarkdownTemplateSummary> {
    return this.dataSource.transaction(async (manager) => {
      const template = await manager.getRepository(MarkdownTemplateEntity).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!template) {
        throw new NotFoundException('Markdown template not found.');
      }
      validateTemplateContent(template.draftContent);
      const previous = await manager.getRepository(MarkdownTemplateVersionEntity).findOne({
        where: { templateId: id },
        order: { version: 'DESC' },
      });
      const version = (previous?.version ?? 0) + 1;
      await manager.getRepository(MarkdownTemplateVersionEntity).save({
        id: randomUUID(),
        templateId: id,
        version,
        content: template.draftContent,
        publishedAt: new Date(),
      });
      return toSummary(template, version);
    });
  }

  async findPublished(templateId: string | null): Promise<{
    readonly template: MarkdownTemplateEntity;
    readonly version: MarkdownTemplateVersionEntity;
  }> {
    const template = templateId
      ? await this.findTemplate(templateId)
      : await this.dataSource.getRepository(MarkdownTemplateEntity).findOneBy({ isDefault: true });
    if (!template) {
      throw new ConflictException('Nem érhető el alapértelmezett specifikációs sablon.');
    }
    const version = await this.dataSource.getRepository(MarkdownTemplateVersionEntity).findOne({
      where: { templateId: template.id },
      order: { version: 'DESC' },
    });
    if (!version) {
      throw new ConflictException('A kiválasztott specifikációs sablonnak nincs publikált verziója.');
    }
    return { template, version };
  }

  private async findTemplate(id: string): Promise<MarkdownTemplateEntity> {
    const template = await this.dataSource.getRepository(MarkdownTemplateEntity).findOneBy({ id });
    if (!template) {
      throw new NotFoundException('Markdown template not found.');
    }
    return template;
  }

  private async latestVersion(templateId: string): Promise<number | null> {
    const version = await this.dataSource.getRepository(MarkdownTemplateVersionEntity).findOne({
      where: { templateId },
      order: { version: 'DESC' },
    });
    return version?.version ?? null;
  }
}

export function validateTemplateContent(content: string): void {
  const matches = [...content.matchAll(placeholderPattern)];
  const residue = content.replace(placeholderPattern, '');
  if (residue.includes('{{') || residue.includes('}}')) {
    throw new BadRequestException('A specifikációs sablon hibás formátumú helyőrzőt tartalmaz.');
  }
  for (const match of matches) {
    if (!allowedPlaceholders.has(match[1] ?? '')) {
      throw new BadRequestException(`Nem támogatott specifikációs sablon-helyőrző: ${match[1] ?? ''}.`);
    }
  }
  for (const block of splitMarkdownBlocks(content)) {
    const hasOptionalPlaceholder = [...block.matchAll(placeholderPattern)].some(
      (match) => match[2] !== undefined,
    );
    if (hasOptionalPlaceholder && !optionalPlaceholderBlockPattern.test(block.trim())) {
      throw new BadRequestException(
        'Az opcionális specifikációs sablon helyőrzőjének önálló Markdown-blokkban kell állnia.',
      );
    }
  }
}

export function renderTemplate(
  content: string,
  values: Readonly<Record<string, string | null>>,
): string {
  validateTemplateContent(content);
  const contentWithOptionalBlocks = renderOptionalBlocks(content, values);
  return `${contentWithOptionalBlocks.replace(placeholderPattern, (_token, name: string, optional: string | undefined) => {
    const value = values[name];
    if (value !== null && value !== undefined) {
      return value;
    }
    if (optional) {
      return '';
    }
    const definition = placeholderDefinitions.get(name as MarkdownTemplatePlaceholderName);
    throw new ConflictException(
      `A kötelező sablonblokk nem áll rendelkezésre: ${definition?.label ?? 'ismeretlen projektadat'}.`,
    );
  }).replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

function renderOptionalBlocks(
  content: string,
  values: Readonly<Record<string, string | null>>,
): string {
  const renderedBlocks: string[] = [];
  for (const block of splitMarkdownBlocks(content)) {
    const optionalMatch = block.trim().match(optionalPlaceholderBlockPattern);
    if (!optionalMatch) {
      renderedBlocks.push(block);
      continue;
    }
    const value = values[optionalMatch[1] ?? ''];
    if (value !== null && value !== undefined) {
      renderedBlocks.push(value);
      continue;
    }
    if (headingBlockPattern.test(renderedBlocks.at(-1)?.trim() ?? '')) {
      renderedBlocks.pop();
    }
  }
  return renderedBlocks.join('\n\n');
}

function splitMarkdownBlocks(content: string): readonly string[] {
  return content.split(/\r?\n[ \t]*\r?\n/);
}

function toSummary(template: MarkdownTemplateEntity, latestPublishedVersion: number | null): MarkdownTemplateSummary {
  return {
    id: template.id,
    name: template.name,
    draftContent: template.draftContent,
    latestPublishedVersion,
    isDefault: template.isDefault,
    updatedAt: template.updatedAt.toISOString(),
  };
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException(`${label} nem lehet üres.`);
  }
  return normalized;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof QueryFailedError &&
    (error.driverError as { readonly code?: string }).code === '23505';
}
