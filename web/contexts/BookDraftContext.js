'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CONDITIONS, GENRES, LANGUAGES, NEW_BOOK_COVERS, NEW_BOOK_EMBLEMS } from '@/lib/mockData';

const BookDraftContext = createContext(null);

const EMPTY_DRAFT = {
  editKey: null,
  title: '',
  author: '',
  genre: GENRES[0],
  lang: LANGUAGES[0],
  isbn: '',
  year: '',
  cond: CONDITIONS[1].label,
  condDesc: '',
  pickup: '',
  photos: [],
};

/**
 * Holds the in-progress listing while the user moves through
 * method → scan/search/manual → details → preview → publish (§7).
 * Lives in a layout so it survives navigation between the wizard's routes.
 */
export function BookDraftProvider({ children }) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  const patchDraft = useCallback((updates) => setDraft((d) => ({ ...d, ...updates })), []);
  const resetDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);
  const loadForEdit = useCallback((book) => {
    setDraft({
      editKey: book.key,
      title: book.title,
      author: book.author,
      genre: book.genre || GENRES[0],
      lang: book.lang || LANGUAGES[0],
      isbn: book.isbn || '',
      year: book.year || '',
      cond: book.cond || CONDITIONS[1].label,
      condDesc: book.condDesc || '',
      pickup: book.pickup || '',
      photos: book.photos || [],
    });
  }, []);

  const value = useMemo(() => ({ draft, patchDraft, resetDraft, loadForEdit }), [draft, patchDraft, resetDraft, loadForEdit]);
  return <BookDraftContext.Provider value={value}>{children}</BookDraftContext.Provider>;
}

export function useBookDraft() {
  const ctx = useContext(BookDraftContext);
  if (!ctx) throw new Error('useBookDraft must be used within BookDraftProvider');
  return ctx;
}

/** Deterministic cover + emblem so a draft always previews the same way. */
export function coverForDraft(draft) {
  const index = (draft.title.length + draft.author.length) % NEW_BOOK_COVERS.length;
  return {
    cov: NEW_BOOK_COVERS[index],
    em: NEW_BOOK_EMBLEMS[draft.genre] || '📗',
  };
}
