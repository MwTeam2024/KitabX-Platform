'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import SegTabs from '@/components/ui/SegTabs';
import NoteBox from '@/components/ui/NoteBox';
import ScreenHeader from '@/components/ui/ScreenHeader';
import SocietyFields from '@/components/onboarding/SocietyFields';
import SocialSignInButtons from './SocialSignInButtons';
import OtpInput from './OtpInput';
import TermsGate from './TermsGate';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import { authService } from '@/services/auth.service';

const RESEND_SECONDS = 30;

const HEADINGS = {
  signup: { title: 'Join your society', sub: 'Read. Exchange. Repeat.' },
  signin: { title: 'Welcome back!', sub: 'Glad to see you again.' },
};

const isEmailInput = (value) => value.includes('@');

/**
 * Screen 02 — mobile/email OTP entry point (§5, §13, Task 33/38). NestJS
 * generates and verifies every OTP itself and owns the session, so nothing
 * here is treated as authorization.
 *
 * The "Phone Number / Email Address" field on both tabs auto-detects which
 * channel to use from what's typed — no separate phone/email toggle, per
 * Task 38's merged-field design, built now since Task 33 (email-first
 * signup) needs the same detection logic anyway.
 */
export default function AuthForm({ initialTab = 'signup' }) {
  const router = useRouter();
  const showToast = useToast();
  const { signupDraft, updateSignupDraft, setSession } = useAuth();

  const [tab, setTab] = useState(initialTab);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    firstName: signupDraft.firstName || '',
    lastName: signupDraft.lastName || '',
    mobile: signupDraft.mobile || '',
    societyId: signupDraft.societyId || '',
    blockId: signupDraft.blockId || '',
    flatUnit: signupDraft.flatUnit || '',
    address: signupDraft.address || '',
    cityText: signupDraft.cityText,
    locationRequest: signupDraft.locationRequest || null,
  });
  const [accepted, setAccepted] = useState(signupDraft.acceptedTerms);

  // Email-first signup (Task 33): the merged field detected an email, so the
  // account can't be created yet (phone is still required) — verify the
  // email first, then collect+verify a phone before finishing signup.
  const [signupStep, setSignupStep] = useState('form'); // 'form' | 'verify-email' | 'need-phone'
  const [signupEmail, setSignupEmail] = useState('');
  const [signupEmailCode, setSignupEmailCode] = useState('');
  const [signupEmailBusy, setSignupEmailBusy] = useState(false);
  const [signupEmailSeconds, setSignupEmailSeconds] = useState(0);
  const [signupPhone, setSignupPhone] = useState('');

  // Sign-in: one merged field, channel detected from what was typed.
  const [signinIdentifier, setSigninIdentifier] = useState('');
  const [signinChannel, setSigninChannel] = useState(null); // 'phone' | 'email', set once a code is sent
  const [signinStep, setSigninStep] = useState('enter'); // 'enter' | 'otp'
  const [signinCode, setSigninCode] = useState('');
  const [signinBusy, setSigninBusy] = useState(false);
  const [signinSeconds, setSigninSeconds] = useState(0);

  useEffect(() => {
    if (signupEmailSeconds <= 0) return;
    const timer = setTimeout(() => setSignupEmailSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [signupEmailSeconds]);

  useEffect(() => {
    if (signinSeconds <= 0) return;
    const timer = setTimeout(() => setSigninSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [signinSeconds]);

  const patch = (updates) => setForm((f) => ({ ...f, ...updates }));

  const sendPhoneSignupOtp = async (phone) => {
    updateSignupDraft({ ...form, mobile: phone, acceptedTerms: accepted });
    await authService.requestOtp(phone);
    router.push(`/login/verify?mobile=${encodeURIComponent(phone)}`);
  };

  const submitSignupForm = async () => {
    if (!form.mobile.trim()) return showToast('Enter your mobile number or email address');
    if (!form.societyId && !(form.locationRequest?.cityName?.trim() && form.locationRequest?.societyName?.trim())) {
      return showToast('Select your society, or enter one to request');
    }
    setSending(true);
    try {
      if (isEmailInput(form.mobile.trim())) {
        const email = form.mobile.trim();
        await authService.requestSignupEmailOtp(email);
        setSignupEmail(email);
        setSignupStep('verify-email');
        setSignupEmailSeconds(RESEND_SECONDS);
      } else {
        await sendPhoneSignupOtp(form.mobile.trim());
      }
    } catch (err) {
      showToast(err.message || 'Could not send the code — try again');
    } finally {
      setSending(false);
    }
  };

  const resendSignupEmailOtp = async () => {
    try {
      const result = await authService.requestSignupEmailOtp(signupEmail);
      setSignupEmailSeconds(RESEND_SECONDS);
      // In dev mode the code's own toast (api-client.js) already confirms
      // a fresh one was sent — a second toast right behind it would just
      // overwrite that code before it's readable.
      if (!result?.devCode) showToast('OTP resent');
    } catch (err) {
      showToast(err.message || 'Could not resend the code');
    }
  };

  const verifySignupEmail = async () => {
    if (signupEmailCode.length < 6) return showToast('Enter the full 6-digit code');
    setSignupEmailBusy(true);
    try {
      const { emailVerificationToken } = await authService.verifySignupEmailOtp(signupEmail, signupEmailCode);
      updateSignupDraft({ ...form, email: signupEmail, emailVerificationToken, acceptedTerms: accepted });
      setSignupStep('need-phone');
    } catch (err) {
      showToast(err.message || 'Incorrect code');
    } finally {
      setSignupEmailBusy(false);
    }
  };

  const submitSignupPhone = async () => {
    if (!signupPhone.trim()) return showToast('Enter your mobile number');
    setSending(true);
    try {
      await sendPhoneSignupOtp(signupPhone.trim());
    } catch (err) {
      showToast(err.message || 'Could not send the code — try again');
    } finally {
      setSending(false);
    }
  };

  const sendSigninOtp = async () => {
    if (!signinIdentifier.trim()) return showToast('Enter your mobile number or email address');
    setSigninBusy(true);
    try {
      const identifier = signinIdentifier.trim();
      if (isEmailInput(identifier)) {
        await authService.requestEmailOtp(identifier);
        setSigninChannel('email');
      } else {
        await authService.requestOtp(identifier);
        setSigninChannel('phone');
      }
      setSigninStep('otp');
      setSigninSeconds(RESEND_SECONDS);
    } catch (err) {
      showToast(err.message || 'Could not send the code');
    } finally {
      setSigninBusy(false);
    }
  };

  const resendSigninOtp = async () => {
    try {
      const identifier = signinIdentifier.trim();
      const result = signinChannel === 'email'
        ? await authService.requestEmailOtp(identifier)
        : await authService.requestOtp(identifier);
      setSigninSeconds(RESEND_SECONDS);
      if (!result?.devCode) showToast('OTP resent');
    } catch (err) {
      showToast(err.message || 'Could not resend the code');
    }
  };

  const verifySigninOtp = async () => {
    if (signinCode.length < 6) return showToast('Enter the full 6-digit code');
    setSigninBusy(true);
    try {
      const identifier = signinIdentifier.trim();
      const { user } = signinChannel === 'email'
        ? await authService.verifyEmailOtp(identifier, signinCode)
        : await authService.verifyOtp(identifier, signinCode);
      setSession(user);
      router.push('/home');
    } catch (err) {
      showToast(err.message || 'Incorrect code');
    } finally {
      setSigninBusy(false);
    }
  };

  const [socialBusy, setSocialBusy] = useState(false);
  const handleSocialToken = async (provider, idToken) => {
    setSocialBusy(true);
    try {
      const { user } = provider === 'google' ? await authService.googleLogin(idToken) : await authService.appleLogin(idToken);
      setSession(user);
      router.push('/home');
    } catch (err) {
      showToast(err.message || 'Could not sign you in');
    } finally {
      setSocialBusy(false);
    }
  };
  const handleSocialError = (err) => showToast(err.message || 'Could not start sign-in');

  const heading = HEADINGS[tab];

  return (
    <>
      <ScreenHeader back backHref="/welcome">
        <div style={{ marginTop: 14 }}>
          <div style={{ color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700 }}>
            {heading.title}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12.5, marginTop: 2 }}>{heading.sub}</div>
        </div>
      </ScreenHeader>

      <div className="app-scroll pad-nav" style={{ padding: 16 }}>
        <SegTabs
          style={{ margin: '0 0 18px' }}
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'signup', label: 'Create account' },
            { key: 'signin', label: 'Sign in' },
          ]}
        />

        {tab === 'signup' && signupStep === 'form' && (
          <>
            <div className="field-row">
              <NamedField
                id="first-name" label="First Name" icon="user"
                value={form.firstName} onChange={(v) => patch({ firstName: v })}
                placeholder="Priya"
              />
              <NamedField
                id="last-name" label="Last Name" icon="user"
                value={form.lastName} onChange={(v) => patch({ lastName: v })}
                placeholder="Sharma"
              />
            </div>
            <NamedField
              id="mobile" label="Phone Number / Email Address" icon={isEmailInput(form.mobile) ? 'mail' : 'phone'}
              type="text" inputMode="email"
              value={form.mobile} onChange={(v) => patch({ mobile: v })}
              placeholder="+91 98765 43210 or you@example.com"
            />
            <SocietyFields values={form} onChange={patch} />

            <NoteBox icon="shieldCheck" style={{ marginBottom: 16 }}>
              Verified by society admin within 24 hours.
            </NoteBox>

            <TermsGate checked={accepted} onChange={setAccepted} />

            <button className="btn btn-primary" disabled={!accepted || sending} onClick={submitSignupForm}>
              <span className="icb"><Icon name="arrowRight" style={{ width: 13, height: 13 }} /></span>
              {sending ? 'Sending OTP…' : 'Send OTP & join KitabX'}
            </button>

            <div className="or-div">OR</div>

            <button className="btn btn-outline" onClick={() => setTab('signin')}>
              <Icon name="user" style={{ width: 15, height: 15 }} />
              I already have an account
            </button>
          </>
        )}

        {tab === 'signup' && signupStep === 'verify-email' && (
          <>
            <NoteBox icon="mail" style={{ marginBottom: 16 }}>
              One more step — verify {signupEmail}, then we&apos;ll ask for your mobile number to finish joining
              (every KitabX member needs one, for exchange handovers).
            </NoteBox>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>Code sent to {signupEmail}</div>
            <OtpInput value={signupEmailCode} onChange={setSignupEmailCode} />
            <button
              className="link-green" style={{ margin: '10px 0 16px' }}
              onClick={resendSignupEmailOtp} disabled={signupEmailSeconds > 0}
            >
              {signupEmailSeconds > 0 ? `Resend code in 0:${String(signupEmailSeconds).padStart(2, '0')}` : 'Resend code'}
            </button>
            <button className="btn btn-primary" disabled={signupEmailBusy || signupEmailCode.length < 6} onClick={verifySignupEmail}>
              <span className="icb"><Icon name="check" style={{ width: 12, height: 12 }} /></span>
              {signupEmailBusy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button className="btn btn-outline" style={{ marginTop: 10 }} onClick={() => setSignupStep('form')}>
              Back
            </button>
          </>
        )}

        {tab === 'signup' && signupStep === 'need-phone' && (
          <>
            <NoteBox icon="phone" style={{ marginBottom: 16 }}>
              Email verified! Last step — add the mobile number members will use to coordinate handovers with you.
            </NoteBox>
            <NamedField
              id="signup-phone" label="Mobile Number" icon="phone" type="tel" inputMode="tel"
              value={signupPhone} onChange={setSignupPhone}
              placeholder="+91 98765 43210"
            />
            <button className="btn btn-primary" disabled={sending} onClick={submitSignupPhone}>
              <span className="icb"><Icon name="send" style={{ width: 12, height: 12 }} /></span>
              {sending ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </>
        )}

        {tab === 'signin' && signinStep === 'enter' && (
          <>
            <NoteBox icon="phone" style={{ marginBottom: 16 }}>
              We&apos;ll send a one-time code to verify it&apos;s you.
            </NoteBox>
            <NamedField
              id="signin-identifier" label="Phone Number / Email Address"
              icon={isEmailInput(signinIdentifier) ? 'mail' : 'phone'} type="text" inputMode="email"
              value={signinIdentifier} onChange={setSigninIdentifier}
              placeholder="+91 98765 43210 or you@example.com"
            />
            <button className="btn btn-primary" disabled={signinBusy} onClick={sendSigninOtp}>
              <span className="icb"><Icon name="send" style={{ width: 12, height: 12 }} /></span>
              {signinBusy ? 'Sending OTP…' : 'Send OTP'}
            </button>

            <SocialSignInButtons onToken={handleSocialToken} onError={handleSocialError} busy={socialBusy} />
          </>
        )}

        {tab === 'signin' && signinStep === 'otp' && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Code sent to {signinIdentifier}
            </div>
            <OtpInput value={signinCode} onChange={setSigninCode} />
            <button
              className="link-green" style={{ margin: '10px 0 16px' }}
              onClick={resendSigninOtp} disabled={signinSeconds > 0}
            >
              {signinSeconds > 0 ? `Resend code in 0:${String(signinSeconds).padStart(2, '0')}` : 'Resend code'}
            </button>
            <button className="btn btn-primary" disabled={signinBusy || signinCode.length < 6} onClick={verifySigninOtp}>
              <span className="icb"><Icon name="check" style={{ width: 12, height: 12 }} /></span>
              {signinBusy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button className="btn btn-outline" style={{ marginTop: 10 }} onClick={() => { setSigninStep('enter'); setSigninCode(''); }}>
              Use a different number or email
            </button>
          </>
        )}
      </div>
    </>
  );
}

function NamedField({ id, label, icon, value, onChange, placeholder, type = 'text', inputMode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="input-wrap">
        <span className="input-ic-badge"><Icon name={icon} style={{ width: 14, height: 14 }} /></span>
        <input
          id={id}
          className="has-badge"
          type={type}
          inputMode={inputMode}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}
