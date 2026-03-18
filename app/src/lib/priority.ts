import { TaskType } from '@prisma/client';

export type PriorityTask = {
  id: string;
  type: TaskType;
  importance: number;
  urgency: number;
};

export function calculateTaskScore(
  task: PriorityTask,
  endeavorPriority?: number | null
): number {
  const importanceWeight = 3;
  const urgencyWeight = 2;
  const identityWeight = 1;

  const baseScore =
    task.importance * importanceWeight + task.urgency * urgencyWeight;

  if (task.type === TaskType.ENDEAVOR && endeavorPriority) {
    return baseScore + endeavorPriority * identityWeight;
  }

  return baseScore;
}

