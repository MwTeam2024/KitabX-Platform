'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import OtpInput from './OtpInput';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import { authService } from '@/services/auth.service';

const RESEND_SECONDS = 28;

/**
 * Screen 03 — login OTP. NestJS is the verification authority (§19); a valid
 * response here only updates the client's session snapshot.
 */
export default function OtpVerifyForm({ mobile }) {
  const router = useRouter();
  const showToast = useToast();
  const { signupDraft, setSession } = useAuth();
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const verify = async () => {
    if (code.length < 6) return showToast('Enter the full 6-digit code');
    setVerifying(true);
    try {
      // Only matters for a brand-new phone — the backend ignores these
      // fields for an existing member (see auth.service.js findOrCreateUser).
      const { user } = await authService.verifyOtp(mobile, code, {
        firstName: signupDraft.firstName,
        lastName: signupDraft.lastName,
        societyId: signupDraft.societyId || undefined,
        blockId: signupDraft.blockId || undefined,
        flatUnit: signupDraft.flatUnit || undefined,
        acceptedTerms: signupDraft.acceptedTerms,
        // Set only when this signup started from the merged field with an
        // email typed in (Task 33/38) — verified in its own step already.
        emailVerificationToken: signupDraft.emailVerificationToken || undefined,
      });
      setSession(user);
      router.push('/home');
    } catch (err) {
      showToast(err.message || 'Incorrect code');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    try {
      await authService.requestOtp(mobile);
      setSeconds(RESEND_SECONDS);
      showToast(`OTP resent to ${mobile}`);
    } catch (err) {
      showToast(err.message || 'Could not resend the code');
    }
  };

  return (
    <>
      <ScreenHeader back backHref="/login">
        <div style={{ marginTop: 14 }}>
          <div style={{ color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700 }}>
            Verify your number
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 2 }}>Code sent to {mobile}</div>
        </div>
      </ScreenHeader>

      <div className="app-scroll pad-nav" style={{ padding: '20px 16px' }}>
        <OtpInput value={code} onChange={setCode} />
        <button className="link-green" style={{ marginBottom: 20 }} onClick={resend} disabled={seconds > 0}>
          {seconds > 0 ? `Resend code in 0:${String(seconds).padStart(2, '0')}` : 'Resend code'}
        </button>
        <button className="btn btn-primary" onClick={verify} disabled={verifying || code.length < 6}>
          <span className="icb"><Icon name="check" style={{ width: 13, height: 13 }} /></span>
          {verifying ? 'Verifying…' : 'Verify & continue'}
        </button>
      </div>
    </>
  );
}
