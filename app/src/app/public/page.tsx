export default function PublicPage() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Public content</h1>
      <p>This page is publicly accessible. (Auth protected in Step 3.)</p>
      <p>
        <a href="/app">Go to /app</a>
      </p>
    </main>
  );
}
