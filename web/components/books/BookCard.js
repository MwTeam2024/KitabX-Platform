'use client';

import { useRouter } from 'next/navigation';
import Icon from '@/components/ui/Icon';
import { BookCover } from './BookCover';
import WishlistButton from '@/components/wishlist/WishlistButton';

/** Discovery grid card — cover, wishlist heart, genre pill and distance. */
export default function BookCard({ book, requested = false }) {
  const router = useRouter();

  return (
    <div
      className="book-card"
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/books/${book.key}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(`/books/${book.key}`);
        }
      }}
    >
      {requested && <span className="tag-abs">Requested</span>}
      <WishlistButton bookId={book.bookId} />
      <div className="bc-cov">
        <BookCover book={book} className="w-full h-full" showAuthor />
      </div>
      <div className="bc-info">
        <div className="bc-title">{book.title}</div>
        <div className="bc-author">{book.author}</div>
        <div className="bc-foot">
          <span className="pill-tag">{book.genre}</span>
          {book.distanceKm != null && (
            <span className="dist"><Icon name="mapPin" />{book.distanceKm} km</span>
          )}
        </div>
      </div>
    </div>
  );
}
