'use client';

import { useEffect } from 'react';
import { captureReferralCode } from '@/lib/referral';

/** Invisible — just stashes `?ref=` (if present) before it's lost to
 * navigation away from this page. See lib/referral.js. */
export default function ReferralCapture() {
  useEffect(() => {
    captureReferralCode();
  }, []);
  return null;
}
