'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ScreenHeader, { StepProgress } from '@/components/ui/ScreenHeader';
import NoteBox from '@/components/ui/NoteBox';
import { BookCover } from '@/components/books/BookCover';
import { coverForDraft, useBookDraft } from '@/contexts/BookDraftContext';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { useSheet } from '@/components/ui/SheetProvider';

function DuplicateListingConfirm({ title, onConfirm, onCancel }) {
  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '-8px 0 16px' }}>
        You already have &quot;{title}&quot; listed. If you have another physical copy to give away, you can list it again.
      </div>
      <button className="btn btn-primary" onClick={onConfirm} style={{ marginBottom: 8 }}>
        Yes, I have another copy
      </button>
      <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
    </>
  );
}

/**
 * Screen 10 — preview then publish. Listing a book grants a credit that's
 * spendable immediately — it isn't held pending a handover.
 */
export default function PreviewListingPage() {
  const router = useRouter();
  const showToast = useToast();
  const { publishBook, editListing } = useAppData();
  const { draft, resetDraft } = useBookDraft();
  const { openSheet, closeSheet } = useSheet();
  const [saving, setSaving] = useState(false);

  const { cov, em } = coverForDraft(draft);
  const previewBook = { ...draft, cov, em };
  const editing = !!draft.editKey;

  const doPublish = async (opts) => {
    setSaving(true);
    try {
      await publishBook(draft, opts);
      resetDraft();
      showToast("Listed! Credit added to your balance 📖");
      router.push('/books');
    } catch (err) {
      if (!opts?.confirmDuplicate && err.status === 409) {
        openSheet(
          'Already listed',
          <DuplicateListingConfirm
            title={draft.title}
            onConfirm={() => { closeSheet(); doPublish({ confirmDuplicate: true }); }}
            onCancel={closeSheet}
          />,
        );
        return;
      }
      showToast(err.message || 'Could not publish this listing — try again');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (editing) {
      setSaving(true);
      try {
        await editListing(draft.editKey, draft);
        const key = draft.editKey;
        resetDraft();
        showToast('Listing updated');
        router.push(`/books/${key}`);
      } catch (err) {
        showToast(err.message || 'Could not save changes — try again');
      } finally {
        setSaving(false);
      }
      return;
    }

    await doPublish();
  };

  return (
    <>
      <ScreenHeader back backHref="/books/add/details">
        <StepProgress
          label={editing ? 'Edit listing — preview' : 'Step 3 of 3 — Preview & publish'}
          percent={100}
        />
      </ScreenHeader>

      <div className="app-scroll pad-nav" style={{ padding: '20px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <BookCover book={previewBook} style={{ width: 150, aspectRatio: '2/3' }} showAuthor />
        </div>

        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>
            {draft.title || 'Untitled Book'}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '2px 0 10px' }}>
            {[draft.author || 'Unknown Author', draft.genre, draft.lang].join(' · ')}
          </div>
          <span className="status-pill st-avail">{draft.cond}</span>

          {(draft.isbn || draft.year) && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10 }}>
              {[draft.isbn && `ISBN: ${draft.isbn}`, draft.year && `Edition: ${draft.year}`].filter(Boolean).join(' · ')}
            </div>
          )}
          {draft.condDesc && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Condition: {draft.condDesc}
            </div>
          )}
          {draft.pickup && (
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Pickup note: {draft.pickup}
            </div>
          )}
        </div>

        <NoteBox icon="gift">
          Every book listed is a permanent gift. Publishing this listing earns you <b>1 credit</b> right away to
          request any book you like.
        </NoteBox>
      </div>

      <div className="sticky-cta">
        <button className="btn btn-outline" onClick={() => router.push('/books/add/details')} disabled={saving}>Edit</button>
        <button className="btn btn-primary" onClick={publish} disabled={saving}>
          {saving ? 'Publishing…' : editing ? 'Save changes' : 'Publish listing'}
        </button>
      </div>
    </>
  );
}
