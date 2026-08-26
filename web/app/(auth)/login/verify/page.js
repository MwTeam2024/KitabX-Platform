import OtpVerifyForm from '@/components/auth/OtpVerifyForm';

export const metadata = {
  title: 'Verify your number — KitabX',
};

/** Screen 03 — OTP verification. */
export default async function VerifyPage({ searchParams }) {
  const { mobile } = await searchParams;
  return <OtpVerifyForm mobile={mobile || '+91 98765 43210'} />;
}
