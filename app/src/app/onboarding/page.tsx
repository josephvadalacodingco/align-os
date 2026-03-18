'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type EndeavorDraft = {
  name: string;
  priorityRank: number;
  baselineHours?: number;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [endeavors, setEndeavors] = useState<EndeavorDraft[]>([
    { name: '', priorityRank: 1 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // Save endeavors
      const cleaned = endeavors
        .map((e, index) => ({
          ...e,
          priorityRank: index + 1,
        }))
        .filter((e) => e.name.trim().length > 0);

      for (const e of cleaned) {
        await fetch('/api/endeavors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(e),
        });
      }
      router.push('/app');
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Failed to save onboarding data'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <header className="app-header">
          <div>
            <div className="badge-subtle">AlignOS • First-time setup</div>
            <h1 className="app-title">Let&apos;s map your Endeavors.</h1>
          </div>
        </header>

        {step === 1 && (
          <section className="card">
            <div className="card-header">
              <h2 className="card-title">Endeavors (identity-driven work)</h2>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#d1d5db', marginBottom: '0.75rem' }}>
              Add the top directions you care about over the next few years.
              We&apos;ll use this to prioritize work and keep your identity visible.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {endeavors.map((e, index) => (
                <div
                  key={index}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2rem 1fr 110px',
                    gap: '0.5rem',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: '#9ca3af',
                    }}
                  >
                    #{index + 1}
                  </span>
                  <input
                    type="text"
                    placeholder="e.g. Music Career, App Development"
                    value={e.name}
                    onChange={(ev) => {
                      const next = [...endeavors];
                      next[index] = { ...next[index], name: ev.target.value };
                      setEndeavors(next);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(55,65,81,0.9)',
                      background: 'rgba(15,23,42,0.9)',
                      color: '#e5e7eb',
                      fontSize: '0.85rem',
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="hrs / week"
                    value={e.baselineHours ?? ''}
                    onChange={(ev) => {
                      const value = ev.target.value;
                      const hours = value === '' ? undefined : Number(value);
                      const next = [...endeavors];
                      next[index] = { ...next[index], baselineHours: hours };
                      setEndeavors(next);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid rgba(55,65,81,0.9)',
                      background: 'rgba(15,23,42,0.9)',
                      color: '#e5e7eb',
                      fontSize: '0.8rem',
                    }}
                  />
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '0.75rem',
                alignItems: 'center',
              }}
            >
              <button
                type="button"
                onClick={() =>
                  setEndeavors((prev) => [
                    ...prev,
                    { name: '', priorityRank: prev.length + 1 },
                  ])
                }
                style={{
                  borderRadius: '999px',
                  border: '1px dashed rgba(148,163,184,0.7)',
                  background: 'transparent',
                  padding: '0.3rem 0.8rem',
                  fontSize: '0.8rem',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                + Add Endeavor
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                style={{
                  borderRadius: '999px',
                  border: '1px solid rgba(148,163,184,0.9)',
                  background:
                    'linear-gradient(135deg, rgba(56,189,248,0.95), rgba(37,99,235,0.95))',
                  padding: '0.4rem 1rem',
                  fontSize: '0.85rem',
                  color: '#0b1120',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {saving ? 'Saving…' : 'Start planning'}
              </button>
            </div>
            {error && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#f97316' }}>
                {error}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

