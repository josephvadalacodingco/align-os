import { NextResponse } from 'next/server';
import { Client } from 'pg';

function getDbConfig() {
  const host = process.env.POSTGRES_HOST;
  const database = process.env.POSTGRES_DB;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;

  const missing = [];
  if (!host) missing.push('POSTGRES_HOST');
  if (!database) missing.push('POSTGRES_DB');
  if (!user) missing.push('POSTGRES_USER');
  if (!password) missing.push('POSTGRES_PASSWORD');

  if (missing.length > 0) {
    return { error: `Missing required env vars: ${missing.join(', ')}` } as const;
  }

  return {
    config: {
      host,
      database,
      user,
      password,
      port: 5432,
      ssl: { rejectUnauthorized: false },
    },
  } as const;
}

export async function GET() {
  const { config, error } = getDbConfig();
  if (error) {
    return NextResponse.json(
      {
        dbOk: false,
        error,
        likelyCauses: [
          'deployStage is not db/full so DB env vars are not wired yet',
          'pipeline did not pass POSTGRES_ADMIN_PASSWORD into Bicep',
          'container app revision does not include latest env vars',
        ],
      },
      { status: 500 }
    );
  }

  let client: Client | null = null;
  try {
    client = new Client(config);
    await client.connect();
    const result = await client.query('SELECT NOW() AS server_time');
    const serverTime = result.rows[0]?.server_time ?? null;
    return NextResponse.json({ dbOk: true, serverTime });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const likelyCauses = [
      'firewall blocked (ensure AllowAllAzureServicesAndResourcesWithinAzureIps is present)',
      'wrong credentials (POSTGRES_USER/POSTGRES_PASSWORD)',
      'server not yet provisioned or not reachable',
      'SSL/TLS configuration mismatch',
    ];
    return NextResponse.json(
      {
        dbOk: false,
        error: message,
        likelyCauses,
      },
      { status: 500 }
    );
  } finally {
    if (client) await client.end();
  }
}

