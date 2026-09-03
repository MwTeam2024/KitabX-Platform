'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppFrame from '@/components/layout/AppFrame';
import { useAppData } from '@/contexts/AppDataContext';
import { useSheet } from '@/components/ui/SheetProvider';
import { useAuth } from '@/hooks/useAuth';

export default function MainLayout({ children }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { accountSuspended } = useAppData();
  const { openSheet } = useSheet();

  // SessionGate only learns *whether* a session exists — it never stopped
  // this whole section (Discover, My Shelf, Profile, ...) from rendering
  // without one. Without this, an unauthenticated visitor landed here with
  // `user` null throughout and every screen quietly fell back to whatever
  // placeholder each component happened to have — including, in
  // HeaderActions, the original prototype's hardcoded mock avatar ("PS") —
  // instead of ever being sent back to log in.
  useEffect(() => {
    if (!isAuthenticated) router.replace('/welcome');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <AppFrame>
      {children}
      {accountSuspended && (
        <div className="suspended-overlay open">
          <div className="card" style={{ maxWidth: 320, width: '88%', padding: '32px 26px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>🚫</div>
            <div className="font-display" style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Account Suspended</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Your account has been suspended by a society admin. Contact support if you think this is a mistake.
            </div>
            <button
              className="btn btn-primary"
              onClick={() => openSheet('Chat with support', <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Our support team typically replies within a few hours. Email support@kitabx.app.</p>)}
            >
              Contact Support
            </button>
          </div>
        </div>
      )}
    </AppFrame>
  );
}
