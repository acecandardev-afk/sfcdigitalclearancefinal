'use client';

import dynamic from 'next/dynamic';
import React from 'react';

const SpaApp = dynamic(() => import('../src/App') as Promise<{ default: () => JSX.Element }>, {
  ssr: false,
});

export default function Page() {
  return React.createElement(SpaApp as any);
}
