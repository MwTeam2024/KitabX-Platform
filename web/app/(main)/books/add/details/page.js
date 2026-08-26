import BookDetailsForm from '@/components/books/BookDetailsForm';

/** Screen 09 — the listing form (§7). `?edit=<key>` reuses it for editing. */
export default async function BookDetailsPage({ searchParams }) {
  const { edit } = await searchParams;
  return <BookDetailsForm editKey={edit || null} />;
}
