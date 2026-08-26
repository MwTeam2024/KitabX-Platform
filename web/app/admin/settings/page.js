'use client';

import { useEffect, useState } from 'react';
import { AdminTopline } from '@/components/admin/AdminShell';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';

/** Update basic app settings and support information. */
export default function AdminSettingsPage() {
  const showToast = useToast();
  const { admin, loadAdminSettings, saveAdminSettings } = useAppData();

  useEffect(() => { loadAdminSettings(); }, [loadAdminSettings]);

  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (admin.settings && !form) {
      setForm({
        supportEmail: admin.settings.supportEmail,
        supportPhone: admin.settings.supportPhone,
      });
    }
  }, [admin.settings, form]);

  const save = async () => {
    try {
      await saveAdminSettings({
        supportEmail: form.supportEmail.trim(),
        supportPhone: form.supportPhone.trim(),
      });
      setSaved(true);
      showToast('Settings saved');
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      showToast(err.message || 'Could not save settings');
    }
  };

  const field = (key) => ({
    value: form?.[key] ?? '',
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  if (!form) return null;

  return (
    <>
      <AdminTopline title="Settings" />

      <div className="admin-panel" style={{ maxWidth: 480 }}>
        <h4>App Settings</h4>
        <div className="field">
          <label htmlFor="s-email">Support Email</label>
          <input id="s-email" type="email" {...field('supportEmail')} />
        </div>
        <div className="field">
          <label htmlFor="s-phone">Support Phone</label>
          <input id="s-phone" {...field('supportPhone')} />
        </div>
        <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 22px' }} onClick={save}>
          Save Settings
        </button>
        {saved && (
          <div style={{ fontSize: 11.5, color: 'var(--brand-2)', marginTop: 10 }}>✓ Saved</div>
        )}
      </div>
    </>
  );
}
