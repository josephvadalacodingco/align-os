import { NextResponse } from 'next/server';
import { TaskType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

async function getUserId() {
  const email = 'demo@alignos.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const user = await prisma.user.create({ data: { email } });
  return user.id;
}

export async function GET() {
  const userId = await getUserId();
  const tasks = await prisma.task.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const userId = await getUserId();
  const body = await request.json();
  const {
    title,
    type,
    importance,
    urgency,
    durationHours,
    recurringRule,
    endeavorId,
    projectName,
  } = body;

  if (!title || typeof title !== 'string') {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }
  if (type !== 'ENDEAVOR' && type !== 'LIFE_MAINTENANCE') {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      userId,
      title,
      type: type === 'ENDEAVOR' ? TaskType.ENDEAVOR : TaskType.LIFE_MAINTENANCE,
      importance,
      urgency,
      durationHours: typeof durationHours === 'number' ? durationHours : 1,
      recurringRule: recurringRule ?? null,
      endeavorId: endeavorId ?? null,
      projectName: projectName ?? null,
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}

