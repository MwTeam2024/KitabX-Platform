import HandoverVerify from '@/components/exchange/HandoverVerify';

export const metadata = { title: 'Verify handover — KitabX' };

/** Screen 16 — one-time exchange OTP (§13). Separate from the login OTP. */
export default async function HandoverPage({ params }) {
  const { id } = await params;
  return <HandoverVerify exchangeId={id} />;
}
