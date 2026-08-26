import AuthForm from '@/components/auth/AuthForm';

export const metadata = {
  title: 'Sign in — KitabX',
};

/**
 * Screen 02. `?tab=signin` deep-links from the welcome screen's second button.
 * Read on the server so the form is in the HTML on first paint — `useSearchParams`
 * would opt this subtree out of prerendering and ship a blank shell instead.
 */
export default async function LoginPage({ searchParams }) {
  const { tab } = await searchParams;
  return <AuthForm initialTab={tab === 'signin' ? 'signin' : 'signup'} />;
}
