'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { MAJORS } from '../lib/sampleData';

export default function MajorFilter({ current }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(e) {
    const params = new URLSearchParams(searchParams.toString());
    if (e.target.value === 'All majors') params.delete('major');
    else params.set('major', e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={current || 'All majors'}
      onChange={onChange}
      className="font-mono text-xs border border-line rounded-md px-3 py-2 bg-white text-ink"
      aria-label="Filter by major"
    >
      {MAJORS.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}
