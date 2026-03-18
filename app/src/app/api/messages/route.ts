import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

type DbConfig =
  | { config: Parameters<typeof Client>[0]; error?: undefined }
  | { config?: undefined; error: string };

const TABLE_NAME = 'messages';

function getDbConfig(): DbConfig {
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
    return { error: `Missing required env vars: ${missing.join(', ')}` };
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
  };
}

function ensureAuthenticated(request: NextRequest): string | null {
  const principalHeader = request.headers.get('x-ms-client-principal');
  if (!principalHeader) return 'Unauthenticated: x-ms-client-principal header missing (configure Container Apps auth for protected APIs).';
  return null;
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const { config, error } = getDbConfig();
  if (error) {
    throw new Error(error);
  }

  const client = new Client(config);
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function GET(request: NextRequest) {
  const authError = ensureAuthenticated(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  try {
    const messages = await withClient(async (client) => {
      const result = await client.query(
        `SELECT id, content, created_at FROM ${TABLE_NAME} ORDER BY created_at DESC, id DESC`
      );
      return result.rows;
    });

    return NextResponse.json({ messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: message,
        hint:
          'Verify Postgres is provisioned (deployStage=db/full), firewall allows Azure, and POSTGRES_* env vars are wired.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authError = ensureAuthenticated(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  let content: string | null = null;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body.content === 'string') {
      content = body.content.trim();
    }
  } catch {
    // fall through – invalid JSON
  }

  if (!content) {
    return NextResponse.json(
      { error: 'content is required in JSON body' },
      { status: 400 }
    );
  }

  try {
    const message = await withClient(async (client) => {
      const result = await client.query(
        `INSERT INTO ${TABLE_NAME} (content) VALUES ($1) RETURNING id, content, created_at`,
        [content]
      );
      return result.rows[0];
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: message,
        hint:
          'Verify Postgres is provisioned (deployStage=db/full), firewall allows Azure, and POSTGRES_* env vars are wired.',
      },
      { status: 500 }
    );
  }
}

