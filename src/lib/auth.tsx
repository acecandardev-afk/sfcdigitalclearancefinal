import { createContext, useContext, type ReactNode } from 'react';
import { SessionProvider, signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';
import { friendlySignInError } from '@/lib/userMessages';

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
  const user: AppUser | null = data?.user
    ? {
        id: (data.user as any).id,
        email: data.user.email,
        roles: (data.user as any).roles ?? [],
      }
    : null;

  const signIn = async (email: string, password: string) => {
    try {
      const res = await nextAuthSignIn('credentials', {
        email: email.trim().toLowerCase(),
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
  };

  const signOut = async () => {
    await nextAuthSignOut({ redirect: false });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signOut,
        resetPassword: async () => ({ error: new Error('Password reset is not implemented yet.') }),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
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
      <AuthBridge>{children}</AuthBridge>
    </AuthProvider>
  );
}
