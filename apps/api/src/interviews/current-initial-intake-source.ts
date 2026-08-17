import { EntityManager } from 'typeorm';

import { InterviewRoundEntity } from './interview-round.entity';

export async function findCurrentInitialIntakeSource(
  manager: EntityManager,
  projectId: string,
): Promise<InterviewRoundEntity | null> {
  const rounds = manager.getRepository(InterviewRoundEntity);
  const openRound = await rounds.findOne({
    where: { projectId, type: 'INITIAL_INTAKE', status: 'OPEN' },
    order: { createdAt: 'DESC', id: 'ASC' },
  });
  if (openRound) {
    return openRound;
  }
  return rounds.findOne({
    where: { projectId, type: 'INITIAL_INTAKE', status: 'ENDED' },
    order: { createdAt: 'DESC', id: 'ASC' },
  });
}
