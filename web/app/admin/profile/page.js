'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/ui/Icon';
import { AdminTopline } from '@/components/admin/AdminShell';
import OtpInput from '@/components/auth/OtpInput';
import { useToast } from '@/components/ui/ToastProvider';
import { useSheet } from '@/components/ui/SheetProvider';
import { adminService } from '@/services/admin.service';

const RESEND_SECONDS = 30;

/** Task 36 — admin self-service phone/email editing, same OTP-gated pattern
 * as the member Profile Settings screen (Tasks 8/13), just against the
 * separate `admin/auth/*` endpoints/session. */
export default function AdminProfilePage() {
  const showToast = useToast();
  const { openSheet, closeSheet } = useSheet();
  const [admin, setAdmin] = useState(null);

  useEffect(() => {
    adminService.me().then(({ admin: a }) => setAdmin(a)).catch(() => {});
  }, []);

  if (!admin) return null;

  const openPhoneChange = () => {
    openSheet('Change Admin Phone Number', (
      <AdminPhoneChangeForm
        currentPhone={admin.phone}
        onDone={(updated) => { setAdmin(updated); closeSheet(); showToast('Phone number updated'); }}
      />
    ));
  };

  const openEmailChange = () => {
    openSheet(admin.email ? 'Change Admin Email' : 'Add Admin Email', (
      <AdminEmailChangeForm
        currentEmail={admin.email}
        onDone={(updated) => { setAdmin(updated); closeSheet(); showToast('Email updated'); }}
      />
    ));
  };

  return (
    <>
      <AdminTopline title="Admin Profile" />

      <div className="card" style={{ maxWidth: 520, padding: 0, overflow: 'hidden' }}>
        <Row icon="user" label="Name" value={admin.name || 'Not set'} />
        <Row icon="shieldCheck" label="Role" value={admin.role} />
        <Row icon="phone" label="Phone Number" value={admin.phone} onClick={openPhoneChange} />
        <Row icon="mail" label="Email" value={admin.email || 'Add an email address'} onClick={openEmailChange} />
      </div>
    </>
  );
}

function Row({ icon, label, value, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className="settings-row"
      onClick={onClick}
      style={{ width: '100%', borderRadius: 0, border: 'none', borderBottom: '1px solid var(--line)' }}
    >
      <div className="menu-ic" style={{ background: 'var(--mint)', color: 'var(--brand-2)' }}>
        <Icon name={icon} />
      </div>
      <div className="mt">
        <b>{label}</b>
        <span>{value}</span>
      </div>
      {onClick && <Icon name="chevronRight" className="ic arrow" />}
    </Tag>
  );
}

function AdminPhoneChangeForm({ currentPhone, onDone }) {
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
      await adminService.requestPhoneChangeOtp(newPhone);
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
      await adminService.requestPhoneChangeOtp(newPhone);
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
      const { admin } = await adminService.confirmPhoneChange(newPhone, code);
      onDone(admin);
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
        Current number: {currentPhone}. We&apos;ll send a one-time code to the new number to confirm it.
      </p>
      <div className="field">
        <label htmlFor="admin-new-phone">New phone number</label>
        <input
          id="admin-new-phone" type="tel" value={newPhone} placeholder="+91XXXXXXXXXX"
          onChange={(e) => setNewPhone(e.target.value)}
        />
      </div>
      <button className="btn btn-primary" onClick={sendCode} disabled={busy || newPhone.replace(/\D/g, '').length < 10}>
        {busy ? 'Sending…' : 'Send verification code'}
      </button>
    </>
  );
}

function AdminEmailChangeForm({ currentEmail, onDone }) {
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
      await adminService.requestEmailChangeOtp(newEmail);
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
      await adminService.requestEmailChangeOtp(newEmail);
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
      const { admin } = await adminService.confirmEmailChange(newEmail, code);
      onDone(admin);
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
        We&apos;ll send a one-time code to the new email to confirm it — you can then use it to sign in too.
      </p>
      <div className="field">
        <label htmlFor="admin-new-email">New email address</label>
        <input
          id="admin-new-email" type="email" value={newEmail} placeholder="you@example.com"
          onChange={(e) => setNewEmail(e.target.value)}
        />
      </div>
      <button className="btn btn-primary" onClick={sendCode} disabled={busy || !newEmail.includes('@')}>
        {busy ? 'Sending…' : 'Send verification code'}
      </button>
    </>
  );
}
