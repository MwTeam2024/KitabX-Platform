import { BookDraftProvider } from '@/contexts/BookDraftContext';

/** Keeps the listing draft alive across every step of the add-book wizard. */
export default function AddBookLayout({ children }) {
  return <BookDraftProvider>{children}</BookDraftProvider>;
}
