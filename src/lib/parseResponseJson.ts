/**
 * Parse fetch `Response` JSON without throwing on empty or invalid bodies
 * (avoids "Unexpected end of JSON input" from `response.json()` on empty replies).
 */
export async function parseResponseJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return {} as T;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    return {} as T;
  }
}
