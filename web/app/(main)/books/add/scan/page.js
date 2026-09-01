'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader, { StepProgress } from '@/components/ui/ScreenHeader';
import { BookCover } from '@/components/books/BookCover';
import EmptyState from '@/components/ui/EmptyState';
import { coverForDraft, useBookDraft } from '@/contexts/BookDraftContext';
import { booksService } from '@/services/books.service';
import { startScan as startCameraScan, isValidIsbnBarcode } from '@/lib/barcode';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * getUserMedia failures all surface through one generic error, but the fix
 * differs completely by cause — tell the user which one they actually hit
 * instead of a single "check permissions" message that fits none of them.
 */
function cameraErrorMessage(err) {
  if (typeof window !== 'undefined' && (!window.isSecureContext || !navigator.mediaDevices)) {
    return "This page isn't loaded over a secure (https) connection, so the browser won't allow camera access here.";
  }
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission is blocked for this site. Tap the lock/info icon next to the address bar, allow Camera, then try again — also check your phone\'s system settings if the browser itself has camera access turned off.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return "No usable camera was found on this device.";
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use by another app. Close it and try again.';
    default:
      return `Could not access the camera${err?.message ? ` (${err.message})` : ''}. You can enter the details manually instead.`;
  }
}

/**
 * Screen 07 — ISBN barcode scan (§6A). The camera + barcode library live in
 * `lib/barcode.js`; the resolved ISBN is looked up through NestJS → Google Books
 * so the API key never reaches the browser.
 */
export default function ScanIsbnPage() {
  const router = useRouter();
  const showToast = useToast();
  const { patchDraft } = useBookDraft();
  const [state, setState] = useState('idle'); // idle | scanning | looking-up | match | notfound | lookup-error
  const [match, setMatch] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [scanNonce, setScanNonce] = useState(0);
  const videoRef = useRef(null);
  const stopScanRef = useRef(null);

  useEffect(() => () => stopScanRef.current?.(), []);

  const lookupIsbn = async (rawText) => {
    const isbn = rawText.replace(/[^0-9Xx]/g, '');
    if (!isValidIsbnBarcode(isbn)) {
      // A misread frame or a non-ISBN barcode (e.g. a price sticker) the
      // scanner locked onto — the lookup API was never going to find this,
      // so just restart the camera instead of reporting a false "no match".
      // `startScan` already stopped itself on this decode; bumping the nonce
      // re-runs the effect below on the same <video> element to restart it.
      showToast("That didn't look like a valid ISBN barcode — try again");
      setScanNonce((n) => n + 1);
      return;
    }
    stopScanRef.current?.();
    setState('looking-up');
    try {
      const result = await booksService.lookupByIsbn(isbn);
      if (!result) return setState('notfound');
      setMatch(result);
      setState('match');
    } catch (err) {
      // A 404 means the lookup genuinely found nothing; anything else (rate
      // limited, the lookup service down, an expired session) is a transient
      // failure that deserves a retry, not "this book doesn't exist".
      setState(err?.status === 404 ? 'notfound' : 'lookup-error');
    }
  };

  const startScan = () => {
    setCameraError(null);
    setState('scanning');
  };

  useEffect(() => {
    if (state !== 'scanning' || !videoRef.current) return undefined;
    stopScanRef.current = startCameraScan(
      videoRef.current,
      (text) => lookupIsbn(text),
      (err) => {
        const message = cameraErrorMessage(err);
        setCameraError(message);
        showToast(message);
        setState('idle');
      },
    );
    return () => stopScanRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, scanNonce]);

  const useMatch = () => {
    patchDraft({
      title: match.title,
      author: match.author,
      genre: match.genre || 'Fiction',
      isbn: match.isbn13 || match.isbn10 || '',
      year: match.publicationYear ? String(match.publicationYear) : '',
    });
    router.push('/books/add/details');
  };

  return (
    <>
      <ScreenHeader back backHref="/books/add">
        <StepProgress label="Step 2 of 3 — Scan barcode" percent={66} />
      </ScreenHeader>

      <div className="app-scroll pad-nav" style={{ padding: '20px 16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, marginBottom: 14 }}>
          Scan ISBN barcode
        </div>

        {state === 'idle' && (
          <>
            {cameraError && (
              <div
                style={{
                  background: 'var(--sindoor-soft)', color: 'var(--sindoor)', borderRadius: 12,
                  padding: '12px 14px', fontSize: 12.5, lineHeight: 1.5, marginBottom: 14,
                }}
              >
                {cameraError}
              </div>
            )}
            <button
              style={{
                background: 'linear-gradient(160deg,#1B5E37,var(--brand-deep))',
                borderRadius: 16, padding: '44px 16px', textAlign: 'center', color: '#fff',
                marginBottom: 18, width: '100%', border: 'none',
              }}
              onClick={startScan}
            >
              <div style={{ fontSize: 34, marginBottom: 10 }}>📷</div>
              <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,.8)' }}>Tap to open camera</div>
            </button>
            <button className="btn btn-outline" style={{ marginBottom: 10 }} onClick={() => router.push('/books/add/details')}>
              Enter manually instead
            </button>
            <button className="btn btn-outline" onClick={() => router.push('/books/add')}>
              <Icon name="arrowLeft" style={{ width: 14, height: 14 }} />Back
            </button>
          </>
        )}

        {state === 'scanning' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000', marginBottom: 14 }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />
              <div
                style={{
                  position: 'absolute', inset: '30% 12%', border: '2px solid var(--gold)', borderRadius: 10,
                  pointerEvents: 'none',
                }}
              />
            </div>
            <div style={{ fontWeight: 700 }}>Point the camera at the barcode</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4, marginBottom: 14 }}>
              Usually on the back cover
            </div>
            <button className="btn btn-outline" onClick={() => setState('idle')}>Cancel</button>
          </div>
        )}

        {state === 'looking-up' && (
          <div style={{ textAlign: 'center', padding: '56px 10px 30px' }}>
            <div className="bulk-spinner" />
            <div style={{ fontWeight: 700, marginTop: 20 }}>Looking up that ISBN…</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 4 }}>
              Checking the book database
            </div>
          </div>
        )}

        {state === 'match' && match && (
          <>
            <div className="card" style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
              <BookCover
                book={{ ...match, ...coverForDraft({ title: match.title, author: match.author, genre: match.genre }) }}
                style={{ width: 60, aspectRatio: '2/3', flexShrink: 0 }}
              />
              <div>
                <b style={{ fontSize: 14 }}>{match.title}</b>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '2px 0 6px' }}>
                  {match.author} · {match.publisher}
                </div>
                <span className="status-pill st-avail">Match found ✓</span>
              </div>
            </div>
            <button className="btn btn-primary" onClick={useMatch}>Continue</button>
          </>
        )}

        {state === 'notfound' && (
          <EmptyState
            icon="🔎"
            title="No match for that ISBN."
            hint="You can still add the book by typing the details yourself."
            action={
              <button className="btn btn-primary" onClick={() => router.push('/books/add/details')}>
                Enter details manually
              </button>
            }
          />
        )}

        {state === 'lookup-error' && (
          <EmptyState
            icon="⚠️"
            title="Couldn't check that ISBN right now."
            hint="The book lookup service is temporarily busy — try scanning again in a moment, or enter the details yourself."
            action={
              <>
                <button className="btn btn-primary" style={{ marginBottom: 10 }} onClick={startScan}>
                  Try again
                </button>
                <button className="btn btn-outline" onClick={() => router.push('/books/add/details')}>
                  Enter details manually
                </button>
              </>
            }
          />
        )}
      </div>
    </>
  );
}
