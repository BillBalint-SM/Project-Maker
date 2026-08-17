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
