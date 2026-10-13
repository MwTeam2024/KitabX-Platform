'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Icon from './Icon';

const SheetContext = createContext(null);

export function SheetProvider({ children }) {
  const [sheet, setSheet] = useState(null); // { title, content, onClose }
  const open = sheet !== null;

  // While a sheet is open the page behind it must not scroll. On a phone that
  // scroll makes the browser's address bar / toolbar grow and shrink, and the
  // fixed bottom sheet visibly jumps up and down with it ("moves upward when I
  // scroll"). The usual way to freeze a page: pin the body in place at the
  // current scroll offset, then put the member back exactly where they were on
  // close. (Plain `overflow: hidden` on html/body was tried first — it threw the
  // page back to the top the moment a sheet opened.) The scrollbar track stays
  // (overflow-y: scroll) so the page doesn't shift sideways on desktop.
  useEffect(() => {
    if (!open) return undefined;
    const html = document.documentElement;
    const body = document.body;
    const y = window.scrollY;
    const previous = { overflowY: html.style.overflowY, position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right };
    html.style.overflowY = 'scroll';
    body.style.position = 'fixed';
    body.style.top = `-${y}px`;
    body.style.left = '0';
    body.style.right = '0';
    return () => {
      html.style.overflowY = previous.overflowY;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      window.scrollTo(0, y);
    };
  }, [open]);

  // `onClose` fires however the sheet actually closes — backdrop tap, the
  // X button, or a caller's own `closeSheet()` — so anyone awaiting a
  // decision (e.g. a "confirm or cancel" promise) can't hang forever
  // waiting for an explicit choice that never comes.
  const openSheet = useCallback((title, content, { onClose } = {}) => setSheet({ title, content, onClose }), []);
  const closeSheet = useCallback(() => {
    setSheet((current) => {
      current?.onClose?.();
      return null;
    });
  }, []);

  return (
    <SheetContext.Provider value={{ openSheet, closeSheet }}>
      {children}
      {sheet && (
        <div className="sheet-overlay">
          <div className="sheet-backdrop" onClick={closeSheet} />
          <div className="sheet">
            <div className="sheet-handle" />
            <div className="sheet-head">
              <h3>{sheet.title}</h3>
              <button className="sheet-x" onClick={closeSheet} aria-label="Close">
                <Icon name="x" />
              </button>
            </div>
            {sheet.content}
          </div>
        </div>
      )}
    </SheetContext.Provider>
  );
}

export function useSheet() {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error('useSheet must be used within SheetProvider');
  return ctx;
}
