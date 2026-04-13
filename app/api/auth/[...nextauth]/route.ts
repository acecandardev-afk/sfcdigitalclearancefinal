import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db';

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
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
          const email = credentials?.email?.trim().toLowerCase();
          const password = credentials?.password ?? '';
          if (!email || !password) return null;

          const user = await prisma.user.findUnique({
            where: { email },
            include: { roles: true, profile: true },
          });
          if (!user) return null;

          const ok = await bcrypt.compare(password, user.passwordHash);
          if (!ok) return null;

          return {
            id: user.id,
            email: user.email,
            name: user.profile?.fullName ?? user.email,
          };
        } catch (e) {
          console.error('[auth] authorize failed');
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
  },
});

export { handler as GET, handler as POST };
