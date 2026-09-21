import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error('Set TEST_DATABASE_URL to a disposable local PostgreSQL database.');
const url = new URL(connection);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.includes('test')) {
  throw new Error('Browser tests require localhost and a database name containing "test".');
}

const schema = `ym_browser_${randomBytes(12).toString('hex')}`;
url.searchParams.set('schema', schema);
const env = { ...process.env, ABLY_API_KEY: '', CRON_SECRET: '', DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), YOUTHMENU_BROWSER_TEST: schema,
  ORDER_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('hex'), NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3107' };
const db = new PrismaClient({ datasources: { db: { url: connection } } });

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`Test command exited with code ${code}.`)));
  });
}

let created = false;
try {
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  await run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  await run(['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)]);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Browser tests failed.');
  process.exitCode = 1;
} finally {
  if (created) await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await db.$disconnect();
}
