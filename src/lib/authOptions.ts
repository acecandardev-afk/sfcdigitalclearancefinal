import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db';
import { ensureDeploymentEnv } from '@/lib/resolveDeploymentUrl';

ensureDeploymentEnv();

/**
 * Single source of truth for NextAuth. Pass to `getServerSession(authOptions)` (via `getAppSession`)
 * so API routes decode JWTs with the same callbacks and `roles` on `session.user`.
 */
/** NextAuth expects `NEXTAUTH_SECRET`; `AUTH_SECRET` is accepted as an alias (same purpose: sign/encrypt JWT sessions). */
const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

export const authOptions: NextAuthOptions = {
  secret: authSecret,
  session: { strategy: 'jwt' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        try {
          const rawLogin = credentials?.email?.trim() ?? '';
          const password = credentials?.password ?? '';
          if (!rawLogin || !password) return null;

          const emailKey = rawLogin.toLowerCase();

          let user = await prisma.user.findUnique({
            where: { email: emailKey },
            include: { roles: true, profile: true, signatory: true },
          });

          // Students often sign in with school-issued ID (profile.studentId), not email.
          if (!user) {
            const profile = await prisma.profile.findFirst({
              where: {
                studentId: { equals: rawLogin, mode: 'insensitive' },
              },
              select: { id: true },
            });
            if (profile) {
              user = await prisma.user.findUnique({
                where: { id: profile.id },
                include: { roles: true, profile: true, signatory: true },
              });
            }
          }

          if (!user) return null;

          if (user.profile?.isArchived) return null;
          if (user.signatory?.isArchived) return null;

          const ok = await bcrypt.compare(password, user.passwordHash);
          if (!ok) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.profile?.fullName ?? user.email,
          };
        } catch (e) {
          console.error('[auth] authorize failed', e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      if (!token.sub) return token;
      const roles = await prisma.userRole.findMany({ where: { userId: token.sub } });
      (token as any).roles = roles.map((r) => r.role);
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).roles = (token as any).roles ?? [];
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth',
    error: '/auth',
  },
};
