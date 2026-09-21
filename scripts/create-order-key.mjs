import { randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../.env.local', import.meta.url);
let contents;
try { contents = await readFile(path, 'utf8'); }
catch (error) { if (error.code !== 'ENOENT') throw error; contents = ''; }

// Never rotate an existing nonempty value; old replay envelopes depend on it.
const existing = contents.match(/^ORDER_TOKEN_ENCRYPTION_KEY=(.*)$/m);
if (existing && existing[1].trim().replace(/^["']|["']$/g, '')) {
  console.log('An order encryption key is already configured; no changes made.');
} else {
  const setting = `ORDER_TOKEN_ENCRYPTION_KEY="${randomBytes(32).toString('hex')}"`;
  const updated = existing ? contents.replace(/^ORDER_TOKEN_ENCRYPTION_KEY=.*$/m, setting)
    : `${contents}${contents.endsWith('\n') ? '' : '\n'}${setting}\n`;
  await writeFile(path, updated, { mode: 0o600 });
  console.log('Generated an order encryption key in the ignored .env.local file. Its value was not printed.');
}
