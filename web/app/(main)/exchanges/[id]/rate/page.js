import RateExchange from '@/components/ratings/RateExchange';

export const metadata = { title: 'Rate this exchange — KitabX' };

/** Screen 17 — ratings unlock only after a verified handover (§13). */
export default async function RatePage({ params }) {
  const { id } = await params;
  return <RateExchange exchangeId={id} />;
}
