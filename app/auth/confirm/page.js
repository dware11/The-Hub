import AuthConfirmation from '../../../components/AuthConfirmation';

export const metadata = { title: 'Confirm Sign In' };

export default async function AuthConfirmPage({ searchParams }) {
  const params = await searchParams;

  return (
    <div className="auth-confirm-page">
      <AuthConfirmation
        tokenHash={typeof params?.token_hash === 'string' ? params.token_hash : ''}
        type={typeof params?.type === 'string' ? params.type : 'email'}
        next={typeof params?.next === 'string' ? params.next : ''}
      />
    </div>
  );
}
