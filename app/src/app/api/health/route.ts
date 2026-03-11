import { NextResponse } from 'next/server';

export async function GET() {
  const body: Record<string, unknown> = { ok: true };
  if (process.env.ENVIRONMENT_NAME) body.env = process.env.ENVIRONMENT_NAME;
  if (process.env.APP_SLUG) body.app = process.env.APP_SLUG;
  if (process.env.GIT_SHA) body.sha = process.env.GIT_SHA;
  return NextResponse.json(body);
}
