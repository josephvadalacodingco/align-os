import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="app-shell">
      <main className="app-main">
        <header className="app-header">
          <div>
            <div className="badge-subtle">AlignOS</div>
            <h1 className="app-title">
              A weekly decision engine for a sane, goal-aligned life.
            </h1>
          </div>
          <Link
            href="/app"
            style={{
              borderRadius: '999px',
              padding: '0.5rem 1rem',
              border: '1px solid rgba(148,163,184,0.7)',
              background:
                'radial-gradient(circle at top left, #38bdf8 0, #0f172a 55%)',
              color: '#0b1120',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            Open Decision Board
          </Link>
        </header>

        <section className="card">
          <div className="card-header">
            <h2 className="card-title">Why this exists</h2>
          </div>
          <p style={{ fontSize: '0.9rem', color: '#d1d5db', maxWidth: 640 }}>
            AlignOS is not a generic task list. It is a weekly decision engine
            built around endeavors, life maintenance, and the hard constraints
            of real life — so you can see, at a glance, what truly matters this
            week and why.
          </p>
        </section>
      </main>
    </div>
  );
}
