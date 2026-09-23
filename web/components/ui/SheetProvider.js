'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import Icon from './Icon';

const SheetContext = createContext(null);

export function SheetProvider({ children }) {
  const [sheet, setSheet] = useState(null); // { title, content, onClose }

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
