import { NextResponse } from 'next/server';
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
  const endeavors = await prisma.endeavor.findMany({
    where: { userId },
    orderBy: { priorityRank: 'asc' },
  });
  return NextResponse.json({ endeavors });
}

export async function POST(request: Request) {
  const userId = await getUserId();
  const body = await request.json();
  const { name, priorityRank, baselineHours } = body;

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const endeavor = await prisma.endeavor.create({
    data: {
      userId,
      name,
      priorityRank: typeof priorityRank === 'number' ? priorityRank : 1,
      baselineHours:
        typeof baselineHours === 'number' ? baselineHours : undefined,
    },
  });

  return NextResponse.json({ endeavor }, { status: 201 });
}

