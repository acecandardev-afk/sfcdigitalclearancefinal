import { supabase } from '@/integrations/supabase/client';
import type { FunctionInvokeOptions } from '@supabase/supabase-js';

/** Same key material as `createClient` — gateways expect `apikey` + `Authorization`. */
function supabasePublicKey(): string {
  const trim = (v: string | undefined) =>
    v == null ? '' : String(v).trim().replace(/^["']|["']$/g, '');
  return trim(import.meta.env.VITE_SUPABASE_ANON_KEY) || trim(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

/**
 * Invokes an Edge Function with a validated, refreshed session JWT.
 * Uses getUser() + refreshSession() because getSession() alone can return an expired or
 * mismatched token (e.g. after switching Supabase projects), which surfaces as "Invalid JWT".
 */
export async function invokeAuthenticatedFunction<T = unknown>(
  functionName: string,
  body: Record<string, unknown>,
  options?: Omit<FunctionInvokeOptions, 'body' | 'headers'>
) {
  const { error: userError } = await supabase.auth.getUser();
  if (userError) {
    const msg = userError.message || '';
    if (msg.toLowerCase().includes('jwt')) {
      try {
        await supabase.auth.signOut();
      } catch {
        /* ignore */
      }
    }
    return {
      data: null,
      error: Object.assign(
        new Error(
          userError.message.includes('JWT') || userError.message.includes('jwt')
            ? 'Session expired or invalid — sign out and sign in again.'
            : userError.message
        ),
        { name: 'AuthSessionError' }
      ),
    } as const;
  }

  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken =
    refreshed.session?.access_token ?? sessionData.session?.access_token;

  if (!accessToken) {
    return {
      data: null,
      error: Object.assign(new Error('Not signed in'), { name: 'AuthSessionError' }),
    } as const;
  }

  if (refreshError) {
    console.warn('refreshSession warning:', refreshError.message);
  }

  const apikey = supabasePublicKey();

  return supabase.functions.invoke<T>(functionName, {
    ...options,
    body,
    headers: {
      ...(apikey ? { apikey } : {}),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
