import { PrismaClient } from '@prisma/client';
import { seedMenu } from '../prisma/seed-menu';

const prisma = new PrismaClient();

seedMenu(prisma)
  .then(({ applied }) => {
    console.log(applied ? 'Initial menu and topping assignments created.' : 'Initial menu already seeded; no changes made.');
  })
  .catch(() => {
    console.error('Menu seed failed. Check database connectivity and apply migrations first.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
