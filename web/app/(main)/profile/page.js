'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import Icon from '@/components/ui/Icon';
import BrandLogo from '@/components/layout/BrandLogo';
import HeaderActions from '@/components/layout/HeaderActions';
import BottomNav from '@/components/layout/BottomNav';
import { SectionTitle } from '@/components/ui/NoteBox';
import { useAppData } from '@/contexts/AppDataContext';
import { useAppSheets } from '@/hooks/useAppSheets';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import { SUPPORT_WHATSAPP_LINK } from '@/lib/constants';

/** Screen 19 — public trust profile plus help & support (§Module 2, §13). */
export default function ProfilePage() {
  const router = useRouter();
  const showToast = useToast();
  const { books, credits, exchanges, getOwnerProfile } = useAppData();
  const { faqs, bugReport, privacy, terms } = useAppSheets();
  const { logout } = useAuth();
  const user = useSelector((s) => s.auth.user);
  const [trust, setTrust] = useState(null);

  useEffect(() => {
    if (user?.id) getOwnerProfile(user.id).then(setTrust).catch(() => {});
  }, [user?.id, getOwnerProfile]);

  if (!user) return null;

  const verified = trust?.verified ?? (user.verificationStatus === 'VERIFIED');
  const address = user.flatUnit && user.society?.name ? `${user.flatUnit}, ${user.society.name}` : (user.society?.name || 'No society yet');
  const memberSince = user.memberSince
    ? new Date(user.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '—';

  const stats = useMemo(() => {
    const mine = Object.values(books).filter((b) => b.mine);
    return {
      listed: mine.filter((b) => b.status !== 'Given away' && b.status !== 'Received').length,
      received: mine.filter((b) => b.status === 'Received').length,
      given: mine.filter((b) => b.status === 'Given away').length,
      completed: exchanges.filter((e) => e.status === 'done').length,
    };
  }, [books, exchanges]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.memberId);
    } catch {
      // Clipboard unavailable — the id is still visible on screen.
    }
    showToast('Member ID copied');
  };

  const menu = [
    { label: 'FAQs', icon: 'helpCircle', bg: 'var(--sindoor-soft)', color: 'var(--sindoor)', onClick: faqs },
    {
      label: 'Chat on WhatsApp',
      icon: 'whatsapp',
      bg: 'var(--mint)',
      color: 'var(--brand-2)',
      onClick: () => window.open(SUPPORT_WHATSAPP_LINK, '_blank', 'noopener,noreferrer'),
    },
    { label: 'Report a bug', icon: 'wrench', bg: 'var(--mint)', color: 'var(--brand-2)', onClick: bugReport },
    { label: 'Privacy Policy', icon: 'lock', bg: 'var(--orange-soft)', color: 'var(--sindoor)', onClick: privacy },
    { label: 'Terms & Conditions', icon: 'fileText', bg: 'var(--purple-soft)', color: 'var(--purple)', onClick: terms },
  ];

  return (
    <>
      <div className="app-scroll">
        <div className="profile-hdr">
          <div className="hdr-row">
            <BrandLogo />
            <HeaderActions avatarHref="/profile/settings" />
          </div>

          <div className="profile-id-row">
            <button
              className="profile-avatar"
              onClick={() => router.push('/profile/settings')}
              style={{ padding: 0, overflow: 'hidden' }}
              aria-label="Open profile settings"
            >
              {user.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profileImageUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                user.initials
              )}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2>{user.name}</h2>
              <div className="loc">
                <Icon name="mapPin" style={{ width: 11, height: 11 }} />
                {address}
              </div>
              <div className="profile-badges">
                {verified && (
                  <button
                    className="pbadge"
                    style={{ background: 'var(--mint)', color: 'var(--brand-2)' }}
                    onClick={() => showToast(`Verified by society admin · member since ${memberSince}`)}
                  >
                    <Icon name="shieldCheck" />Verified Member
                  </button>
                )}
                {trust?.averageRating != null && (
                  <span className="pbadge">
                    <Icon name="star" style={{ color: 'var(--gold)' }} />{trust.averageRating} lender
                  </span>
                )}
                <span className="pbadge">
                  <Icon name="shieldCheck" />Since {memberSince}
                </span>
                <button className="id-pill" style={{ marginTop: 0, fontFamily: 'inherit' }} onClick={copyId}>
                  ID: {user.memberId}
                  <Icon name="copy" style={{ width: 11, height: 11 }} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="stats-float">
          <div className="sf">
            <Icon name="bookOpen" /><b>{stats.listed}</b><span>Listed</span>
          </div>
          <div className="sf">
            <Icon name="download" /><b>{stats.received}</b><span>Received</span>
          </div>
          <div className="sf">
            <Icon name="gift" /><b>{stats.given}</b><span>Given</span>
          </div>
          <div className="sf">
            <Icon name="coin" /><b>{credits.available}</b><span>Credits</span>
          </div>
        </div>

        <div style={{ margin: '22px 16px 12px' }}>
          <SectionTitle size={17}>Exchange history</SectionTitle>
        </div>
        <button className="menu-row" onClick={() => router.push('/exchanges?tab=done')}>
          <div className="menu-ic round" style={{ background: 'var(--mint)', color: 'var(--brand-2)' }}>
            <Icon name="layers" />
          </div>
          <span className="mt">{stats.completed} completed exchanges</span>
          <Icon name="chevronRight" className="ic arrow" />
        </button>
        <button className="menu-row" onClick={() => router.push('/notifications')}>
          <div className="menu-ic round" style={{ background: 'var(--gold-soft)', color: 'var(--gold-deep)' }}>
            <Icon name="bell" />
          </div>
          <span className="mt">Notification preferences</span>
          <Icon name="chevronRight" className="ic arrow" />
        </button>
        <button className="menu-row" onClick={() => router.push('/profile/settings')}>
          <div className="menu-ic round" style={{ background: 'var(--purple-soft)', color: 'var(--purple)' }}>
            <Icon name="settings" />
          </div>
          <span className="mt">Settings</span>
          <Icon name="chevronRight" className="ic arrow" />
        </button>

        <div style={{ margin: '22px 16px 12px' }}>
          <SectionTitle size={17}>Help &amp; Support</SectionTitle>
        </div>

        <div className="pad-nav">
          {menu.map((m) => (
            <button className="menu-row" key={m.label} onClick={m.onClick}>
              <div className="menu-ic round" style={{ background: m.bg, color: m.color }}>
                <Icon name={m.icon} />
              </div>
              <span className="mt">{m.label}</span>
              <Icon name="chevronRight" className="ic arrow" />
            </button>
          ))}

          <button
            className="btn btn-outline danger"
            style={{ margin: '8px 16px 0', width: 'calc(100% - 32px)' }}
            onClick={() => { logout(); showToast('Signed out — see you soon 👋'); router.push('/welcome'); }}
          >
            <Icon name="logout" style={{ width: 15, height: 15 }} />Sign out
          </button>
        </div>
      </div>

      <BottomNav />
    </>
  );
}
