import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const authHeaders = [
    'X-MS-CLIENT-PRINCIPAL',
    'X-MS-CLIENT-PRINCIPAL-NAME',
    'X-MS-CLIENT-PRINCIPAL-ID',
  ];
  const authHeaderPresence = authHeaders.map((name) => ({
    name,
    present: !!request.headers.get(name),
  }));

  return NextResponse.json({
    ENVIRONMENT_NAME: process.env.ENVIRONMENT_NAME ?? null,
    APP_SLUG: process.env.APP_SLUG ?? null,
    GIT_SHA: process.env.GIT_SHA ?? null,
    DATABASE_URL_PRESENT: !!process.env.DATABASE_URL,
    AUTH_HEADER_PRESENCE: authHeaderPresence,
  });
}
