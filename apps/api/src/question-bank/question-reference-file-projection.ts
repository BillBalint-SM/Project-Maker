import { InternalServerErrorException } from '@nestjs/common';
import type { QuestionReferenceFile } from '@project-maker/contracts';
import { type EntityManager, In } from 'typeorm';

import { QuestionReferenceFileContentEntity } from './question-reference-file-content.entity';
import { QuestionReferenceFileEntity } from './question-reference-file.entity';

export async function loadQuestionReferenceFiles(
  manager: EntityManager,
  questionIds: readonly string[],
): Promise<ReadonlyMap<string, readonly QuestionReferenceFile[]>> {
  if (questionIds.length === 0) return new Map();
  const references = await manager.getRepository(QuestionReferenceFileEntity).findBy({
    questionId: In([...questionIds]),
  });
  if (references.length === 0) return new Map();
  const contents = await manager.getRepository(QuestionReferenceFileContentEntity).findBy({
    id: In([...new Set(references.map(({ fileId }) => fileId))]),
  });
  const contentById = new Map(contents.map((content) => [content.id, content]));
  const byQuestionId = new Map<string, QuestionReferenceFile[]>();
  for (const reference of references) {
    const content = contentById.get(reference.fileId);
    if (!content) {
      throw new InternalServerErrorException('Stored Question Bank reference file is incomplete.');
    }
    const current = byQuestionId.get(reference.questionId) ?? [];
    current.push(toQuestionReferenceFile(content));
    byQuestionId.set(reference.questionId, current);
  }
  for (const files of byQuestionId.values()) {
    files.sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id),
    );
  }
  return byQuestionId;
}

function toQuestionReferenceFile(
  content: QuestionReferenceFileContentEntity,
): QuestionReferenceFile {
  return {
    id: content.id,
    originalName: content.originalName,
    contentType: content.contentType,
    sizeBytes: content.sizeBytes,
    sha256: content.sha256,
    createdAt: toIso(content.createdAt),
  };
}

function toIso(value: Date): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new InternalServerErrorException(
      'Stored Question Bank reference-file timestamp is invalid.',
    );
  }
  return timestamp.toISOString();
}
