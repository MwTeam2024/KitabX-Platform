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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Mirrors the backend's normalizePhone (apps/api/src/common/validate.js) —
 * on the email-signup path, the WhatsApp number is only ever checked there,
 * as the very last step (signup/complete-with-email), by which point the
 * email OTP has already been consumed. A blank-only check here let a
 * malformed number sail all the way through the email-verify step only to
 * fail with "Enter a valid phone number" after the code was already burned
 * — any retry then hit "Code expired" even well inside the 5-minute window.
 * Confirmed live. Validating the actual shape up front, before any OTP is
 * ever sent, keeps a bad number from starting that chain at all.
 */
function isValidPhone(value) {
  const trimmed = (value || '').trim();
  if (trimmed.startsWith('+')) return trimmed.slice(1).replace(/\D/g, '').length >= 10;
  let digits = trimmed.replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2).replace(/^0+/, '');
  return digits.length === 10;
}

const HEADINGS = {
  signup: { title: 'Join your society', sub: 'Read. Exchange. Repeat.' },
  signin: { title: 'Welcome back!', sub: 'Glad to see you again.' },
};

const isEmailInput = (value) => value.includes('@');

/**
 * Screen 02 — signup collects every field up front (name, email, WhatsApp
 * number, address/society — all required, §5) and only asks which channel
 * to verify with *after* that, on its own step; the OTP field for whichever
 * channel was picked stays on that same step rather than navigating to a
 * separate page, per the redesign — the old merged "phone or email" field
 * (auto-detecting which channel from what was typed) is gone along with it,
 * since both are now always collected. NestJS generates and verifies every
 * OTP itself and owns the session, so nothing here is treated as
 * authorization.
 */
export default function AuthForm({ initialTab = 'signup' }) {
  const router = useRouter();
  const showToast = useToast();
  const { signupDraft, setSession, isAuthenticated } = useAuth();

  // SessionGate already blocks rendering anything until the /auth/me check
  // resolves, so if a valid session cookie exists, isAuthenticated is true
  // by the time this ever mounts — the form itself never checked that and
  // would sit there rendered on top of an already-logged-in session, so any
  // link off this page (the header logo included) landed straight in that
  // account with no login step actually happening on this visit.
  useEffect(() => {
    if (isAuthenticated) router.replace('/home');
  }, [isAuthenticated, router]);

  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({
    firstName: signupDraft.firstName || '',
    lastName: signupDraft.lastName || '',
    email: signupDraft.email || '',
    whatsapp: signupDraft.whatsapp || signupDraft.mobile || '',
    societyId: signupDraft.societyId || '',
    blockId: signupDraft.blockId || '',
    flatUnit: signupDraft.flatUnit || '',
    address: signupDraft.address || '',
    latitude: signupDraft.latitude,
    longitude: signupDraft.longitude,
    cityText: signupDraft.cityText,
    locationRequest: signupDraft.locationRequest || null,
  });
  const [accepted, setAccepted] = useState(signupDraft.acceptedTerms);

  // 'form' — collect every field. 'channel' — pick WhatsApp or email for the
  // code. 'otp' — enter that code, still on this same step.
  const [signupStep, setSignupStep] = useState('form');
  const [channel, setChannel] = useState(null); // 'whatsapp' | 'email'
  // Which channel button is mid-send, not just a shared boolean — both
  // buttons read from the same flag before this, so tapping WhatsApp made
  // the Email button show "Sending…" too even though nothing was happening
  // on that one. null | 'whatsapp' | 'email'.
  const [sendingChannel, setSendingChannel] = useState(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [signupCode, setSignupCode] = useState('');
  const [signupBusy, setSignupBusy] = useState(false);
  // Per-channel, not a single shared timer — WhatsApp and email have
  // independent resend cooldowns on the backend (keyed by phone vs email),
  // so sending one must never make the OTHER channel look/be blocked.
  const [signupCooldowns, setSignupCooldowns] = useState({ whatsapp: 0, email: 0 });

  // Sign-in: one merged field, channel detected from what was typed — kept
  // as-is (unlike signup, sign-in only ever needs the one identifier the
  // member already has on file, not a fresh choice between two).
  const [signinIdentifier, setSigninIdentifier] = useState('');
  const [signinChannel, setSigninChannel] = useState(null); // 'phone' | 'email', set once a code is sent
  const [signinStep, setSigninStep] = useState('enter'); // 'enter' | 'otp'
  const [signinCode, setSigninCode] = useState('');
  const [signinBusy, setSigninBusy] = useState(false);
  const [signinSeconds, setSigninSeconds] = useState(0);

  useEffect(() => {
    if (!signupCooldowns.whatsapp && !signupCooldowns.email) return;
    const timer = setTimeout(() => {
      setSignupCooldowns((c) => ({
        whatsapp: Math.max(0, c.whatsapp - 1),
        email: Math.max(0, c.email - 1),
      }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [signupCooldowns]);

  useEffect(() => {
    if (signinSeconds <= 0) return;
    const timer = setTimeout(() => setSigninSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [signinSeconds]);

  const patch = (updates) => setForm((f) => ({ ...f, ...updates }));

  const validateSignupForm = () => {
    if (!form.firstName.trim()) return 'Enter your first name';
    if (!form.lastName.trim()) return 'Enter your last name';
    if (!form.email.trim() || !EMAIL_RE.test(form.email.trim())) return 'Enter a valid email address';
    if (!form.whatsapp.trim()) return 'Enter your WhatsApp number';
    if (!isValidPhone(form.whatsapp)) return 'Enter a valid 10-digit WhatsApp number';
    if (!form.address?.trim()) return 'Enter your address';
    if (!form.cityText?.trim()) return 'Enter your city';
    if (!form.societyId && !(form.locationRequest?.cityName?.trim() && form.locationRequest?.societyName?.trim())) {
      return 'Select your society, or enter one to request';
    }
    if (!accepted) return 'Accept the Terms & Conditions to continue';
    return null;
  };

  const goToChannelStep = async () => {
    const error = validateSignupForm();
    if (error) return showToast(error);
    // Checked here, not just at the per-channel OTP-request step below —
    // so an already-registered email or WhatsApp number is caught the
    // instant "Continue" is tapped, before any OTP is ever sent, rather
    // than after picking a channel and waiting on a real code that was
    // never going to work.
    setCheckingAvailability(true);
    try {
      await authService.checkSignupAvailability(form.whatsapp.trim(), form.email.trim());
    } catch (err) {
      return showToast(err.message || 'Could not check that — try again');
    } finally {
      setCheckingAvailability(false);
    }
    setSignupStep('channel');
  };

  const signupProfile = () => ({
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    societyId: form.societyId || undefined,
    blockId: form.blockId || undefined,
    flatUnit: form.flatUnit || undefined,
    address: form.address || undefined,
    latitude: form.latitude,
    longitude: form.longitude,
    acceptedTerms: accepted,
    locationRequest: form.locationRequest || undefined,
  });

  const chooseChannel = async (ch) => {
    if (signupCooldowns[ch] > 0) return;
    setSendingChannel(ch);
    try {
      if (ch === 'whatsapp') {
        await authService.requestOtp(form.whatsapp.trim(), { intent: 'signup' });
      } else {
        await authService.requestSignupEmailOtp(form.email.trim());
      }
      setChannel(ch);
      setSignupStep('otp');
      setSignupCode('');
      setSignupCooldowns((c) => ({ ...c, [ch]: RESEND_SECONDS }));
    } catch (err) {
      showToast(err.message || 'Could not send the code — try again');
    } finally {
      setSendingChannel(null);
    }
  };

  const resendSignupOtp = async () => {
    try {
      const result = channel === 'whatsapp'
        ? await authService.requestOtp(form.whatsapp.trim(), { intent: 'signup' })
        : await authService.requestSignupEmailOtp(form.email.trim());
      setSignupCooldowns((c) => ({ ...c, [channel]: RESEND_SECONDS }));
      // TEMPORARY — while devCode is exposed for testing, its own toast
      // (api-client.js) already confirms a fresh one was sent; a second
      // toast right behind it would overwrite the code before it's readable.
      if (!result?.devCode) showToast('OTP resent');
    } catch (err) {
      showToast(err.message || 'Could not resend the code');
    }
  };

  const verifySignupOtp = async () => {
    if (signupCode.length < 6) return showToast('Enter the full 6-digit code');
    setSignupBusy(true);
    try {
      let user;
      if (channel === 'whatsapp') {
        ({ user } = await authService.verifyOtp(form.whatsapp.trim(), signupCode, {
          ...signupProfile(),
          email: form.email.trim(),
        }));
      } else {
        const { emailVerificationToken } = await authService.verifySignupEmailOtp(form.email.trim(), signupCode);
        ({ user } = await authService.completeSignupWithEmail({
          emailVerificationToken,
          phone: form.whatsapp.trim(),
          ...signupProfile(),
        }));
      }
      setSession(user);
      if (form.locationRequest) {
        showToast(`Your request to add ${form.locationRequest.societyName}, ${form.locationRequest.cityName} has reached the admin`);
      }
      router.push('/home');
    } catch (err) {
      showToast(err.message || 'Incorrect code');
    } finally {
      setSignupBusy(false);
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
      // TEMPORARY — see above for why this is gated on devCode.
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

  // Redirecting away (see the effect above) — don't flash the signup/signin
  // form for the moment it takes that navigation to land.
  if (isAuthenticated) return null;

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
              id="email" label="Email Address" icon="mail"
              type="text" inputMode="email"
              value={form.email} onChange={(v) => patch({ email: v })}
              placeholder="you@example.com"
            />
            <NamedField
              id="whatsapp" label="WhatsApp Number" icon="phone"
              type="tel" inputMode="tel"
              value={form.whatsapp} onChange={(v) => patch({ whatsapp: v })}
              placeholder="+91 98765 43210"
            />
            <NoteBox icon="messageCircle" style={{ marginBottom: 16 }}>
              This is also the number other members will reach you on for exchange handovers.
            </NoteBox>
            <SocietyFields values={form} onChange={patch} />

            <NoteBox icon="shieldCheck" style={{ marginBottom: 16 }}>
              Verified by society admin within 24 hours.
            </NoteBox>

            <TermsGate checked={accepted} onChange={setAccepted} />

            <button className="btn btn-primary" disabled={!accepted || !!sendingChannel || checkingAvailability} onClick={goToChannelStep}>
              <span className="icb"><Icon name="arrowRight" style={{ width: 13, height: 13 }} /></span>
              {checkingAvailability ? 'Checking…' : 'Continue'}
            </button>

            <div className="or-div">OR</div>

            <button className="btn btn-outline" onClick={() => setTab('signin')}>
              <Icon name="user" style={{ width: 15, height: 15 }} />
              I already have an account
            </button>
          </>
        )}

        {tab === 'signup' && signupStep === 'channel' && (
          <>
            <NoteBox icon="shieldCheck" style={{ marginBottom: 16 }}>
              How should we send your verification code?
            </NoteBox>
            <button
              className="btn btn-primary" style={{ marginBottom: 10 }}
              disabled={!!sendingChannel || signupCooldowns.whatsapp > 0} onClick={() => chooseChannel('whatsapp')}
            >
              <span className="icb"><Icon name="phone" style={{ width: 13, height: 13 }} /></span>
              {signupCooldowns.whatsapp > 0
                ? `Wait 0:${String(signupCooldowns.whatsapp).padStart(2, '0')} to resend`
                : sendingChannel === 'whatsapp' ? 'Sending…' : `WhatsApp — ${form.whatsapp}`}
            </button>
            <button
              className="btn btn-outline" style={{ marginBottom: 16 }}
              disabled={!!sendingChannel || signupCooldowns.email > 0} onClick={() => chooseChannel('email')}
            >
              <Icon name="mail" style={{ width: 15, height: 15 }} />
              {signupCooldowns.email > 0
                ? `Wait 0:${String(signupCooldowns.email).padStart(2, '0')} to resend`
                : sendingChannel === 'email' ? 'Sending…' : `Email — ${form.email}`}
            </button>
            <button className="btn btn-outline" onClick={() => setSignupStep('form')}>
              Back
            </button>
          </>
        )}

        {tab === 'signup' && signupStep === 'otp' && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Code sent to {channel === 'whatsapp' ? form.whatsapp : form.email}
            </div>
            <OtpInput value={signupCode} onChange={setSignupCode} />
            <button
              className="link-green" style={{ margin: '10px 0 16px' }}
              onClick={resendSignupOtp} disabled={signupCooldowns[channel] > 0}
            >
              {signupCooldowns[channel] > 0 ? `Resend code in 0:${String(signupCooldowns[channel]).padStart(2, '0')}` : 'Resend code'}
            </button>
            <button className="btn btn-primary" disabled={signupBusy || signupCode.length < 6} onClick={verifySignupOtp}>
              <span className="icb"><Icon name="check" style={{ width: 12, height: 12 }} /></span>
              {signupBusy ? 'Verifying…' : 'Verify & continue'}
            </button>
            <button className="btn btn-outline" style={{ marginTop: 10 }} onClick={() => setSignupStep('channel')}>
              Use a different channel
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
