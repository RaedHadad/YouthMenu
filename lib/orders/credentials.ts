import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

type Purpose = 'access' | 'pickup' | 'creation';
export type OrderCredentials = { pickupToken: string; customerAccessToken: string };
const tokenPattern = /^[a-f0-9]{64}$/;
export class CredentialConfigurationError extends Error {}

export function isOrderToken(value: unknown): value is string {
  return typeof value === 'string' && tokenPattern.test(value);
}

export function generateOrderCredentials(): OrderCredentials {
  return { pickupToken: randomBytes(32).toString('hex'), customerAccessToken: randomBytes(32).toString('hex') };
}

export function generateVisibleCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

export function hashOrderToken(token: string, purpose: Purpose) {
  if (!isOrderToken(token)) throw new Error('Invalid order credential format');
  return createHash('sha256').update(`youthmenu:${purpose}:v2:${token}`).digest('hex');
}

export function verifyOrderToken(token: unknown, storedHash: string, purpose: 'access' | 'pickup', version: number) {
  if (!isOrderToken(token) || !isOrderToken(storedHash)) return false;
  let expected: string;
  if (version === 2) {
    expected = hashOrderToken(token, purpose);
  } else if (version === 1 && process.env.SESSION_SECRET) {
    // Preserve configured legacy credentials; never substitute a development secret.
    expected = createHmac('sha256', process.env.SESSION_SECRET).update(token).digest('hex');
  } else return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(storedHash, 'hex'));
}

function encryptionKey() {
  const key = process.env.ORDER_TOKEN_ENCRYPTION_KEY;
  if (!key || !tokenPattern.test(key)) throw new CredentialConfigurationError('Order credential encryption key is not configured');
  return Buffer.from(key, 'hex');
}

export function assertCredentialConfiguration() { encryptionKey(); }

/** Authenticated encryption allows response recovery without plaintext tokens in PostgreSQL. */
export function sealCredentials(credentials: OrderCredentials, creationKeyHash: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`youthmenu:credentials:v2:${creationKeyHash}`));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), 'utf8'), cipher.final()]);
  return ['v2', iv.toString('hex'), cipher.getAuthTag().toString('hex'), ciphertext.toString('hex')].join('.');
}

export function openCredentials(envelope: string, creationKeyHash: string): OrderCredentials {
  const [version, iv, tag, ciphertext, extra] = envelope.split('.');
  if (version !== 'v2' || extra !== undefined || !/^[a-f0-9]{24}$/.test(iv ?? '') ||
      !/^[a-f0-9]{32}$/.test(tag ?? '') || !/^(?:[a-f0-9]{2})+$/.test(ciphertext ?? '')) {
    throw new Error('Invalid credential envelope');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'hex'));
  decipher.setAAD(Buffer.from(`youthmenu:credentials:v2:${creationKeyHash}`));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  const decoded: unknown = JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final(),
  ]).toString('utf8'));
  if (!decoded || typeof decoded !== 'object' || !('pickupToken' in decoded) || !('customerAccessToken' in decoded) ||
      !isOrderToken(decoded.pickupToken) || !isOrderToken(decoded.customerAccessToken)) {
    throw new Error('Invalid encrypted credentials');
  }
  return { pickupToken: decoded.pickupToken, customerAccessToken: decoded.customerAccessToken };
}
