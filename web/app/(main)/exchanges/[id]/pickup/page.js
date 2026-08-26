import PickupScheduler from '@/components/pickup/PickupScheduler';

export const metadata = { title: 'Schedule pickup — KitabX' };

/** Screen 15 — pickup scheduling (§12 / PDF Module 8). */
export default async function PickupPage({ params }) {
  const { id } = await params;
  return <PickupScheduler exchangeId={id} />;
}
