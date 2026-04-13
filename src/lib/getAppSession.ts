import { getServerSession } from 'next-auth/next';
import { authOptions } from './authOptions';

/** Server-side session with `user.roles` populated — use in App Router API routes. */
export function getAppSession() {
  return getServerSession(authOptions);
}
