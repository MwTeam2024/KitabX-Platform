'use client';

import { useState } from 'react';
import Icon from '@/components/ui/Icon';
import { useAppData } from '@/contexts/AppDataContext';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * Heart toggle with the spring "pop" animation from the prototype.
 * Availability/requested state comes from the API (§9) — this only owns the save action.
 */
export default function WishlistButton({ bookId, size, style }) {
  const { isWishlisted, toggleWishlist } = useAppData();
  const showToast = useToast();
  const [popping, setPopping] = useState(false);
  const on = isWishlisted(bookId);

  const handle = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!bookId) return;
    try {
      await toggleWishlist(bookId);
      setPopping(false);
      requestAnimationFrame(() => setPopping(true));
      showToast(on ? 'Removed from wishlist' : 'Added to wishlist');
    } catch (err) {
      showToast(err.message || 'Could not update your wishlist');
    }
  };

  return (
    <button
      className={`wish-btn${on ? ' on' : ''}${popping ? ' pop' : ''}`}
      onClick={handle}
      onAnimationEnd={() => setPopping(false)}
      style={style}
      aria-pressed={on}
      aria-label={on ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Icon name="heart" style={size ? { width: size, height: size } : undefined} />
    </button>
  );
}
