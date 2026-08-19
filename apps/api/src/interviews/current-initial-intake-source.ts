import { EntityManager, In } from 'typeorm';

import { InterviewRoundEntity } from './interview-round.entity';

export async function findCurrentInitialIntakeSource(
  manager: EntityManager,
  projectId: string,
): Promise<InterviewRoundEntity | null> {
  return manager.getRepository(InterviewRoundEntity).findOne({
    where: { projectId, type: 'INITIAL_INTAKE', status: In(['OPEN', 'ENDED']) },
    order: { createdAt: 'DESC', id: 'ASC' },
  });
}

export async function findCurrentInitialIntakeSources(
  manager: EntityManager,
  projectIds: readonly string[],
): Promise<ReadonlyMap<string, InterviewRoundEntity>> {
  if (projectIds.length === 0) {
    return new Map();
  }

  const rounds = await manager.getRepository(InterviewRoundEntity).find({
    where: {
      projectId: In([...projectIds]),
      type: 'INITIAL_INTAKE',
      status: In(['OPEN', 'ENDED']),
    },
    order: { projectId: 'ASC', createdAt: 'DESC', id: 'ASC' },
  });
  const currentByProjectId = new Map<string, InterviewRoundEntity>();
  for (const round of rounds) {
    if (!currentByProjectId.has(round.projectId)) {
      currentByProjectId.set(round.projectId, round);
    }
  }
  return currentByProjectId;
}
