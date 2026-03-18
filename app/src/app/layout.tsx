import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AlignOS',
  description: 'Goal-aligned weekly decision engine',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="app-nav">
            <div className="app-nav-left">
              <a href="/app" className="app-nav-logo">
                AlignOS
              </a>
              <nav className="app-nav-links">
                <a href="/app">Decision Board</a>
                <a href="/app#calendar">Calendar</a>
                <a href="/onboarding">Onboarding</a>
              </nav>
            </div>
            <div className="app-nav-right">
              <a href="/settings" className="app-nav-pill">
                Settings
              </a>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
