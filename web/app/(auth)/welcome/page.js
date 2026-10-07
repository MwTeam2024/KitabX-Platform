import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import InstallPrompt from '@/components/onboarding/InstallPrompt';
import ReferralCapture from '@/components/auth/ReferralCapture';

const DESCRIPTION = 'A book exchange community where books live, stories grow, and readers connect.';

export const metadata = {
  title: 'Welcome — KitabX',
  description: DESCRIPTION,
  // Plain `description` alone only fills <meta name="description"> — WhatsApp,
  // Telegram, iMessage etc. build their share/link-preview card from Open
  // Graph tags instead, which this page (and the rest of the app) never
  // defined, so a referral link shared here showed no reliable card text.
  openGraph: {
    title: 'Welcome — KitabX',
    description: DESCRIPTION,
    siteName: 'KitabX',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512 }],
  },
  twitter: {
    card: 'summary',
    title: 'Welcome — KitabX',
    description: DESCRIPTION,
    images: ['/icons/icon-512.png'],
  },
};

/**
 * Screen 01 — app introduction and the two entry points into auth (§5).
 * Logo, tagline and the two actions sit as one vertically centred group.
 */
export default function WelcomePage() {
  return (
    <div className="app-scroll welcome-screen">
      <ReferralCapture />
      <div className="welcome-mark">
        <div className="logo-badge welcome-logo" />
        <p className="welcome-tagline">Give a book, Get a book</p>
        <p className="welcome-sub">
          <span>Read</span><i className="welcome-dot" aria-hidden="true" />
          <span>Exchange</span><i className="welcome-dot" aria-hidden="true" />
          <span>Repeat</span>
        </p>
      </div>

      <div className="welcome-actions">
        <Link className="btn btn-primary welcome-btn" href="/login?tab=signup">
          Get Started
          <Icon name="arrowRight" style={{ width: 18, height: 18 }} />
        </Link>
        <Link className="btn btn-white welcome-btn" href="/login?tab=signin">
          <Icon name="user" style={{ width: 17, height: 17 }} />
          Already have an account
        </Link>

        <InstallPrompt />
      </div>
    </div>
  );
}
