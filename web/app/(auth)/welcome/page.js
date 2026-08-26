import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import InstallPrompt from '@/components/onboarding/InstallPrompt';

export const metadata = {
  title: 'Welcome — KitabX',
  description: 'A community where books live, stories grow, and readers connect.',
};

/**
 * Screen 01 — app introduction and the two entry points into auth (§5).
 * Logo, tagline and the two actions sit as one vertically centred group.
 */
export default function WelcomePage() {
  return (
    <div className="app-scroll welcome-screen">
      <div className="welcome-mark">
        <div className="logo-badge welcome-logo" />
        <p className="welcome-tagline">Give a book, Get a book</p>
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
