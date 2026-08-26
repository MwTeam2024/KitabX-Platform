'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import ScreenHeader, { StepProgress } from '@/components/ui/ScreenHeader';
import EmptyState from '@/components/ui/EmptyState';
import { BookCover } from '@/components/books/BookCover';
import { coverForDraft, useBookDraft } from '@/contexts/BookDraftContext';
import { useDebounce } from '@/hooks/useDebounce';
import { booksService } from '@/services/books.service';

/** Screen 08 — title/author search with auto-fill, backed by the real Google Books proxy (§6A). */
export default function SearchBookPage() {
  const router = useRouter();
  const { patchDraft } = useBookDraft();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounced = useDebounce(query, 350);

  useEffect(() => {
    const q = debounced.trim();
    if (!q) { setResults([]); setError(''); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    booksService.searchByTitleOrAuthor(q)
      .then((rows) => { if (!cancelled) setResults(rows || []); })
      .catch((err) => { if (!cancelled) { setResults([]); setError(err.message || 'Search failed'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  const pick = (book) => {
    patchDraft({
      title: book.title,
      author: book.author,
      isbn: book.isbn13 || book.isbn10 || '',
      year: book.publicationYear ? String(book.publicationYear) : '',
    });
    router.push('/books/add/details');
  };

  return (
    <>
      <ScreenHeader back backHref="/books/add">
        <StepProgress label="Step 2 of 3 — Search book" percent={66} />
      </ScreenHeader>

      <div className="app-scroll pad-nav" style={{ padding: '20px 16px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, marginBottom: 4 }}>
          Search by title or author
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
          Type to search — tap a result to auto-fill
        </div>

        <div className="field">
          <input
            placeholder="e.g. Atomic Habits…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search books"
          />
        </div>

        {loading && (
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            Searching…
          </div>
        )}

        {!loading && query.trim() && results.length ? results.map((b) => (
          <button
            key={b.googleBooksId || `${b.title}-${b.author}`}
            className="list-row"
            style={{ margin: '0 0 10px', width: '100%' }}
            onClick={() => pick(b)}
          >
            <BookCover
              book={{ ...coverForDraft({ title: b.title, author: b.author, genre: '' }), title: '' }}
              style={{ width: 40, aspectRatio: '2/3', flexShrink: 0 }}
            />
            <div>
              <b style={{ fontSize: 13.5 }}>{b.title}</b>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{b.author}{b.publisher ? ` · ${b.publisher}` : ''}</div>
            </div>
          </button>
        )) : !loading && query.trim() ? (
          <EmptyState
            icon="🔎"
            title={error || `No match for “${query}”.`}
            hint="Add the book manually instead."
            action={
              <button className="btn btn-primary" onClick={() => router.push('/books/add/details')}>
                Enter details manually
              </button>
            }
          />
        ) : null}

        <button className="btn btn-outline" style={{ marginTop: 6 }} onClick={() => router.push('/books/add')}>
          <Icon name="arrowLeft" style={{ width: 14, height: 14 }} />Back
        </button>
      </div>
    </>
  );
}
