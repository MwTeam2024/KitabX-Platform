'use client';

import BookCard from './BookCard';
import { useAppData } from '@/contexts/AppDataContext';
import EmptyState from '@/components/ui/EmptyState';

/** Two-column discovery grid with the "nothing nearby" empty state from §18. */
export default function BookGrid({ books, emptyTitle = 'No books nearby yet.', emptyHint }) {
  const { requestedKeys } = useAppData();

  if (!books.length) {
    return <EmptyState icon="📚" title={emptyTitle} hint={emptyHint} />;
  }

  return (
    <div className="book-grid pad-nav">
      {books.map((book) => (
        <BookCard key={book.key} book={book} requested={requestedKeys.includes(book.key)} />
      ))}
    </div>
  );
}
