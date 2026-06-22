function httpsVercelHost(): string | undefined {
  const raw = process.env.VERCEL_URL?.trim();
  if (!raw) return undefined;
  const host = raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
  return host ? `https://${host}` : undefined;
}

/** Set NEXTAUTH_URL from VERCEL_URL when unset (preview + production). Server-only. */
export function ensureDeploymentEnv(): void {
  const vercelBase = httpsVercelHost();
  if (!vercelBase) return;
  if (!process.env.NEXTAUTH_URL?.trim()) {
    process.env.NEXTAUTH_URL = vercelBase;
  }
}

/** Public base URL for links and upload responses. Safe on server routes. */
export function publicAppBaseUrl(fallbackFromRequest?: string): string | undefined {
  const fromPublic = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (fromPublic) return fromPublic;

  const fromAuth = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, '');
  if (fromAuth) return fromAuth;

  const fromVercel = httpsVercelHost();
  if (fromVercel) return fromVercel;

  return fallbackFromRequest;
}
