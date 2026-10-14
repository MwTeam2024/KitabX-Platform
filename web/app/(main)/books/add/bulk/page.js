'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ScreenHeader, { StepProgress } from '@/components/ui/ScreenHeader';
import NoteBox from '@/components/ui/NoteBox';
import UploadBox from '@/components/ui/UploadBox';
import EmptyState from '@/components/ui/EmptyState';
import { BookCover } from '@/components/books/BookCover';
import ListSelect from '@/components/ui/ListSelect';
import { useFacets } from '@/hooks/useFacets';
import Lightbox from '@/components/ui/Lightbox';
import { coverForDraft } from '@/contexts/BookDraftContext';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';
import { booksService } from '@/services/books.service';
import { uploadsService } from '@/services/uploads.service';
import { useSheet } from '@/components/ui/SheetProvider';
import { takePendingBulkPhoto } from '@/lib/pendingBulkPhoto';

function DuplicateListingConfirm({ titles, onConfirm, onCancel }) {
  const multiple = titles.length > 1;
  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', margin: '-8px 0 12px' }}>
        {multiple
          ? `You already have ${titles.length} of these books listed. If you have another physical copy of every one of them, you can list them all again.`
          : <>You already have &quot;{titles[0]}&quot; listed. If you have another physical copy to give away, you can list it again.</>}
      </div>
      {multiple && (
        <ul style={{ fontSize: 12.5, color: 'var(--text-muted)', margin: '0 0 10px', paddingLeft: 18 }}>
          {titles.map((t) => <li key={t}>{t}</li>)}
        </ul>
      )}
      {multiple && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
          Only have a spare copy of some of these? Tap &quot;Go back &amp; edit selection&quot;, uncheck the
          one(s) you don&apos;t, then add the rest again.
        </div>
      )}
      <button className="btn btn-primary" onClick={onConfirm} style={{ marginBottom: 8 }}>
        {multiple ? 'Yes, I have another copy of all of them' : 'Yes, I have another copy'}
      </button>
      <button className="btn btn-outline" onClick={onCancel}>
        {multiple ? 'Go back & edit selection' : 'Cancel'}
      </button>
    </>
  );
}

const SCAN_STEPS = ['Reading your photo…', 'Detecting book covers…', 'Matching titles and authors…'];
const MIN_SCAN_MS = 1300;

// What a row holds when the scan found no title / author. The fields start empty
// (with this as their placeholder) instead of showing it as if it were typed.
const NO_TITLE = 'Untitled — tap to edit';
const NO_AUTHOR = 'Unknown author';

// A detected genre that only differs by case/hyphens ("non fiction") selects the
// list's own spelling, and one that isn't in the list at all is still offered so
// it isn't lost — same matching as the add-book form.
const norm = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const resolveGenre = (options, current) => options.find((o) => norm(o) === norm(current)) ?? current;
const withCurrent = (options, current) => (current && !options.some((o) => norm(o) === norm(current)) ? [current, ...options] : options);

function toDetectedItem(candidate, i) {
  const title = candidate.title || NO_TITLE;
  const author = candidate.author || NO_AUTHOR;
  const genre = candidate.genre || 'Others';
  return {
    id: `d${i}`,
    title,
    author,
    genre,
    lang: candidate.language || 'Others',
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
  const facets = useFacets();
  const [phase, setPhase] = useState('idle'); // idle | scanning | review | empty
  const [stepIndex, setStepIndex] = useState(0);
  const [detected, setDetected] = useState([]);
  const [selected, setSelected] = useState([]);
  const [publishing, setPublishing] = useState(false);
  const [bundlePhotoUrl, setBundlePhotoUrl] = useState('');
  const [zoomSrc, setZoomSrc] = useState('');
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // A photo handed off from the ISBN-scan "not found" fallback — start
  // scanning immediately instead of showing the upload screen again, since
  // the user already picked/took this photo there.
  useEffect(() => {
    const pending = takePendingBulkPhoto();
    if (pending) runScan(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Title / author / genre are edited right in each row; anything the member
  // changes marks the book as edited (the pill says so).
  const updateItem = (id, patch) =>
    setDetected((list) => list.map((x) => {
      if (x.id !== id) return x;
      const next = { ...x, ...patch, edited: true };
      return { ...next, ...coverForDraft({ title: next.title, author: next.author, genre: next.genre }) };
    }));

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
      // The real decision's resolve() must run BEFORE closeSheet() — closeSheet
      // itself triggers onClose (-> resolve(false)) as a side effect, and
      // since only the first resolve() on a Promise ever counts, calling
      // closeSheet() first let that resolve(false) sometimes race ahead of
      // "Yes, add them again"'s own resolve(true), intermittently treating a
      // confirmed Yes as a Cancel.
      openSheet(
        'Already listed',
        <DuplicateListingConfirm
          titles={titles}
          onConfirm={() => { resolve(true); closeSheet(); }}
          onCancel={() => { resolve(false); closeSheet(); }}
        />,
        { onClose: () => resolve(false) },
      );
    });

  const publishSelected = async () => {
    const chosen = detected.filter((d) => selected.includes(d.id));
    // The title field can now be cleared in the row itself.
    const untitled = chosen.find((d) => !d.title.trim() || d.title === NO_TITLE);
    if (untitled) return showToast('Please add a title for every book you are adding');
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
        title: d.title.trim(),
        author: d.author.trim() || NO_AUTHOR,
        genre: d.genre,
        lang: d.lang,
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
                  Edit anything that looks off, or uncheck a book to skip it
                </div>
              </div>
              <button
                className="link-green"
                style={{ whiteSpace: 'nowrap', marginLeft: 10 }}
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
                  <div className={`bulk-item${on ? '' : ' off'}`} key={d.id}>
                    <input
                      type="checkbox"
                      className="bulk-check"
                      aria-label={`Add ${d.title || 'this book'}`}
                      checked={on}
                      onChange={() => toggle(d.id)}
                    />
                    <button
                      type="button"
                      style={{ width: 42, flexShrink: 0, padding: 0, border: 'none', background: 'none' }}
                      onClick={() => { if (d.coverImageUrl) setZoomSrc(d.coverImageUrl); }}
                      aria-label={d.coverImageUrl ? 'View cover full size' : undefined}
                    >
                      <BookCover
                        book={{ ...d, title: '' }}
                        photoUrl={d.coverImageUrl}
                        style={{ width: 42, aspectRatio: '2/3', flexShrink: 0 }}
                      />
                    </button>
                    {/* Title, author and genre are edited right here — no extra tap to open a form. */}
                    <div className="bulk-fields">
                      {/* A book the member has edited says so, whatever the scan's confidence was. */}
                      <span className={`status-pill bulk-pill ${d.edited || d.confidence === 'high' ? 'st-avail' : 'st-given'}`}>
                        {d.edited ? '✎ Edited' : d.unmatched ? '⚠ Unverified' : d.confidence === 'high' ? '✓ High match' : '⚠ Low confidence'}
                      </span>
                      <input
                        className="bulk-input"
                        aria-label="Book title"
                        placeholder="Book title"
                        title={d.title === NO_TITLE ? '' : d.title}
                        value={d.title === NO_TITLE ? '' : d.title}
                        onChange={(e) => updateItem(d.id, { title: e.target.value })}
                      />
                      {/* Side by side where there's room, stacked on a phone. */}
                      <div className="bulk-row2">
                        <input
                          className="bulk-input"
                          aria-label="Author"
                          placeholder="Author"
                          title={d.author === NO_AUTHOR ? '' : d.author}
                          value={d.author === NO_AUTHOR ? '' : d.author}
                          onChange={(e) => updateItem(d.id, { author: e.target.value })}
                        />
                        <ListSelect
                          id={`bulk-genre-${d.id}`}
                          value={resolveGenre(facets.genres, d.genre)}
                          options={withCurrent(facets.genres, d.genre)}
                          placeholder="Select genre"
                          align="right"
                          wide
                          onChange={(genre) => updateItem(d.id, { genre })}
                        />
                      </div>
                    </div>
                  </div>
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
