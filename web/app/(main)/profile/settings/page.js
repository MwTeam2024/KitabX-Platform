'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import Icon from '@/components/ui/Icon';
import ScreenHeader from '@/components/ui/ScreenHeader';
import OtpInput from '@/components/auth/OtpInput';
import SocietyFields from '@/components/onboarding/SocietyFields';
import { useAppSheets } from '@/hooks/useAppSheets';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import { useSheet } from '@/components/ui/SheetProvider';
import { usersService } from '@/services/users.service';
import { authService } from '@/services/auth.service';
import { uploadsService } from '@/services/uploads.service';
import { resizeImageFile } from '@/lib/image';

const RESEND_SECONDS = 30;

/** Screen 20 — profile settings, notification preferences and account actions. */
export default function ProfileSettingsPage() {
  const router = useRouter();
  const showToast = useToast();
  const { editField, privacy } = useAppSheets();
  const { openSheet, closeSheet } = useSheet();
  const { logout, setSession } = useAuth();
  const user = useSelector((s) => s.auth.user);
  const photoInputRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  if (!user) return null;

  const uploadPhoto = async (file) => {
    setUploadingPhoto(true);
    try {
      const resized = await resizeImageFile(file).catch(() => file);
      const { url } = await uploadsService.uploadListingPhoto(resized);
      const { user: updated } = await usersService.updateProfile({ profileImageUrl: url });
      setSession(updated);
      showToast('Profile photo updated');
    } catch (err) {
      showToast(err.message || 'Could not upload this photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveField = async (key, value) => {
    try {
      const { user: updated } = await usersService.updateProfile({ [key]: value });
      setSession(updated);
      showToast(`${key === 'name' ? 'Name' : 'Bio'} updated`);
    } catch (err) {
      showToast(err.message || 'Could not save this change');
    }
  };

  const openPhoneChange = () => {
    openSheet('Change Phone Number', (
      <PhoneChangeForm
        currentPhone={user.phone}
        onDone={(updated) => { setSession(updated); closeSheet(); showToast('Phone number updated'); }}
      />
    ));
  };

  const openEmailChange = () => {
    openSheet(user.email ? 'Change Email' : 'Add Email', (
      <EmailChangeForm
        currentEmail={user.email}
        onDone={(updated) => { setSession(updated); closeSheet(); showToast('Email updated'); }}
      />
    ));
  };

  const openLocationChange = () => {
    openSheet('Change Location', (
      <LocationChangeForm
        user={user}
        onDone={(updated) => { setSession(updated); closeSheet(); showToast('Location updated'); }}
      />
    ));
  };

  const openNotificationPrefs = () => {
    openSheet('Notification preferences', <NotificationPrefs onSave={() => { closeSheet(); showToast('Preferences saved'); }} />);
  };

  const openChatRetention = () => {
    openSheet('Chat auto-delete', <ChatRetentionPrefs onSave={() => { closeSheet(); showToast('Chat auto-delete updated'); }} />);
  };

  const openDeleteRequest = () => {
    openSheet('Request account deletion', (
      <>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 14 }}>
          Your society admin reviews deletion requests. Active exchanges must be completed or cancelled first —
          books already gifted stay with their new owners.
        </p>
        <button
          className="btn btn-outline danger"
          onClick={async () => {
            try {
              await authService.requestAccountDeletion();
              showToast('Deletion request sent — support will confirm by phone');
            } catch (err) {
              showToast(err.message || 'Could not submit this request');
            }
            closeSheet();
          }}
        >
          <Icon name="alertTriangle" style={{ width: 15, height: 15 }} />Send deletion request
        </button>
      </>
    ));
  };

  return (
    <>
      <ScreenHeader back backHref="/profile" title="Profile Settings" subtitle="Manage your profile information" />

      <div className="app-scroll pad-nav" style={{ padding: '16px 0' }}>
        <div
          className="card"
          style={{
            display: 'flex', alignItems: 'center', gap: 14, margin: '0 16px 20px',
            background: 'var(--surface-soft)', boxShadow: 'none', border: '1px solid var(--line)',
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {user.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.profileImageUrl}
                alt={user.name}
                className="avatar-md"
                style={{ width: 66, height: 66, objectFit: 'cover' }}
              />
            ) : (
              <div className="avatar-md" style={{ width: 66, height: 66, fontSize: 22 }}>{user.initials}</div>
            )}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              style={{
                position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderRadius: '50%',
                background: 'var(--brand)', color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', border: '2px solid var(--surface-soft)', cursor: 'pointer',
              }}
              aria-label="Change profile photo"
            >
              <Icon name="camera" style={{ width: 11, height: 11 }} />
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = ''; }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 16, display: 'block' }}>{user.name}</b>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>{user.phone}</div>
          </div>
        </div>

        <Group title="Personal Information">
          <Row icon="user" label="Full Name" value={user.name} onClick={() => editField('Full Name', user.name, (v) => saveField('name', v))} />
          <Row icon="phone" label="Phone Number" value={user.phone} onClick={openPhoneChange} />
          <Row icon="mail" label="Email" value={user.email || 'Add an email address'} onClick={openEmailChange} />
        </Group>

        <Group title="Location">
          {/* Task 45: the standalone "Flat / Unit" row was redundant with
             this one — both opened the exact same LocationChangeForm — so
             its value now folds into this row's value line instead of
             being dropped from view. */}
          <Row
            icon="building" label="Society"
            value={user.society?.name
              ? `${user.block?.name ? `${user.block.name}, ` : ''}${user.society.name}${user.flatUnit ? ` · ${user.flatUnit}` : ''}`
              : 'Not set'}
            valueColor="var(--blue)"
            onClick={openLocationChange}
          />
        </Group>

        <Group title="About You">
          <Row icon="user" label="Bio" value={user.bio || 'Add a short bio'} onClick={() => editField('Bio', user.bio || '', (v) => saveField('bio', v))} />
        </Group>

        <Group title="Preferences">
          <Row icon="bell" label="Notifications" value="Manage notification preferences" onClick={openNotificationPrefs} />
          <Row icon="shieldCheck" label="Privacy" value="Manage your privacy settings" onClick={privacy} />
          <Row icon="trash" label="Chat auto-delete" value="Automatically remove old conversations" onClick={openChatRetention} />
        </Group>

        <Group title="Account Actions">
          <Row
            icon="alertTriangle" label="Delete Account" value="Request removal of your KitabX account"
            iconBg="var(--sindoor-soft)" iconColor="var(--sindoor)" onClick={openDeleteRequest}
          />
        </Group>

        <button
          className="btn btn-outline danger"
          style={{ margin: '6px 16px', width: 'calc(100% - 32px)' }}
          onClick={() => { logout(); showToast('Logged out from this device'); router.push('/welcome'); }}
        >
          <Icon name="logout" style={{ width: 15, height: 15 }} />Log Out
        </button>
        <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-faint)', padding: '0 16px' }}>
          You will be logged out from this device
        </div>
      </div>
    </>
  );
}

function Group({ title, children }) {
  return (
    <>
      <div className="plain-h">{title}</div>
      <div className="settings-group">{children}</div>
    </>
  );
}

function Row({ icon, label, value, valueColor, iconBg = 'var(--mint)', iconColor = 'var(--brand-2)', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className="settings-row" onClick={onClick}>
      <div className="menu-ic" style={{ background: iconBg, color: iconColor }}>
        <Icon name={icon} />
      </div>
      <div className="mt">
        <b>{label}</b>
        <span style={valueColor ? { color: valueColor } : undefined}>{value}</span>
      </div>
      {onClick && <Icon name="chevronRight" className="ic arrow" />}
    </Tag>
  );
}

/** Per-event notification toggles, mapped 1:1 to UserNotificationPreference (§15 / Module 12). */
const EVENTS = [
  { key: 'requestEnabled', label: 'New book request' },
  { key: 'messageEnabled', label: 'New message' },
  { key: 'pickupEnabled', label: 'Pickup scheduled or changed' },
  { key: 'wishlistEnabled', label: 'Wishlist match' },
  { key: 'reportEnabled', label: 'Report update' },
  { key: 'verificationEnabled', label: 'Account verification updates' },
  { key: 'pushEnabled', label: 'Push notifications' },
];

function NotificationPrefs({ onSave }) {
  const [prefs, setPrefs] = useState(null);
  const showToast = useToast();

  useEffect(() => {
    usersService.getNotificationPreferences()
      .then((p) => setPrefs(p || Object.fromEntries(EVENTS.map((e) => [e.key, true]))))
      .catch(() => setPrefs(Object.fromEntries(EVENTS.map((e) => [e.key, true]))));
  }, []);

  if (!prefs) return <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Loading…</div>;

  const save = async () => {
    try {
      await usersService.updateNotificationPreferences(prefs);
      onSave();
    } catch (err) {
      showToast(err.message || 'Could not save preferences');
    }
  };

  return (
    <>
      <div className="reason-list">
        {EVENTS.map((e) => (
          <label className="reason-item" key={e.key}>
            <input
              type="checkbox"
              checked={!!prefs[e.key]}
              onChange={(ev) => setPrefs((s) => ({ ...s, [e.key]: ev.target.checked }))}
              style={{ width: 16, height: 16, accentColor: 'var(--brand-2)' }}
            />
            {e.label}
          </label>
        ))}
      </div>
      <button className="btn btn-primary" onClick={save}>Save preferences</button>
    </>
  );
}

/** New-number entry → OTP verification, then commits the change (§8). */
function PhoneChangeForm({ currentPhone, onDone }) {
  const showToast = useToast();
  const [step, setStep] = useState('enter'); // 'enter' | 'verify'
  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const sendCode = async () => {
    setBusy(true);
    try {
      await authService.requestPhoneChangeOtp(newPhone);
      setStep('verify');
      setSeconds(RESEND_SECONDS);
      showToast(`OTP sent to ${newPhone}`);
    } catch (err) {
      showToast(err.message || 'Could not send the code');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await authService.requestPhoneChangeOtp(newPhone);
      setSeconds(RESEND_SECONDS);
      showToast('OTP resent');
    } catch (err) {
      showToast(err.message || 'Could not resend the code');
    }
  };

  const verify = async () => {
    if (code.length < 6) return showToast('Enter the full 6-digit code');
    setBusy(true);
    try {
      const { user } = await authService.confirmPhoneChange(newPhone, code);
      onDone(user);
    } catch (err) {
      showToast(err.message || 'Incorrect code');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'verify') {
    return (
      <>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
          Code sent to {newPhone}
        </p>
        <OtpInput value={code} onChange={setCode} />
        <button className="link-green" style={{ margin: '10px 0 16px' }} onClick={resend} disabled={seconds > 0}>
          {seconds > 0 ? `Resend code in 0:${String(seconds).padStart(2, '0')}` : 'Resend code'}
        </button>
        <button className="btn btn-primary" onClick={verify} disabled={busy || code.length < 6}>
          {busy ? 'Verifying…' : 'Verify & update number'}
        </button>
      </>
    );
  }

  return (
    <>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
        Current number: {currentPhone}. We&apos;ll send a one-time code to your new number to confirm it.
      </p>
      <div className="field">
        <label htmlFor="new-phone">New phone number</label>
        <input
          id="new-phone" type="tel" value={newPhone} placeholder="+91XXXXXXXXXX"
          onChange={(e) => setNewPhone(e.target.value)}
        />
      </div>
      <button className="btn btn-primary" onClick={sendCode} disabled={busy || newPhone.replace(/\D/g, '').length < 10}>
        {busy ? 'Sending…' : 'Send verification code'}
      </button>
    </>
  );
}

/** New-email entry → OTP verification, then commits the change (§13). */
function EmailChangeForm({ currentEmail, onDone }) {
  const showToast = useToast();
  const [step, setStep] = useState('enter'); // 'enter' | 'verify'
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  const sendCode = async () => {
    setBusy(true);
    try {
      await authService.requestEmailChangeOtp(newEmail);
      setStep('verify');
      setSeconds(RESEND_SECONDS);
      showToast(`OTP sent to ${newEmail}`);
    } catch (err) {
      showToast(err.message || 'Could not send the code');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      await authService.requestEmailChangeOtp(newEmail);
      setSeconds(RESEND_SECONDS);
      showToast('OTP resent');
    } catch (err) {
      showToast(err.message || 'Could not resend the code');
    }
  };

  const verify = async () => {
    if (code.length < 6) return showToast('Enter the full 6-digit code');
    setBusy(true);
    try {
      const { user } = await authService.confirmEmailChange(newEmail, code);
      onDone(user);
    } catch (err) {
      showToast(err.message || 'Incorrect code');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'verify') {
    return (
      <>
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
          Code sent to {newEmail}
        </p>
        <OtpInput value={code} onChange={setCode} />
        <button className="link-green" style={{ margin: '10px 0 16px' }} onClick={resend} disabled={seconds > 0}>
          {seconds > 0 ? `Resend code in 0:${String(seconds).padStart(2, '0')}` : 'Resend code'}
        </button>
        <button className="btn btn-primary" onClick={verify} disabled={busy || code.length < 6}>
          {busy ? 'Verifying…' : 'Verify & update email'}
        </button>
      </>
    );
  }

  return (
    <>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
        {currentEmail ? `Current email: ${currentEmail}. ` : ''}
        We&apos;ll send a one-time code to your new email to confirm it — you can then use it to sign in too.
      </p>
      <div className="field">
        <label htmlFor="new-email">New email address</label>
        <input
          id="new-email" type="email" value={newEmail} placeholder="you@example.com"
          onChange={(e) => setNewEmail(e.target.value)}
        />
      </div>
      <button className="btn btn-primary" onClick={sendCode} disabled={busy || !newEmail.includes('@')}>
        {busy ? 'Sending…' : 'Send verification code'}
      </button>
    </>
  );
}

/**
 * Society/block change — the same real-time discovery scoping the app already
 * builds around `User.societyId` (§8/§9), just exposed as a self-service
 * control instead of a one-time signup choice. Reuses the exact City → Society →
 * Block picker from onboarding (`SocietyFields`) so the two flows never drift.
 */
function LocationChangeForm({ user, onDone }) {
  const showToast = useToast();
  const [values, setValues] = useState({
    societyId: user.society?.id || '',
    blockId: user.block?.id || '',
    flatUnit: user.flatUnit || '',
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!values.societyId) return showToast('Select a society');
    setBusy(true);
    try {
      const { user: updated } = await usersService.updateProfile({
        societyId: values.societyId,
        blockId: values.blockId || null,
        flatUnit: values.flatUnit,
      });
      onDone(updated);
    } catch (err) {
      showToast(err.message || 'Could not update your location');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
        Books shown on Discover and your home stats are scoped to this society — changing it updates what
        you see right away.
      </p>
      <SocietyFields values={values} onChange={(patch) => setValues((v) => ({ ...v, ...patch }))} />
      <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={save} disabled={busy || !values.societyId}>
        {busy ? 'Saving…' : 'Save location'}
      </button>
    </>
  );
}

/** Auto-deletes ("delete for me") conversations quiet longer than the chosen window (§14). */
const RETENTION_OPTIONS = [
  { value: null, label: 'Never (keep forever)' },
  { value: 1, label: 'After 1 month of inactivity' },
  { value: 3, label: 'After 3 months of inactivity' },
  { value: 6, label: 'After 6 months of inactivity' },
];

function ChatRetentionPrefs({ onSave }) {
  const [months, setMonths] = useState(undefined);
  const showToast = useToast();

  useEffect(() => {
    usersService.getNotificationPreferences()
      .then((p) => setMonths(p?.chatRetentionMonths ?? null))
      .catch(() => setMonths(null));
  }, []);

  if (months === undefined) return <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Loading…</div>;

  const save = async () => {
    try {
      await usersService.updateNotificationPreferences({ chatRetentionMonths: months });
      onSave();
    } catch (err) {
      showToast(err.message || 'Could not save this setting');
    }
  };

  return (
    <>
      <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 12 }}>
        Conversations with no new messages for longer than this are removed from your Messages list. The other
        member keeps their own copy either way.
      </p>
      <div className="reason-list">
        {RETENTION_OPTIONS.map((opt) => (
          <label className="reason-item" key={String(opt.value)}>
            <input
              type="radio"
              name="chat-retention"
              checked={months === opt.value}
              onChange={() => setMonths(opt.value)}
              style={{ width: 16, height: 16, accentColor: 'var(--brand-2)' }}
            />
            {opt.label}
          </label>
        ))}
      </div>
      <button className="btn btn-primary" onClick={save}>Save</button>
    </>
  );
}
