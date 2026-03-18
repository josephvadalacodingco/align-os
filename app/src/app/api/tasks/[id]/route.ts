import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const body = await request.json();

  const task = await prisma.task.update({
    where: { id },
    data: body,
  });

  return NextResponse.json({ task });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

