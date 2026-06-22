import { createHmac, timingSafeEqual } from 'crypto';

const PREFIX = 'scv1';

function secret(): string {
  const value = process.env.CLEARANCE_VERIFY_SECRET || process.env.NEXTAUTH_SECRET;
  if (value?.trim()) return value.trim();
  if (process.env.NODE_ENV !== 'production') return 'dev-only-clearance-verify';
  throw new Error('CLEARANCE_VERIFY_SECRET or NEXTAUTH_SECRET is required in production.');
}

export function buildStudentClearanceVerifyToken(clearanceRequestId: string, studentId: string): string {
  const exp = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  const payload = `${PREFIX}.${clearanceRequestId}.${studentId}.${exp}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function parseStudentClearanceVerifyToken(token: string): { clearanceRequestId: string; studentId: string } | null {
  const parts = token.split('.');
  if (parts.length < 5) return null;
  if (parts[0] !== 'scv1') return null;
  const clearanceRequestId = parts[1];
  const studentId = parts[2];
  const expStr = parts[3];
  const sig = parts.slice(4).join('.');
  const exp = Number(expStr);
  if (!clearanceRequestId || !studentId || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  const payload = `${PREFIX}.${clearanceRequestId}.${studentId}.${expStr}`;
  const expected = createHmac('sha256', secret()).update(payload).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  return { clearanceRequestId, studentId };
}
