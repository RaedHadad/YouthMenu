import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { adminLoginSchema } from '../lib/validation';

const prisma = new PrismaClient();

async function createAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!adminLoginSchema.safeParse({ email, password }).success || !email || !password || password.length < 14) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (14+ characters, at most 72 UTF-8 bytes).');
  }

  const passwordHash = await hash(password, 12);

  const admin = await prisma.admin.create({ data: { email, passwordHash } });

  console.log(`Admin created: ${admin.email}`);
}

createAdmin().catch((error) => {
  console.error(error instanceof Error && error.message.startsWith('Set ADMIN_') ? error.message : 'Admin creation failed. Check the database configuration and whether the email already exists.');
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
