import NextAuth from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { ensureDeploymentEnv } from '@/lib/resolveDeploymentUrl';

ensureDeploymentEnv();

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
