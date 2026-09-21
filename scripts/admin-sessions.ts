import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
async function main() {
  if (process.argv.includes('--cleanup')) {
    const sessions = await db.adminSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    const limits = await db.adminLoginLimit.deleteMany({ where: { windowStartedAt: { lt: new Date(Date.now() - 86400000) } } });
    console.log(`Removed ${sessions.count} expired sessions and ${limits.count} old login limits.`);
    return;
  }
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('Set ADMIN_EMAIL to revoke all sessions for that admin.');
  const admin = await db.admin.findUnique({ where: { email }, select: { id: true } });
  if (!admin) throw new Error('Admin not found.');
  const result = await db.adminSession.deleteMany({ where: { adminId: admin.id } });
  console.log(`Revoked ${result.count} admin sessions.`);
}
main().catch(() => { console.error('Session maintenance failed. Check ADMIN_EMAIL and database configuration.'); process.exitCode = 1; })
  .finally(() => db.$disconnect());
