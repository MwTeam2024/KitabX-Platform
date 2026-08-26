import ExchangeDetailView from '@/components/exchange/ExchangeDetailView';

export const metadata = { title: 'Exchange — KitabX' };

/** Screen 14 — timeline, next action, pickup info and cancel/report (§11). */
export default async function ExchangeDetailPage({ params }) {
  const { id } = await params;
  return <ExchangeDetailView exchangeId={id} />;
}
