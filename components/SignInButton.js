import Link from 'next/link';

export default function SignInButton({ className, next = '/submit' }) {
  return <Link href={`/auth/signin?next=${encodeURIComponent(next)}`} className={className || 'flex items-center gap-2 bg-purple-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-purple-700'}>Sign in with email</Link>;
}
