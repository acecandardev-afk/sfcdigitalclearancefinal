import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Build / deploy metadata for ops (set BUILD_ID or VERCEL_GIT_COMMIT_SHA in CI). */
export async function GET() {
  const build =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.BUILD_ID ||
    process.env.npm_package_version ||
    'dev';
  return NextResponse.json({
    name: 'digital-clearance',
    build: String(build).slice(0, 40),
    node: process.version,
    ts: new Date().toISOString(),
  });
}
