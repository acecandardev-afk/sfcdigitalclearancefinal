import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { SessionProvider, signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';
import { friendlySignInError } from '@/lib/userMessages';
import { ClearanceTypeProvider } from '@/lib/clearanceTypeContext';

type AppUser = {
  id?: string;
  email?: string | null;
  roles?: string[];
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (..._args: unknown[]) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

function AuthBridge({ children }: { children: ReactNode }) {
  const { data, status } = useSession();
  const loading = status === 'loading';

  /** `useSession` can yield a new `data.user` reference each render; stabilize to avoid effect storms downstream. */
  const id = (data?.user as { id?: string } | undefined)?.id;
  const email = data?.user?.email ?? null;
  const rolesRaw = ((data?.user as { roles?: string[] } | undefined)?.roles ?? []) as string[];
  const rolesKey = rolesRaw.join('|');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rolesKey fingerprints rolesRaw; rolesRaw ref can churn from useSession
  const roles = useMemo(() => [...rolesRaw], [rolesKey]);

  const user: AppUser | null = useMemo(() => {
    if (status !== 'authenticated' || !id) return null;
    return { id, email, roles };
  }, [status, id, email, roles]);

  const signIn = useCallback(async (emailArg: string, password: string) => {
    try {
      const res = await nextAuthSignIn('credentials', {
        email: emailArg.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (!res || res.error) {
        return { error: new Error(friendlySignInError(res?.error)) };
      }
      return { error: null };
    } catch {
      return { error: new Error('Unable to sign in. Please try again.') };
    }
  }, []);

  const signOut = useCallback(async () => {
    await nextAuthSignOut({ redirect: false });
  }, []);

  const resetPassword = useCallback(
    async () => ({
      error: new Error('Password reset is not available. Ask your administrator to reset your password.'),
    }),
    []
  );

  const value = useMemo(
    () => ({ user, loading, signIn, signOut, resetPassword }),
    [user, loading, signIn, signOut, resetPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProviderWithBridge({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthBridge>
        <ClearanceTypeProvider>{children}</ClearanceTypeProvider>
      </AuthBridge>
    </AuthProvider>
  );
}
