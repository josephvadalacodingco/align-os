import { NextResponse } from 'next/server';
import { EventType } from '@prisma/client';
import { prisma } from '@/lib/prisma';

async function getUserId() {
  const email = 'demo@alignos.local';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const user = await prisma.user.create({ data: { email } });
  return user.id;
}

export async function POST(request: Request) {
  const userId = await getUserId();
  const body = await request.json();
  const { title, startTime, endTime, type } = body;

  if (!title || !startTime || !endTime) {
    return NextResponse.json(
      { error: 'title, startTime, endTime are required' },
      { status: 400 }
    );
  }

  const event = await prisma.calendarEvent.create({
    data: {
      userId,
      title,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      type: type === 'SCHEDULED_TASK' ? EventType.SCHEDULED_TASK : EventType.HARD_CONSTRAINT,
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}

