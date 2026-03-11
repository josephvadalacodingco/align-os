import { headers } from 'next/headers';

type ClientPrincipalClaim = {
  typ: string;
  val: string;
};

type ClientPrincipal = {
  identityProvider?: string;
  userId?: string;
  userDetails?: string;
  claims?: ClientPrincipalClaim[];
};

function getClientPrincipal(): ClientPrincipal | null {
  const hdrs = headers();
  const encoded = hdrs.get('x-ms-client-principal');
  if (!encoded) return null;
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    return JSON.parse(json) as ClientPrincipal;
  } catch {
    return null;
  }
}

export default function AppPage() {
  const principal = getClientPrincipal();
  const claims = principal?.claims ?? [];
  const name =
    claims.find((c) => c.typ === 'name')?.val ??
    claims.find(
      (c) =>
        c.typ === 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'
    )?.val ??
    principal?.userDetails ??
    null;
  const email =
    claims.find(
      (c) =>
        c.typ ===
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
    )?.val ?? null;
  const displayName = email ?? name ?? 'Unknown user';

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>App</h1>
      {principal ? (
        <>
          <p>
            <strong>Signed in as:</strong> {displayName}
          </p>
          {email && (
            <p>
              <strong>Email:</strong> {email}
            </p>
          )}
          {principal.identityProvider && (
            <p>
              <strong>Identity provider:</strong> {principal.identityProvider}
            </p>
          )}
        </>
      ) : (
        <p>Not authenticated (platform auth not configured or headers missing).</p>
      )}
      <p style={{ marginTop: '1rem' }}>
        This page is intended to be protected by Azure Container Apps built-in
        authentication in Step 3. When configured, access should require
        signing in via Microsoft Entra External ID (email/password + Google).
      </p>
    </main>
  );
}
