/**
 * Minimal reference-data seed — just enough geography for signup/discovery
 * to work on a fresh database. No fake users/books/exchanges are seeded;
 * those should only ever come from real usage. Run with `npm run db:seed`.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SOCIETIES = [
  { name: 'Green Meadows, Powai', city: 'Mumbai', lat: 19.1197, lng: 72.9051 },
  { name: 'Silver Glades, Powai', city: 'Mumbai', lat: 19.1176, lng: 72.9081 },
  { name: 'Palm Meadows, Andheri', city: 'Mumbai', lat: 19.1197, lng: 72.8464 },
];

async function main() {
  for (const s of SOCIETIES) {
    let city = await prisma.city.findFirst({ where: { name: s.city } });
    if (!city) city = await prisma.city.create({ data: { name: s.city, country: 'India' } });

    let area = await prisma.area.findFirst({ where: { cityId: city.id, name: `${s.city} (General)` } });
    if (!area) area = await prisma.area.create({ data: { cityId: city.id, name: `${s.city} (General)` } });

    let society = await prisma.society.findFirst({ where: { areaId: area.id, name: s.name } });
    const isNew = !society;
    if (isNew) {
      society = await prisma.society.create({
        data: { areaId: area.id, name: s.name, latitude: s.lat, longitude: s.lng },
      });
    }

    // Idempotent regardless of whether the society row is new — a prior run
    // that died between "create society" and "set location" would otherwise
    // leave that society permanently invisible to radius discovery.
    const [{ hasLocation }] = await prisma.$queryRaw`
      SELECT location IS NOT NULL AS "hasLocation" FROM societies WHERE id = ${society.id}
    `;
    if (!hasLocation) {
      await prisma.$executeRaw`
        UPDATE societies SET location = ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326)::geography
        WHERE id = ${society.id}
      `;
    }
    const pointCount = await prisma.societyPickupPoint.count({ where: { societyId: society.id } });
    if (!pointCount) {
      await prisma.societyPickupPoint.createMany({
        data: ['Security Gate', 'Reception', 'Clubhouse', 'Common Area'].map((name) => ({ societyId: society.id, name })),
      });
    }

    const blockCount = await prisma.societyBlock.count({ where: { societyId: society.id } });
    if (!blockCount) {
      await prisma.societyBlock.createMany({
        data: ['A', 'B', 'C', 'D'].map((name) => ({ societyId: society.id, name })),
      });
    }
    console.log(isNew ? `Created society: ${s.name}` : `Society already exists: ${s.name}`);
  }

  // §21: one SUPER_ADMIN so the admin console is reachable on a fresh
  // database. Login is phone+OTP only — skipped (with a warning) if no
  // bootstrap phone is set, never falls back to a guessable default.
  const phone = process.env.ADMIN_BOOTSTRAP_PHONE;
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL || undefined;
  if (!phone) {
    console.warn('ADMIN_BOOTSTRAP_PHONE not set — skipping admin bootstrap. Set it in .env and re-run to create one.');
  } else {
    const existingAdmin = await prisma.adminUser.findUnique({ where: { phone } });
    if (existingAdmin) {
      console.log(`Admin already exists: ${phone}`);
    } else {
      await prisma.adminUser.create({
        data: { phone, email, name: 'Super Admin', role: 'SUPER_ADMIN' },
      });
      console.log(`Created admin: ${phone}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
