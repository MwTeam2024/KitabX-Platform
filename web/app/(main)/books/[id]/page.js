import BookDetailView from '@/components/books/BookDetailView';

export const metadata = {
  title: 'Book details — KitabX',
};

/** Screen 05 — full listing detail. */
export default async function BookDetailPage({ params }) {
  const { id } = await params;
  return <BookDetailView bookKey={id} />;
}
