import ExchangeList from '@/components/exchange/ExchangeList';

export const metadata = { title: 'Exchange — KitabX' };

/** Screen 13 — incoming requests, my requests and completed exchanges (§11). */
export default async function ExchangesPage({ searchParams }) {
  const { tab, from } = await searchParams;
  const valid = ['forme', 'mine', 'done'];
  // Opened from a Profile shortcut ("N completed exchanges") rather than the
  // bottom nav: there's no tab to tap to get back, so it gets a back button.
  const backHref = from === 'profile' ? '/profile' : undefined;
  return <ExchangeList initialTab={valid.includes(tab) ? tab : 'forme'} backHref={backHref} />;
}
