import { createContext, useContext, type ReactNode } from 'react';
import { SessionProvider, signIn as nextAuthSignIn, signOut as nextAuthSignOut, useSession } from 'next-auth/react';

type AppUser = {
  id?: string;
  email?: string | null;
  roles?: string[];
};

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  signUp: (..._args: unknown[]) => Promise<{ error: Error | null }>;
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
    const res = await nextAuthSignIn('credentials', {
      email,
      password,
      redirect: false,
    });
    if (!res || res.error) {
      return { error: new Error(res?.error || 'Sign in failed') };
    }
    return { error: null };
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
        signUp: async () => ({ error: new Error('Sign up is disabled. Ask the admin to create your account.') }),
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
