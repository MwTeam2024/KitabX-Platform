'use client';

import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

// A member counts as "new" for this long after signing up. Everyone else can
// still replay it from Profile → "How KitabX works".
const NEW_MEMBER_DAYS = 14;
export const TOUR_REQUEST_KEY = 'kitabx.tourRequested';
const SPOT_PAD = 6;

// Each step points at one part of the Discover screen (`target` is a data-tour
// marker); a step with no target is a centred message. A step whose target
// isn't on screen is simply left out.
const STEPS = [
  {
    title: 'Welcome to KitabX 👋',
    text: 'Swap books with neighbours — give one, get one. Here is a quick look at where everything is. It takes under a minute.',
  },
  {
    target: '[data-tour="location"]',
    title: 'Your society',
    text: 'You see books from your society and nearby ones. Tap here to browse around where you are right now instead — handy when you are travelling.',
  },
  {
    target: '[data-tour="radius"]',
    title: 'Discovery radius',
    text: 'Widen or narrow how far we look for books. A bigger radius shows more books from nearby societies.',
  },
  {
    target: '[data-tour="search"]',
    title: 'Search & filters',
    text: 'Find a book by title, author or ISBN. The filter icon narrows by genre, language and condition, and sorts the list.',
  },
  {
    target: '[data-tour="credits"]',
    title: 'Your credits',
    text: 'You get 1 credit the moment you list a book, and requesting a book costs 1 credit. Tap to see your balance and history.',
  },
  {
    target: '[data-tour="share"]',
    title: 'Invite friends',
    text: 'Share your invite link — when a friend joins, you both get 1 free credit.',
  },
  {
    target: '[data-tour="notifications"]',
    title: 'Notifications',
    text: 'Requests, pickup times and updates on your exchanges show up here.',
  },
  {
    target: '[data-tour="profile"]',
    title: 'Your profile',
    text: 'Your profile, completed exchanges, settings, FAQs and support are all here.',
  },
  {
    target: '[data-tour="nav-discover"]',
    title: 'Discover',
    text: 'This screen: books available near you. Come back here any time to find your next read.',
  },
  {
    target: '[data-tour="nav-shelf"]',
    title: 'My Shelf',
    text: 'The books you have listed, plus the ones you gave away or received.',
  },
  {
    target: '[data-tour="nav-wish"]',
    title: 'Wishlist',
    text: 'Tap the heart on any book to save it here for later.',
  },
  {
    target: '[data-tour="nav-exch"]',
    title: 'Exchange',
    text: 'Requests you have received and made — accept, schedule a pickup, and see completed exchanges.',
  },
  {
    target: '[data-tour="fab"]',
    title: 'List a book',
    text: 'Done with a book? List it in a minute — scan the barcode, snap a photo, or add a whole shelf at once.',
  },
  {
    title: 'You are all set 🎉',
    text: 'Start by browsing what is near you. You can replay this tour any time from Profile → How KitabX works.',
  },
];

const doneKey = (userId) => `kitabx.tourDone.${userId}`;

function tourDone(userId) {
  try {
    return window.localStorage.getItem(doneKey(userId)) === '1';
  } catch {
    return false;
  }
}

const measure = (selector) => {
  const el = selector ? document.querySelector(selector) : null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width && r.height ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
};

/**
 * First-visit walkthrough of the Discover screen: one spotlight per part of the
 * app with a line on what it is for. Shown once to a new member; replayable from
 * Profile. Mounted by the home screen only — that is where every part of it lives.
 */
export default function AppTour() {
  const user = useSelector((s) => s.auth.user);
  const userId = user?.id;
  const memberSince = user?.memberSince;
  // Asked for from Profile → "How KitabX works"? That row leaves a note in
  // sessionStorage (a URL flag isn't visible yet when this mounts after an in-app
  // navigation). Read it once here; it is cleared when the tour actually starts.
  const [forced] = useState(() => {
    try {
      return window.sessionStorage.getItem(TOUR_REQUEST_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [steps, setSteps] = useState(null); // null = not running
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const overlayRef = useRef(null);
  const nextRef = useRef(null);

  // Start: automatically for a new member who hasn't seen it, or when asked for (?tour=1).
  useEffect(() => {
    if (!userId) return undefined;
    const joined = memberSince ? new Date(memberSince).getTime() : 0;
    const isNew = joined && Date.now() - joined < NEW_MEMBER_DAYS * 24 * 60 * 60 * 1000;
    if (!forced && (!isNew || tourDone(userId))) return undefined;

    // Give the screen a moment to lay out first, so every target can be measured.
    const timer = setTimeout(() => {
      try {
        window.sessionStorage.removeItem(TOUR_REQUEST_KEY);
      } catch {
        // Nothing to clear.
      }
      const list = STEPS.filter((s) => !s.target || measure(s.target));
      setSteps(list);
      setIndex(0);
      setRect(measure(list[0].target));
    }, forced ? 500 : 1500);
    return () => clearTimeout(timer);
  }, [userId, memberSince, forced]);

  const running = !!steps;

  // While it runs: hide the install banner, keep the page still behind the dim
  // layer, follow window resizes, and let Esc end the tour.
  useEffect(() => {
    if (!running) return undefined;
    document.documentElement.dataset.tour = 'on';
    const overlay = overlayRef.current;
    const stop = (e) => e.preventDefault();
    overlay?.addEventListener('wheel', stop, { passive: false });
    overlay?.addEventListener('touchmove', stop, { passive: false });
    nextRef.current?.focus();
    return () => {
      delete document.documentElement.dataset.tour;
      overlay?.removeEventListener('wheel', stop);
      overlay?.removeEventListener('touchmove', stop);
    };
  }, [running]);

  const finish = () => {
    try {
      if (user?.id) window.localStorage.setItem(doneKey(user.id), '1');
    } catch {
      // Storage blocked — it may show once more next visit.
    }
    setSteps(null);
  };

  const go = (i) => {
    setIndex(i);
    setRect(measure(steps[i].target));
  };

  useEffect(() => {
    if (!running) return undefined;
    const onResize = () => setRect(measure(steps[index].target));
    const onKey = (e) => { if (e.key === 'Escape') finish(); };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
    // finish() only reads the member id; re-binding on every render would add nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, steps, index]);

  if (!running) return null;

  const step = steps[index];
  const last = index === steps.length - 1;
  const first = index === 0;

  // The card sits under the highlighted part, or above it when there's no room below.
  let cardStyle;
  if (rect) {
    const w = Math.min(320, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - w / 2, window.innerWidth - w - 12));
    const below = rect.top + rect.height + SPOT_PAD + 12 + 200 <= window.innerHeight;
    cardStyle = below
      ? { width: w, left, top: rect.top + rect.height + SPOT_PAD + 12 }
      : { width: w, left, bottom: window.innerHeight - rect.top + SPOT_PAD + 12 };
  }

  return (
    <div className="tour" ref={overlayRef} role="dialog" aria-modal="true" aria-label="App tour">
      {rect ? (
        <div
          className="tour-spot"
          style={{
            top: rect.top - SPOT_PAD,
            left: rect.left - SPOT_PAD,
            width: rect.width + SPOT_PAD * 2,
            height: rect.height + SPOT_PAD * 2,
          }}
        />
      ) : (
        <div className="tour-dim" />
      )}

      <div className={`tour-card${rect ? '' : ' center'}`} style={cardStyle}>
        <div className="tour-count">{first || last ? 'KitabX tour' : `${index} of ${steps.length - 2}`}</div>
        <div className="tour-title">{step.title}</div>
        <p className="tour-text">{step.text}</p>
        <div className="tour-actions">
          {!last && <button type="button" className="tour-skip" onClick={finish}>Skip</button>}
          <span style={{ flex: 1 }} />
          {!first && <button type="button" className="tour-back" onClick={() => go(index - 1)}>Back</button>}
          <button
            type="button"
            ref={nextRef}
            className="tour-next"
            onClick={() => (last ? finish() : go(index + 1))}
          >
            {first ? 'Start tour' : last ? 'Got it' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
