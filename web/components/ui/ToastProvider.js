'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ToastContext = createContext(null);

// Lets non-component code (api-client.js) surface a toast without going
// through context — used only for the dev-mode OTP popup below, since a
// plain fetch wrapper can't call a hook.
let globalShowToast = null;
// Longer-lived than a normal toast — this one has a 6-digit code to read
// and (often) type in, not just a status line to glance at.
export function notifyDevOtp(code) {
  globalShowToast?.(`Dev OTP: ${code}`, 12000);
}

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);

  const showToast = useCallback((message, duration = 2400) => {
    setMsg(message);
    setShow(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(false), duration);
  }, []);

  useEffect(() => {
    globalShowToast = showToast;
    return () => { globalShowToast = null; };
  }, [showToast]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className={`toast${show ? ' show' : ''}`} role="status" aria-live="polite">
        <span className="tdot" />
        <span>{msg}</span>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
