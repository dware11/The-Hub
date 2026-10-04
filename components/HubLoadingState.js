import Image from 'next/image';

export default function HubLoadingState({ message = 'Loading the Hub…' }) {
  return <section className="hub-loading-state" role="status" aria-live="polite">
    <Image src="/code-crest.png" alt="" width={54} height={54} priority />
    <div>
      <strong>C.O.D.E. Engineering Hub</strong>
      <span>{message}</span>
    </div>
  </section>;
}
