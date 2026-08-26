'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import NoteBox from '@/components/ui/NoteBox';
import ScreenHeader, { StepProgress } from '@/components/ui/ScreenHeader';
import SocietyFields from './SocietyFields';
import TermsGate from '@/components/auth/TermsGate';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import { authService } from '@/services/auth.service';
import { usersService } from '@/services/users.service';

const STEPS = [
  { key: 'profile', label: 'Step 1 of 3 — Your details', percent: 33 },
  { key: 'society', label: 'Step 2 of 3 — Your society', percent: 66 },
  { key: 'terms', label: 'Step 3 of 3 — Terms & privacy', percent: 100 },
];

/** Reached by a member who verified their number before their society/profile existed. */
export default function OnboardingWizard() {
  const router = useRouter();
  const showToast = useToast();
  const { user, setSession } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [form, setForm] = useState({
    firstName: user?.name?.split(' ')[0] || '',
    lastName: user?.name?.split(' ').slice(1).join(' ') || '',
    societyId: user?.society?.id || '',
    blockId: user?.block?.id || '',
    flatUnit: user?.flatUnit || '',
  });

  const patch = (updates) => setForm((f) => ({ ...f, ...updates }));
  const current = STEPS[step];

  const next = () => {
    if (step === 0 && !form.firstName.trim()) return showToast('Please enter your first name');
    if (step === 1 && !form.societyId) return showToast('Please select your society');
    setStep((s) => s + 1);
  };

  const finish = async () => {
    setSaving(true);
    try {
      const updated = await usersService.updateProfile({
        name: `${form.firstName} ${form.lastName}`.trim(),
        societyId: form.societyId,
        blockId: form.blockId || undefined,
        flatUnit: form.flatUnit || undefined,
      });
      setSession(updated.user);
      showToast('Profile saved — welcome to KitabX 🌿');
      router.push('/home');
    } catch (err) {
      showToast(err.message || 'Could not save your profile — try again');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScreenHeader back={step > 0} backHref={step > 0 ? undefined : '/welcome'}>
        <StepProgress label={current.label} percent={current.percent} />
      </ScreenHeader>

      <div className="app-scroll pad-nav" style={{ padding: '20px 16px' }}>
        {step === 0 && (
          <>
            <Title>Tell us about you</Title>
            <Sub>This is what neighbours see on your public profile.</Sub>
            <div className="field-row">
              <div className="field">
                <label htmlFor="ob-first">First Name</label>
                <input id="ob-first" value={form.firstName} placeholder="Priya" onChange={(e) => patch({ firstName: e.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="ob-last">Last Name</label>
                <input id="ob-last" value={form.lastName} placeholder="Sharma" onChange={(e) => patch({ lastName: e.target.value })} />
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <Title>Where do you read?</Title>
            <Sub>Books are exchanged inside your society first, then nearby ones.</Sub>
            <SocietyFields values={form} onChange={patch} />
            <NoteBox icon="lock">
              Your exact flat number stays private — neighbours only see your block until a request is accepted.
            </NoteBox>
          </>
        )}

        {step === 2 && (
          <>
            <Title>Almost there</Title>
            <Sub>Accept the community rules and your account goes to your society admin for verification.</Sub>
            <NoteBox icon="shieldCheck" style={{ marginBottom: 16 }}>
              Verified by society admin within 24 hours.
            </NoteBox>
            <TermsGate checked={accepted} onChange={setAccepted} />
          </>
        )}
      </div>

      <div className="sticky-cta" style={{ flexDirection: 'column', gap: 8 }}>
        {step < STEPS.length - 1 ? (
          <button className="btn btn-primary" onClick={next}>
            Continue<Icon name="arrowRight" style={{ width: 14, height: 14 }} />
          </button>
        ) : (
          <button className="btn btn-primary" disabled={!accepted || saving} onClick={finish}>
            <span className="icb"><Icon name="check" style={{ width: 13, height: 13 }} /></span>
            {saving ? 'Saving…' : 'Finish & explore books'}
          </button>
        )}
        {step > 0 && (
          <button className="btn btn-outline" onClick={() => setStep((s) => s - 1)}>
            <Icon name="arrowLeft" style={{ width: 14, height: 14 }} />Back
          </button>
        )}
      </div>
    </>
  );
}

const Title = ({ children }) => (
  <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, marginBottom: 4 }}>{children}</div>
);
const Sub = ({ children }) => (
  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{children}</div>
);
