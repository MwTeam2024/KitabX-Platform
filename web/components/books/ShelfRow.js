'use client';

import Link from 'next/link';
import { BookSpine } from './BookCover';
import { StatusPill, toneForStatus } from '@/components/ui/NoteBox';

/** One row of My Shelf: cover thumb, title/author, status pill, optional action. */
export default function ShelfRow({ book, action, statusLabel }) {
  const status = statusLabel ?? (book.paused ? 'Paused' : book.status);

  return (
    <div className="shelf-row">
      <div className="shelf-cov"><BookSpine book={book} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b style={{ fontSize: 13.5 }}>{book.title}</b>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{book.author}</div>
        {status && <StatusPill tone={toneForStatus(status)}>{status}</StatusPill>}
      </div>
      {action ?? (
        <Link className="btn btn-outline btn-sm" href={`/books/${book.key}`}>View</Link>
      )}
    </div>
  );
}
