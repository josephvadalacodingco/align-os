import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Template Base',
  description: 'Azure Container Apps template',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
