'use client';

import dynamic from 'next/dynamic';
import React from 'react';

/**
 * Single entry for the React Router SPA. Optional catch-all matches `/`, `/auth`, `/dashboard/*`, etc.
 * Avoids split routes (`app/page.tsx` vs `app/[...slug]`) that can confuse deployments and deep links.
 */
const SpaApp = dynamic(() => import('../../src/App') as Promise<{ default: () => JSX.Element }>, {
  ssr: false,
});

export default function SpaCatchAllPage() {
  return React.createElement(SpaApp as any);
}
