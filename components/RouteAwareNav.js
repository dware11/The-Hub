'use client';

import { usePathname } from 'next/navigation';

export default function RouteAwareNav({ children }) {
  const pathname = usePathname();
  if (pathname === '/about' || pathname === '/admin' || pathname.startsWith('/admin/')) return null;
  return children;
}
