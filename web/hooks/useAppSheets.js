'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';
import Icon from '@/components/ui/Icon';
import { useSheet } from '@/components/ui/SheetProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { useAppData } from '@/contexts/AppDataContext';
import TrustProfile from '@/components/ui/TrustProfile';
import ReportForm from '@/components/reports/ReportForm';
import EditFieldForm from '@/components/ui/EditFieldForm';
import BugReportForm from '@/components/reports/BugReportForm';
import { BookCover } from '@/components/books/BookCover';
import EmptyState from '@/components/ui/EmptyState';
import { reportsService } from '@/services/reports.service';
import { usersService } from '@/services/users.service';
import { LISTING_REPORT_REASONS, USER_REPORT_REASONS } from '@/lib/constants';

/**
 * Every bottom sheet in the app, in one place — the React equivalent of the
 * prototype's `SHEETS` map. Pages call these instead of composing sheet markup.
 */
export function useAppSheets() {
  const { openSheet, closeSheet } = useSheet();
  const showToast = useToast();
  const router = useRouter();
  const { books, getOwnerProfile } = useAppData();
  const sessionUser = useSelector((s) => s.auth.user);

  const terms = useCallback(() => {
    openSheet('Terms & Conditions', (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        KitabX is a community book gifting platform. Books listed are <b>permanent gifts</b> and will not be returned.
      </p>
    ));
  }, [openSheet]);

  const privacy = useCallback(() => {
    openSheet('Privacy Policy', (
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
        KitabX only shares your tower/block and pickup point with a member once a request is accepted.
        Your exact flat number is never shown on your public profile.
      </p>
    ));
  }, [openSheet]);

  const faqs = useCallback(() => {
    openSheet('FAQs', (
      <>
        <div className="faq-item">
          <b>How do credits work?</b>
          <p>List a book to earn 1 credit once it&apos;s handed over. Use a credit to receive a book permanently.</p>
        </div>
        <div className="faq-item">
          <b>Are books returned?</b>
          <p>No. KitabX is a gifting community. Books are permanently gifted.</p>
        </div>
        <div className="faq-item">
          <b>How is my identity verified?</b>
          <p>Your society admin verifies new members within 24 hours of signup.</p>
        </div>
      </>
    ));
  }, [openSheet]);

  const bugReport = useCallback(() => {
    openSheet('Report a Bug', (
      <BugReportForm
        onSubmit={async ({ screen, description }) => {
          try {
            await reportsService.reportBug({ description, screen });
            showToast('Bug report submitted — thank you!');
          } catch (err) {
            showToast(err.message || 'Could not submit your report');
          }
          closeSheet();
        }}
        onInvalid={() => showToast('Please describe what happened')}
      />
    ));
  }, [openSheet, closeSheet, showToast]);

  const reportListing = useCallback((listingId, bookTitle) => {
    openSheet('Report this Listing', (
      <ReportForm
        reasons={LISTING_REPORT_REASONS}
        onSubmit={async ({ reason, description, attachmentUrls }) => {
          try {
            await reportsService.reportListing(listingId, { reason, description, attachmentUrls });
            showToast('Thanks — our team will review this listing');
          } catch (err) {
            showToast(err.message || 'Could not submit this report');
          }
          closeSheet();
        }}
      />
    ));
  }, [openSheet, closeSheet, showToast]);

  const reportUser = useCallback((userId, name, bookTitle) => {
    openSheet(`Report ${name}`, (
      <>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '-8px 0 14px' }}>
          Your report is confidential and reviewed by our trust &amp; safety team.
        </div>
        <ReportForm
          reasons={USER_REPORT_REASONS}
          blockLabel={`Also block ${name} — you won't see their listings or messages`}
          onSubmit={async ({ reason, description, block, attachmentUrls }) => {
            try {
              await reportsService.reportUser(userId, { reason, description, block, attachmentUrls });
              showToast(block ? `Report submitted — ${name} has been blocked` : 'Report submitted — our team will review this');
            } catch (err) {
              showToast(err.message || 'Could not submit this report');
            }
            closeSheet();
          }}
        />
      </>
    ));
  }, [openSheet, closeSheet, showToast]);

  const sellerListings = useCallback((ownerId, name) => {
    const isSelf = ownerId === sessionUser?.id;
    const owned = Object.values(books).filter((b) => (isSelf ? b.mine : b.ownerId === ownerId && !b.mine));
    openSheet(isSelf ? 'Your books' : `${name}'s books`, (
      <>
        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '-8px 0 16px' }}>
          {owned.length} listing{owned.length !== 1 ? 's' : ''} available
        </div>
        {owned.length ? owned.map((b) => (
          <button
            key={b.key}
            className="list-row"
            style={{ margin: '0 0 10px', width: '100%' }}
            onClick={() => { closeSheet(); router.push(`/books/${b.key}`); }}
          >
            <BookCover book={b} style={{ width: 44, aspectRatio: '2/3', flexShrink: 0 }} titleSize={8} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 13.5, display: 'block' }}>{b.title}</b>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{b.author}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{b.tags.join(' · ')}</div>
            </div>
            <Icon name="chevronRight" className="ic arrow" />
          </button>
        )) : (
          <EmptyState icon="📭" title={isSelf ? 'You have no active listings right now.' : `No listings from ${name} right now.`} />
        )}
        <button className="btn btn-outline" onClick={closeSheet}>Close</button>
      </>
    ));
  }, [openSheet, closeSheet, books, router, sessionUser]);

  const trustProfile = useCallback(async (ownerId, fallbackInitials, fallbackName, bookTitle) => {
    const isSelf = ownerId === sessionUser?.id;
    const profile = await getOwnerProfile(ownerId).catch(() => null);
    const owner = profile ? {
      name: profile.name,
      avgRating: profile.averageRating ?? '—',
      completed: profile.completedExchanges ?? 0,
      memberSince: profile.memberSince ? new Date(profile.memberSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—',
      verified: profile.verified,
      completionRate: profile.completionRate ?? 0,
    } : {
      name: fallbackName, avgRating: '—', completed: 0, memberSince: '—', verified: false, completionRate: 0,
    };
    const reviews = await usersService.getRatings(ownerId).catch(() => []);
    openSheet(isSelf ? 'Your profile' : owner.name, (
      <TrustProfile
        owner={owner}
        isSelf={isSelf}
        reviews={reviews}
        onViewListings={() => sellerListings(ownerId, owner.name)}
        onReport={() => reportUser(ownerId, owner.name, bookTitle)}
      />
    ));
  }, [openSheet, getOwnerProfile, sellerListings, reportUser, sessionUser]);

  const editField = useCallback((label, value, onSave) => {
    openSheet(`Edit ${label}`, (
      <EditFieldForm
        label={label}
        initialValue={value}
        onSave={(next) => { onSave?.(next); showToast(`${label} updated`); closeSheet(); }}
      />
    ));
  }, [openSheet, closeSheet, showToast]);

  return {
    terms, privacy, faqs, bugReport,
    reportListing, reportUser, sellerListings, trustProfile,
    editField,
    openSheet, closeSheet,
  };
}
