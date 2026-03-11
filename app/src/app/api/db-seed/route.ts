import { NextResponse } from 'next/server';
import { Client } from 'pg';

const TABLE = 'template_dummy';

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: 'DATABASE_URL not configured' },
      { status: 500 }
    );
  }

  let client: Client | null = null;
  try {
    client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const result = await client.query(
      `SELECT id, message, updated_at FROM ${TABLE} WHERE id = 1`
    );
    const row = result.rows[0] ?? null;
    return NextResponse.json(row ? { id: row.id, message: row.message, updated_at: row.updated_at } : { message: 'No row yet. POST /api/db-seed to seed.' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (client) await client.end();
  }
}

export async function POST() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json(
      { error: 'DATABASE_URL not configured' },
      { status: 500 }
    );
  }

  let client: Client | null = null;
  try {
    client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id int PRIMARY KEY,
        message text,
        updated_at timestamptz DEFAULT now()
      )
    `);
    await client.query(
      `INSERT INTO ${TABLE} (id, message) VALUES (1, 'Hello from DB')
       ON CONFLICT (id) DO UPDATE SET message = EXCLUDED.message, updated_at = now()`
    );
    const result = await client.query(`SELECT id, message, updated_at FROM ${TABLE} WHERE id = 1`);
    const row = result.rows[0];
    return NextResponse.json({ id: row.id, message: row.message, updated_at: row.updated_at });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    if (client) await client.end();
  }
}
