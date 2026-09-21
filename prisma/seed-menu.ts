import type { PrismaClient } from '@prisma/client';

const seedKey = 'initial-menu-v1';
const dishes = [
  { name: 'مقدوحه', priceInAgorot: 500, acceptsToppings: true },
  { name: 'توست', priceInAgorot: 500, acceptsToppings: true },
  { name: 'مقدوحه مع جبنه', priceInAgorot: 500, acceptsToppings: true },
  { name: 'تروبيت', priceInAgorot: 100, acceptsToppings: false },
];

/** Seed once, atomically, without resetting existing prices or menu choices. */
export async function seedMenu(prisma: PrismaClient) {
  return prisma.$transaction(async (tx) => {
    // Serialize concurrent seed commands without locking normal menu traffic.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(7528301)::text`;
    if (await tx.seedRun.findUnique({ where: { key: seedKey } })) {
      return { applied: false };
    }

    const toppings = [];
    for (const name of ['كاتشب', 'خردل', 'طحينة']) {
      toppings.push(await tx.topping.upsert({
        where: { name },
        update: {},
        create: { name, priceInAgorot: 0 },
      }));
    }

    for (const { acceptsToppings, ...dish } of dishes) {
      const existing = await tx.menuItem.findUnique({ where: { name: dish.name } });
      const item = existing ?? await tx.menuItem.create({ data: dish });
      // Existing items retain their assignments. Only new seed dishes get defaults.
      if (!existing && acceptsToppings) {
        await tx.menuItemTopping.createMany({
          data: toppings.map((topping) => ({ menuItemId: item.id, toppingId: topping.id })),
          skipDuplicates: true,
        });
      }
    }

    await tx.seedRun.create({ data: { key: seedKey } });
    return { applied: true };
  }, { maxWait: 10_000, timeout: 30_000 });
}
