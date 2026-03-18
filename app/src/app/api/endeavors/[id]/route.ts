import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await request.json();
  const { name, priorityRank, baselineHours } = body;

  const endeavor = await prisma.endeavor.update({
    where: { id },
    data: {
      name,
      priorityRank,
      baselineHours,
    },
  });

  return NextResponse.json({ endeavor });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  await prisma.endeavor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

