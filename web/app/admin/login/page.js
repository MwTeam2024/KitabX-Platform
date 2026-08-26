'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OtpInput from '@/components/auth/OtpInput';
import SocialSignInButtons from '@/components/auth/SocialSignInButtons';
import { useToast } from '@/components/ui/ToastProvider';
import { adminService } from '@/services/admin.service';

const RESEND_SECONDS = 30;

/** Admin console login — phone or email OTP, verified by NestJS (§21/§13). */
export default function AdminLoginPage() {
  const router = useRouter();
  const showToast = useToast();
  const [method, setMethod] = useState('phone'); // 'phone' | 'email'
  const [step, setStep] = useState('enter'); // 'enter' | 'otp'
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const identifier = method === 'phone' ? phone : email;

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const requestOtp = (value) => (method === 'phone' ? adminService.requestOtp(value) : adminService.requestEmailOtp(value));

  const sendCode = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      return setError(method === 'phone' ? 'Enter the admin phone number.' : 'Enter the admin email address.');
    }
    setError('');
    setLoading(true);
    try {
      await requestOtp(identifier.trim());
      setStep('otp');
      setSeconds(RESEND_SECONDS);
    } catch (err) {
      setError(err.message || 'Could not send a code');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await requestOtp(identifier.trim());
      setSeconds(RESEND_SECONDS);
      showToast('OTP resent');
    } catch (err) {
      showToast(err.message || 'Could not resend the code');
    }
  };

  const verify = async (e) => {
    e.preventDefault();
    if (code.length < 6) return setError('Enter the full 6-digit code');
    setError('');
    setLoading(true);
    try {
      const { admin } = method === 'phone'
        ? await adminService.verifyOtp(identifier.trim(), code)
        : await adminService.verifyEmailOtp(identifier.trim(), code);
      showToast(`Logged in as ${admin.name || admin.phone}`);
      router.push('/admin');
    } catch (err) {
      setError(err.message || 'Incorrect code');
    } finally {
      setLoading(false);
    }
  };

  const switchMethod = () => {
    setMethod((m) => (m === 'phone' ? 'email' : 'phone'));
    setStep('enter');
    setCode('');
    setError('');
  };

  const [socialBusy, setSocialBusy] = useState(false);
  const handleSocialToken = async (provider, idToken) => {
    setSocialBusy(true);
    setError('');
    try {
      const { admin } = provider === 'google' ? await adminService.googleLogin(idToken) : await adminService.appleLogin(idToken);
      showToast(`Logged in as ${admin.name || admin.phone}`);
      router.push('/admin');
    } catch (err) {
      setError(err.message || 'Could not sign you in');
    } finally {
      setSocialBusy(false);
    }
  };
  const handleSocialError = (err) => setError(err.message || 'Could not start sign-in');

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <form
        className="card"
        style={{ maxWidth: 340, width: '100%', padding: '32px 28px', textAlign: 'center' }}
        onSubmit={step === 'enter' ? sendCode : verify}
      >
        <div className="logo-badge" style={{ margin: '0 auto 18px' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>
          Admin Console Login
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 20 }}>
          Authorized personnel only
        </div>

        {step === 'enter' ? (
          <div className="field" style={{ textAlign: 'left' }}>
            <label htmlFor="admin-identifier">{method === 'phone' ? 'Admin phone number' : 'Admin email address'}</label>
            <input
              id="admin-identifier"
              type={method === 'phone' ? 'tel' : 'email'}
              autoComplete={method === 'phone' ? 'tel' : 'email'}
              placeholder={method === 'phone' ? '+91 98765 43210' : 'admin@example.com'}
              value={identifier}
              onChange={(e) => (method === 'phone' ? setPhone(e.target.value) : setEmail(e.target.value))}
            />
          </div>
        ) : (
          <div style={{ textAlign: 'left', marginBottom: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Code sent to {identifier}</div>
            <OtpInput value={code} onChange={setCode} />
            <button
              type="button" className="link-green" style={{ margin: '10px 0 4px' }}
              onClick={resend} disabled={seconds > 0}
            >
              {seconds > 0 ? `Resend code in 0:${String(seconds).padStart(2, '0')}` : 'Resend code'}
            </button>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--sindoor)', fontSize: 11.5, margin: '10px 0 12px', textAlign: 'left' }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 12 }}>
          {loading ? 'Please wait…' : step === 'enter' ? 'Send OTP' : 'Verify & Log In'}
        </button>
        {step === 'enter' && (
          <>
            <button type="button" className="link-green" style={{ marginTop: 10 }} onClick={switchMethod}>
              {method === 'phone' ? 'Or continue with email' : 'Or continue with phone number'}
            </button>
            <SocialSignInButtons onToken={handleSocialToken} onError={handleSocialError} busy={socialBusy} />
          </>
        )}
        {step === 'otp' && (
          <button className="btn btn-outline" style={{ marginTop: 8 }} type="button" onClick={() => { setStep('enter'); setCode(''); setError(''); }}>
            {method === 'phone' ? 'Use a different number' : 'Use a different email'}
          </button>
        )}
        <button className="btn btn-outline" style={{ marginTop: 8 }} type="button" onClick={() => router.push('/home')}>
          Back to app
        </button>
      </form>
    </div>
  );
}
