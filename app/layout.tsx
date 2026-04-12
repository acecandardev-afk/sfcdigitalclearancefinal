import type { ReactNode } from 'react';
import '@/index.css';

export const metadata = {
  title: 'SFC-G Digital Clearance System',
  description: 'Digital Clearance System',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
