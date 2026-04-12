import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * Maps supabase.functions.invoke failures to actionable messages.
 * "Failed to fetch" usually means the function is not deployed or blocked by the network.
 */
export function edgeFunctionInvokeErrorMessage(err: unknown, functionName: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();

  if (
    raw === 'Failed to fetch' ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return `Edge Function "${functionName}" is not deployed or could not be reached. Deploy it from the project root: npx supabase functions deploy ${functionName}`;
  }

  return raw || 'Request failed';
}

/**
 * When the Edge Function returns 4xx/5xx, the client throws FunctionsHttpError with a generic message.
 * The real reason is usually JSON `{ "error": "..." }` on the Response in `error.context`.
 */
export async function edgeFunctionInvokeErrorDetail(
  err: unknown,
  functionName: string
): Promise<string> {
  if (err instanceof FunctionsHttpError && err.context instanceof Response) {
    const res = err.context;
    try {
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const body = (await res.clone().json()) as Record<string, unknown>;
        if (typeof body?.error === 'string' && body.error.trim()) {
          return body.error.trim();
        }
        if (typeof body?.message === 'string' && body.message.trim()) {
          return body.message.trim();
        }
      } else {
        const text = (await res.clone().text()).trim();
        if (text) return text.slice(0, 500);
      }
    } catch {
      /* fall through */
    }
    return `Request failed (${res.status}${res.statusText ? ` ${res.statusText}` : ''}). Check Edge Function logs in Supabase Dashboard.`;
  }

  return edgeFunctionInvokeErrorMessage(err, functionName);
}
