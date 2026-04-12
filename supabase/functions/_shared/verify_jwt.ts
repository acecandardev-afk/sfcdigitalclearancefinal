/**
 * Validates the caller's access token via GoTrue REST (same path the dashboard uses).
 * More reliable than supabase-js getUser(jwt) on Edge when apikey formats differ (anon JWT vs publishable).
 */
export async function getAuthUserFromRequest(
  supabaseUrl: string,
  accessToken: string,
  apikeyFallback: string,
  incomingApikey: string | null,
): Promise<{ userId: string; error: string | null }> {
  const base = supabaseUrl.replace(/\/$/, "");

  // Some projects use a "publishable" key in the frontend env.
  // GoTrue expects the anon key (legacy JWT-style "eyJ...") in the `apikey` header.
  // If the incoming key doesn't look like a JWT, fall back to the anon key.
  const incoming = (incomingApikey ?? '').trim();
  const looksLikeJwt = incoming.startsWith('eyJ') && incoming.split('.').length >= 3;
  const primaryKey = (looksLikeJwt ? incoming : apikeyFallback).trim();
  const fallbackKey = (apikeyFallback ?? '').trim();

  const call = async (apikey: string) => {
    const res = await fetch(`${base}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const text = await res.text();
    return { res, text };
  };

  let { res, text } = await call(primaryKey);

  // If the primary key fails and it's different from the fallback anon key, retry with fallback.
  if (!res.ok && fallbackKey && primaryKey !== fallbackKey) {
    const retry = await call(fallbackKey);
    // Prefer the retry response if it succeeds, otherwise keep the original (often contains the useful error).
    if (retry.res.ok) {
      res = retry.res;
      text = retry.text;
    }
  }

  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { msg?: string; error_description?: string; message?: string };
      msg = j.msg || j.error_description || j.message || text;
    } catch {
      /* raw text */
    }
    return { userId: "", error: msg || `Auth error (${res.status})` };
  }

  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const user = (json && typeof json === "object" && "user" in json && json.user)
      ? json.user as Record<string, unknown>
      : json;
    const id = user?.id;
    if (typeof id === "string" && id.length > 0) {
      return { userId: id, error: null };
    }
  } catch {
    return { userId: "", error: "Invalid auth response" };
  }
  return { userId: "", error: "User id missing in auth response" };
}
