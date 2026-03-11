'use client';

import { useEffect, useState } from 'react';

type DiagResult = {
  appOk: boolean;
  dbOk: boolean | null;
  authOk: boolean | null;
  helpfulMessages: string[];
};

export default function DiagnosticsPage() {
  const [result, setResult] = useState<DiagResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/diag')
      .then((res) => res.json())
      .then(setResult)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading diagnostics...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!result) return <p>No data</p>;

  const status = (ok: boolean | null) => {
    if (ok === null) return <span style={{ color: 'gray' }}>Skipped</span>;
    return ok ? (
      <span style={{ color: 'green' }}>OK</span>
    ) : (
      <span style={{ color: 'red' }}>Fail</span>
    );
  };

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Diagnostics</h1>
      <ul>
        <li>
          <strong>Health:</strong> {status(result.appOk)}
        </li>
        <li>
          <strong>DB:</strong> {status(result.dbOk)}
        </li>
        <li>
          <strong>Auth:</strong> {status(result.authOk)}
        </li>
      </ul>
      {result.helpfulMessages.length > 0 && (
        <section>
          <h2>Messages</h2>
          <ul>
            {result.helpfulMessages.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </section>
      )}
      <nav style={{ marginTop: '2rem' }}>
        <h2>API links</h2>
        <ul>
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
