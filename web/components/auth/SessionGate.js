'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { hydrateSession } from '@/hooks/useAuth';

/**
 * Runs the /auth/me check once per app load. The session itself lives in an
 * httpOnly cookie the browser already sends automatically — Redux only needs
 * to learn *whether* one exists so a page refresh doesn't briefly look
 * logged-out before the check resolves.
 */
export default function SessionGate({ children }) {
  const dispatch = useDispatch();
  const hydrated = useSelector((s) => s.auth.hydrated);

  useEffect(() => {
    hydrateSession(dispatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hydrated) {
    return (
      <div className="app-frame">
        <div className="app-scroll" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="bulk-spinner" />
          </div>
        </div>
      </div>
    );
  }

  return children;
}
