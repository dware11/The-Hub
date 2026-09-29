'use client';

import { usePathname } from 'next/navigation';
import ReportIssueForm from './ReportIssueForm';

export default function SiteFooter() {
  const pathname = usePathname();
  const isContentDetail = /^\/(events|opportunities)\/[^/]+\/?$/.test(pathname);
  return <footer className="site-support-footer"><span>C.O.D.E. Engineering Hub</span>{!isContentDetail && <ReportIssueForm />}</footer>;
}
