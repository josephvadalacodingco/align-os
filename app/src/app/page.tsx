'use client';

import { useEffect, useState } from 'react';

type DbCheck = { dbOk: boolean; serverTime?: string };
type DbMessage = { message?: string; id?: number; updated_at?: string } | { message: string };

export default function HomePage() {
  const [dbStatus, setDbStatus] = useState<DbCheck | null>(null);
  const [dbMessage, setDbMessage] = useState<DbMessage | null>(null);

  useEffect(() => {
    fetch('/api/db-check')
      .then((res) => res.json())
      .then(setDbStatus)
      .catch(() => setDbStatus({ dbOk: false }));
  }, []);

  useEffect(() => {
    fetch('/api/db-seed')
      .then((res) => res.json())
      .then(setDbMessage)
      .catch(() => setDbMessage(null));
  }, []);

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Hello World</h1>
      {dbStatus !== null && (
        <p>
          <strong>DB:</strong>{' '}
          {dbStatus.dbOk ? (
            <>OK {dbStatus.serverTime != null && `(${dbStatus.serverTime})`}</>
          ) : (
            <span style={{ color: 'red' }}>Not connected</span>
          )}
        </p>
      )}
      {dbMessage != null && 'message' in dbMessage && dbMessage.message && (
        <p>
          <strong>From DB:</strong> {dbMessage.message}
        </p>
      )}
      <nav style={{ marginTop: '2rem' }}>
        <h2>Links</h2>
        <ul>
          <li>
            <a href="/diagnostics">/diagnostics</a>
          </li>
          <li>
            <a href="/api/health">/api/health</a>
          </li>
          <li>
            <a href="/api/env-check">/api/env-check</a>
          </li>
          <li>
            <a href="/api/diag">/api/diag</a>
          </li>
          <li>
            <a href="/api/db-check">/api/db-check</a>
          </li>
          <li>
            <a href="/api/db-seed">/api/db-seed</a>
          </li>
        </ul>
      </nav>
    </main>
  );
}
