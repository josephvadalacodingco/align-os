'use client';

import { useEffect, useState } from 'react';

type DbCheck = { dbOk: boolean; serverTime?: string };
type DbMessage =
  | { message?: string; id?: number; updated_at?: string }
  | { message: string };

type Message = {
  id: number;
  content: string;
  created_at: string;
};

type MessagesResponse =
  | { messages: Message[] }
  | { error: string; hint?: string };

export default function HomePage() {
  const [dbStatus, setDbStatus] = useState<DbCheck | null>(null);
  const [dbMessage, setDbMessage] = useState<DbMessage | null>(null);

  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [posting, setPosting] = useState(false);

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

  useEffect(() => {
    refreshMessages();
  }, []);

  async function refreshMessages() {
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const res = await fetch('/api/messages');
      const data: MessagesResponse = await res.json();
      if ('messages' in data) {
        setMessages(data.messages);
      } else {
        setMessagesError(data.error);
      }
    } catch (err) {
      setMessagesError(String(err));
    } finally {
      setMessagesLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed) return;

    setPosting(true);
    setMessagesError(null);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessagesError(data.error ?? 'Failed to save message');
      } else {
        setNewMessage('');
        await refreshMessages();
      }
    } catch (err) {
      setMessagesError(String(err));
    } finally {
      setPosting(false);
    }
  }

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

      <section style={{ marginTop: '2rem', maxWidth: 480 }}>
        <h2>Messages (Phase 3 test)</h2>
        <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            New message:
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              style={{ flex: 1, padding: '0.5rem' }}
            />
            <button type="submit" disabled={posting}>
              {posting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>

        <button onClick={refreshMessages} disabled={messagesLoading}>
          {messagesLoading ? 'Refreshing...' : 'Refresh messages'}
        </button>

        {messagesError && (
          <p style={{ color: 'red', marginTop: '0.5rem' }}>{messagesError}</p>
        )}

        <ul style={{ marginTop: '1rem', paddingLeft: '1.2rem' }}>
          {messages.length === 0 && !messagesLoading && (
            <li>No messages yet.</li>
          )}
          {messages.map((m) => (
            <li key={m.id}>
              <strong>{m.content}</strong>{' '}
              <span style={{ color: '#666', fontSize: '0.85rem' }}>
                ({new Date(m.created_at).toLocaleString()})
              </span>
            </li>
          ))}
        </ul>
      </section>

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
          <li>
            <a href="/api/messages">/api/messages</a>
          </li>
        </ul>
      </nav>
    </main>
  );
}
