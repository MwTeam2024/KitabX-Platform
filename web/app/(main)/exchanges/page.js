import ExchangeList from '@/components/exchange/ExchangeList';

export const metadata = { title: 'Exchange — KitabX' };

/** Screen 13 — incoming requests, my requests and completed exchanges (§11). */
export default async function ExchangesPage({ searchParams }) {
  const { tab } = await searchParams;
  const valid = ['forme', 'mine', 'done'];
  return <ExchangeList initialTab={valid.includes(tab) ? tab : 'forme'} />;
}
