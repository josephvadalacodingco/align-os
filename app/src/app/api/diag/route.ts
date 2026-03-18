import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET(request: Request) {
  const authHeaders = ['X-MS-CLIENT-PRINCIPAL', 'X-MS-CLIENT-PRINCIPAL-NAME', 'X-MS-CLIENT-PRINCIPAL-ID'];
  const authOk = authHeaders.some((h) => !!request.headers.get(h));

  let dbOk = false;
  if (process.env.DATABASE_URL) {
    let client: Client | null = null;
    try {
      client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
      const result = await client.query('SELECT now() as server_time');
      dbOk = !!result.rows[0]?.server_time;
    } catch {
      dbOk = false;
    } finally {
      if (client) await client.end();
    }
  }

  const appOk = true;
  const helpfulMessages: string[] = [];

  if (!process.env.DATABASE_URL) {
    helpfulMessages.push('DATABASE_URL not set - DB checks skipped');
  } else if (!dbOk) {
    helpfulMessages.push(
      'DB check failed - likely causes: missing DATABASE_URL, firewall blocked, SSL required (sslmode=require)'
    );
  }
  if (!authOk) {
    helpfulMessages.push('Auth headers not present - auth checks skipped (Step 3)');
  }

  return NextResponse.json({
    appOk,
    dbOk: process.env.DATABASE_URL ? dbOk : null,
    authOk: authOk ? true : null,
    helpfulMessages,
  });
}
