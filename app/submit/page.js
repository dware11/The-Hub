import { redirect } from 'next/navigation';

export default async function SubmitPage() {
  redirect('/panther-submit?from=legacy-submit');
}
