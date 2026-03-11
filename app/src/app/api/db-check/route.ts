import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      {
        dbOk: false,
        error: 'DATABASE_URL not configured',
        likelyCauses: [
          'missing DATABASE_URL',
          'env var not injected by infra (Step 2)',
        ],
      },
      { status: 500 }
    );
  }

  let client: Client | null = null;
  try {
    client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const result = await client.query('SELECT now() as server_time');
    const serverTime = result.rows[0]?.server_time ?? null;
    return NextResponse.json({ dbOk: true, serverTime });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const likelyCauses = [
      'missing or invalid DATABASE_URL',
      'firewall blocked (allow Azure / your IP)',
      'SSL/TLS required (use ?sslmode=require in URL)',
      'wrong credentials or server unreachable',
    ];
    return NextResponse.json(
      { dbOk: false, error: message, likelyCauses },
      { status: 500 }
    );
  } finally {
    if (client) await client.end();
  }
}
