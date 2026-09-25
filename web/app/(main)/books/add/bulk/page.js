'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ScreenHeader, { StepProgress } from '@/components/ui/ScreenHeader';
import NoteBox from '@/components/ui/NoteBox';
import UploadBox from '@/components/ui/UploadBox';
import EmptyState from '@/components/ui/EmptyState';
import { BookCover } from '@/components/books/BookCover';
import Lightbox from '@/components/ui/Lightbox';
import { coverForDraft } from '@/contexts/BookDraftContext';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { booksService } from '@/services/books.service';
import { uploadsService } from '@/services/uploads.service';
import { useSheet } from '@/components/ui/SheetProvider';

function DuplicateListingConfirm({ titles, onConfirm, onCancel }) {
  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '-8px 0 12px' }}>
        {titles.length === 1
          ? <>You already have &quot;{titles[0]}&quot; listed. If you have another physical copy to give away, you can list it again.</>
          : `You already have ${titles.length} of these books listed. If you have another physical copy of each, you can list them again.`}
      </div>
      {titles.length > 1 && (
        <ul style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 16px', paddingLeft: 18 }}>
          {titles.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
      <button className="btn btn-primary" onClick={onConfirm} style={{ marginBottom: 8 }}>
        {titles.length === 1 ? 'Yes, I have another copy' : 'Yes, add them again'}
      </button>
      <button className="btn btn-outline" onClick={onCancel}>Cancel</button>
    </>
  );
}

const SCAN_STEPS = ['Reading your photo…', 'Detecting book covers…', 'Matching titles and authors…'];
const MIN_SCAN_MS = 1300;

function toDetectedItem(candidate, i) {
  const title = candidate.title || 'Untitled — tap to edit';
  const author = candidate.author || 'Unknown author';
  const genre = candidate.genre || 'Fiction';
  return {
    id: `d${i}`,
    title,
    author,
    genre,
    isbn: candidate.isbn13 || candidate.isbn10 || candidate.isbn || '',
    year: candidate.publicationYear ? String(candidate.publicationYear) : (candidate.year || ''),
    confidence: candidate.unmatched ? 'low' : (candidate.confidence || 'low'),
    unmatched: !!candidate.unmatched,
    coverImageUrl: candidate.coverImageUrl || '',
    ...coverForDraft({ title, author, genre }),
  };
}

/**
 * Screen 07b — one photo, many books. Gemini is an extraction aid only; the
 * user reviews every candidate before anything is published (§6B). Real
 * candidates come from POST /book-identification/image (Gemini Vision, each
 * candidate then matched against Google Books) — no demo data.
 */
export default function BulkUploadPage() {
  const router = useRouter();
  const showToast = useToast();
  const { publishBook, removeListing } = useAppData();
  const { openSheet, closeSheet } = useSheet();
  const [phase, setPhase] = useState('idle'); // idle | scanning | review | empty
  const [stepIndex, setStepIndex] = useState(0);
  const [detected, setDetected] = useState([]);
  const [selected, setSelected] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [bundlePhotoUrl, setBundlePhotoUrl] = useState('');
  const [zoomSrc, setZoomSrc] = useState('');
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const runScan = async (file) => {
    setPhase('scanning');
    setStepIndex(0);
    SCAN_STEPS.forEach((_, i) => {
      if (i === 0) return;
      timers.current.push(setTimeout(() => setStepIndex(i), i * 650));
    });

    // UploadBox already resized this file client-side (with the wider
    // resizeOptions passed below — several books need to stay legible in one
    // frame, unlike a single cover photo) before handing it to onFile.
    const body = new FormData();
    body.append('image', file);
    const minDelay = new Promise((resolve) => timers.current.push(setTimeout(resolve, MIN_SCAN_MS)));
    setBundlePhotoUrl('');

    try {
      // Uploaded once here and attached (as a separate, distinctly-tagged
      // "group photo") to every listing published from this batch — proof
      // the books in it exist together. The backend tags it `OTHER` (not
      // COVER/ACTUAL_CONDITION) so the detail page knows to overlay it with
      // "Includes This Book: <title>" instead of showing it as if it were
      // that book's own photo.
      const [{ candidates }, bundleUpload] = await Promise.all([
        booksService.extractFromImage(body),
        uploadsService.uploadListingPhoto(file).catch(() => null),
        minDelay,
      ]);
      if (bundleUpload?.url) setBundlePhotoUrl(bundleUpload.url);
      const items = (candidates || []).filter((c) => c?.title).map(toDetectedItem);
      if (!items.length) {
        setDetected([]);
        setPhase('empty');
        return;
      }
      setDetected(items);
      setSelected(items.map((d) => d.id));
      setPhase('review');
    } catch (err) {
      showToast(err.message || 'Could not analyze that photo right now — try again shortly');
      setPhase('idle');
    }
  };

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const allSelected = selected.length === detected.length;

  // One combined prompt for the whole batch, not one per duplicate — the
  // user already chose which books to include via the checkboxes above, so
  // asking the same "already listed?" question over and over per book (with
  // no title in the generic message, they read as identical) just looked
  // like the app was stuck repeating itself.
  const confirmDuplicates = (titles) =>
    new Promise((resolve) => {
      // resolve() is safe to call more than once (only the first call does
      // anything) — so closing the sheet via the X/backdrop, which fires
      // onClose instead of onConfirm/onCancel, still resolves this and
      // never leaves the publish loop (and the "Adding…" button) stuck.
      openSheet(
        'Already listed',
        <DuplicateListingConfirm
          titles={titles}
          onConfirm={() => { closeSheet(); resolve(true); }}
          onCancel={() => { closeSheet(); resolve(false); }}
        />,
        { onClose: () => resolve(false) },
      );
    });

  const publishSelected = async () => {
    const chosen = detected.filter((d) => selected.includes(d.id));
    // Several distinct books in the photo is what "bulk" means — with just
    // one, this run is really a single-book add, so the photo the user took
    // is that one book's own actual-condition photo, not a "group" photo:
    // it still belongs on the listing, just as a normal photo (no "part of
    // a bulk upload" tag, which would be both wrong and confusing here).
    const isBulk = detected.length > 1;
    const groupPhotoUrl = isBulk ? (bundlePhotoUrl || undefined) : undefined;
    setPublishing(true);
    let published = 0;
    const duplicates = []; // { d, payload } — resolved together after this pass
    const failed = []; // titles that never made it in, for any reason
    const newlyPublishedKeys = []; // this run's own non-duplicate listings, in case of a rollback below

    for (const d of chosen) {
      const payload = {
        title: d.title,
        author: d.author,
        genre: d.genre,
        lang: 'English',
        cond: 'Good',
        isbn: d.isbn,
        year: d.year,
        pickup: '',
        photos: [d.coverImageUrl, ...(isBulk ? [] : [bundlePhotoUrl])].filter(Boolean),
        groupPhotoUrl,
      };
      try {
        // eslint-disable-next-line no-await-in-loop
        const key = await publishBook(payload);
        newlyPublishedKeys.push(key);
        published += 1;
      } catch (err) {
        if (err.status === 409) {
          duplicates.push({ d, payload });
        } else {
          // eslint-disable-next-line no-console
          console.error(`Could not publish "${d.title}":`, err);
          failed.push(d.title);
        }
      }
    }

    let cancelled = false;
    if (duplicates.length) {
      const shouldAddAnother = await confirmDuplicates(duplicates.map(({ d }) => d.title));
      cancelled = !shouldAddAnother;
      if (cancelled) {
        // Cancelling means "don't publish anything from this run" — not
        // just the duplicates. Otherwise the non-duplicate books in the same
        // photo would already be added by the time the user finishes
        // deciding about the duplicates, which isn't a decision they made —
        // it happened automatically. Roll those back too, so nothing is
        // added until the user re-picks via the checkboxes and publishes
        // again, fully under their own control.
        for (const key of newlyPublishedKeys) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await removeListing(key);
            published -= 1;
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('Could not roll back listing', key, err);
          }
        }
        duplicates.forEach(({ d }) => failed.push(d.title));
      } else {
        for (const { d, payload } of duplicates) {
          try {
            // eslint-disable-next-line no-await-in-loop
            await publishBook(payload, { confirmDuplicate: true });
            published += 1;
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error(`Could not publish "${d.title}" (after confirming duplicate):`, err);
            failed.push(d.title);
          }
        }
      }
    }

    setPublishing(false);
    if (cancelled) {
      showToast("Nothing was added — uncheck the already-listed books and try again");
    } else {
      const addedMsg = `${published} book${published === 1 ? '' : 's'} added to My Shelf`;
      showToast(failed.length ? `${addedMsg} — couldn't add: ${failed.join(', ')}` : addedMsg);
    }
    // Cancelling the duplicate prompt means nothing from this run should be
    // added — keep the user right here so they can adjust the checkboxes and
    // publish again, instead of bouncing them to My Shelf mid-decision.
    if (!cancelled) router.push('/books');
  };

  return (
    <>
      <ScreenHeader back backHref="/books/add">
        <StepProgress label="Step 2 of 3 — Bulk upload with AI" percent={66} />
      </ScreenHeader>

      <div className="app-scroll pad-nav" style={{ padding: '20px 16px' }}>
        {phase === 'idle' && (
          <>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, marginBottom: 4 }}>
              Upload a photo of your books
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Lay a few books out together — our AI reads every cover and spine and lists them all at once.
            </div>
            <UploadBox
              label="Tap to take / upload a photo"
              hint="Works best with 3–8 books, covers facing up"
              minHeight={170}
              onFile={runScan}
              resizeOptions={{ maxWidth: 1600, quality: 0.85 }}
              capture={false}
            />
            <NoteBox icon="camera" style={{ marginTop: 14 }}>
              Take the photo straight-on from above, with all books kept close together — this
              helps our AI detect every title accurately.
            </NoteBox>
            <NoteBox icon="info" style={{ marginTop: 10 }}>
              You&apos;ll review every detected book and can edit or remove any before publishing.
            </NoteBox>
          </>
        )}

        {phase === 'scanning' && (
          <div style={{ textAlign: 'center', padding: '56px 10px 30px' }}>
            <div className="bulk-spinner" />
            <div style={{ fontWeight: 700, marginTop: 20 }}>{SCAN_STEPS[stepIndex]}</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              This usually takes a few seconds
            </div>
          </div>
        )}

        {phase === 'empty' && (
          <EmptyState
            icon="🔎"
            title="No books detected in that photo."
            hint="Try a clearer, well-lit photo with covers facing the camera, or add books one at a time."
            action={
              <button className="btn btn-primary" onClick={() => setPhase('idle')}>
                Try another photo
              </button>
            }
          />
        )}

        {phase === 'review' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div>
                <b style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>{detected.length} books detected</b>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Uncheck a book to leave it out
                </div>
              </div>
              <button
                className="link-green"
                onClick={() => setSelected(allSelected ? [] : detected.map((d) => d.id))}
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {detected.length === 1 && (
              <NoteBox icon="info" style={{ marginTop: 10 }}>
                <b>Only 1 book found in this photo — missed any, or is this the only one you're adding now?</b>
              </NoteBox>
            )}

            <div style={{ margin: '14px 0' }}>
              {detected.map((d) => {
                const on = selected.includes(d.id);
                return (
                  <label className={`bulk-item${on ? '' : ' off'}`} key={d.id}>
                    <input type="checkbox" className="bulk-check" checked={on} onChange={() => toggle(d.id)} />
                    <button
                      type="button"
                      style={{ width: 42, flexShrink: 0, padding: 0, border: 'none', background: 'none' }}
                      onClick={(e) => { if (d.coverImageUrl) { e.preventDefault(); setZoomSrc(d.coverImageUrl); } }}
                      aria-label={d.coverImageUrl ? 'View cover full size' : undefined}
                    >
                      <BookCover
                        book={{ ...d, title: '' }}
                        photoUrl={d.coverImageUrl}
                        style={{ width: 42, aspectRatio: '2/3', flexShrink: 0 }}
                      />
                    </button>
                    <div className="bulk-item-info">
                      <b>{d.title}</b>
                      <span>{d.unmatched ? 'Could not verify — check details' : `${d.author} · ${d.genre}`}</span>
                    </div>
                    <span className={`status-pill ${d.confidence === 'high' ? 'st-avail' : 'st-given'}`}>
                      {d.unmatched ? '⚠ Unverified' : d.confidence === 'high' ? '✓ High match' : '⚠ Low confidence'}
                    </span>
                  </label>
                );
              })}
            </div>

            {bundlePhotoUrl && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  Your photo — attached to every book below, tagged with each book&apos;s title so it&apos;s clear which one it is
                </div>
                <button
                  type="button"
                  style={{ padding: 0, border: 'none', background: 'none', width: 90 }}
                  onClick={() => setZoomSrc(bundlePhotoUrl)}
                  aria-label="View your uploaded photo full size"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bundlePhotoUrl}
                    alt=""
                    style={{ width: 90, aspectRatio: '1', objectFit: 'cover', borderRadius: 10 }}
                  />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <Lightbox src={zoomSrc} onClose={() => setZoomSrc('')} />

      {phase === 'review' && (
        <div className="sticky-cta">
          <button className="btn btn-primary" disabled={!selected.length || publishing} onClick={publishSelected}>
            {publishing ? 'Adding…' : `Add ${selected.length} book${selected.length === 1 ? '' : 's'} to My Shelf`}
          </button>
        </div>
      )}
    </>
  );
}
