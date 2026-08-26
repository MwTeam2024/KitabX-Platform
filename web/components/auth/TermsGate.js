'use client';

import { useAppSheets } from '@/hooks/useAppSheets';

/** Terms + Privacy acceptance checkbox that gates the signup submit (§5). */
export default function TermsGate({ checked, onChange }) {
  const { terms, privacy } = useAppSheets();

  return (
    <label className="reason-item" style={{ marginBottom: 16, alignItems: 'flex-start' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 16, height: 16, flexShrink: 0 }}
      />
      <span>
        I agree to the{' '}
        <button type="button" className="link-green" style={{ display: 'inline' }} onClick={terms}>
          Terms &amp; Conditions
        </button>{' '}
        and{' '}
        <button type="button" className="link-green" style={{ display: 'inline' }} onClick={privacy}>
          Privacy Policy
        </button>
      </span>
    </label>
  );
}
