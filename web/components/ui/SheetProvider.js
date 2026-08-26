'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import Icon from './Icon';

const SheetContext = createContext(null);

export function SheetProvider({ children }) {
  const [sheet, setSheet] = useState(null); // { title, content }

  const openSheet = useCallback((title, content) => setSheet({ title, content }), []);
  const closeSheet = useCallback(() => setSheet(null), []);

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
