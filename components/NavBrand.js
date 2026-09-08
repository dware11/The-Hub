'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function NavBrand() {
  return <Link href="/" className="brand" aria-label="C.O.D.E. Engineering Hub home">
    <Image className="brand-crest" src="/code-crest.png" alt="" width={44} height={44} priority />
    <span className="brand-wordmark"><strong>C.O.D.E.</strong><i aria-hidden="true" /><b>Engineering Hub</b></span>
  </Link>;
}
