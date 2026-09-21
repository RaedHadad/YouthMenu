import { createHmac, randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertCredentialConfiguration, generateOrderCredentials, generateVisibleCode, hashOrderToken, isOrderToken, openCredentials, sealCredentials, verifyOrderToken } from '@/lib/orders/credentials';

beforeEach(() => vi.stubEnv('ORDER_TOKEN_ENCRYPTION_KEY', randomBytes(32).toString('hex')));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('server-generated order credentials', () => {
  it('generates independent 256-bit tokens and readable codes without Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Insecure RNG'); });
    const seen = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      const credentials = generateOrderCredentials();
      expect(isOrderToken(credentials.pickupToken)).toBe(true);
      expect(isOrderToken(credentials.customerAccessToken)).toBe(true);
      expect(credentials.pickupToken).not.toBe(credentials.customerAccessToken);
      seen.add(credentials.pickupToken); seen.add(credentials.customerAccessToken);
      expect(generateVisibleCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    }
    expect(seen.size).toBe(200);
  });

  it('separates access, pickup and retry credential hashes', () => {
    const token = generateOrderCredentials().pickupToken;
    const access = hashOrderToken(token, 'access');
    expect(access).not.toBe(hashOrderToken(token, 'pickup'));
    expect(access).not.toBe(hashOrderToken(token, 'creation'));
    expect(verifyOrderToken(token, access, 'access', 2)).toBe(true);
    expect(verifyOrderToken(token, access, 'pickup', 2)).toBe(false);
    expect(verifyOrderToken('A7KD92', access, 'access', 2)).toBe(false);
    expect(verifyOrderToken(token, '', 'access', 2)).toBe(false);
    expect(verifyOrderToken(token, access, 'access', 99)).toBe(false);
  });

  it('is independent of the admin session secret for new orders', () => {
    const token = generateOrderCredentials().customerAccessToken;
    vi.stubEnv('SESSION_SECRET', 'old');
    const hash = hashOrderToken(token, 'access');
    vi.stubEnv('SESSION_SECRET', 'new');
    expect(verifyOrderToken(token, hash, 'access', 2)).toBe(true);
  });

  it('only verifies legacy HMAC tokens with an explicitly configured secret', () => {
    const token = generateOrderCredentials().customerAccessToken;
    const secret = randomBytes(32).toString('hex');
    const hash = createHmac('sha256', secret).update(token).digest('hex');
    vi.stubEnv('SESSION_SECRET', secret);
    expect(verifyOrderToken(token, hash, 'access', 1)).toBe(true);
    vi.stubEnv('SESSION_SECRET', '');
    expect(verifyOrderToken(token, hash, 'access', 1)).toBe(false);
  });

  it('encrypts retry credentials with fresh IVs and restores the same tokens', () => {
    const credentials = generateOrderCredentials();
    const keyHash = hashOrderToken(randomBytes(32).toString('hex'), 'creation');
    const first = sealCredentials(credentials, keyHash);
    const second = sealCredentials(credentials, keyHash);
    expect(first).not.toBe(second);
    expect(first).not.toContain(credentials.pickupToken);
    expect(first).not.toContain(credentials.customerAccessToken);
    expect(openCredentials(first, keyHash)).toEqual(credentials);
  });

  it('rejects tampering, swapped records and the wrong encryption key', () => {
    const keyHash = hashOrderToken(randomBytes(32).toString('hex'), 'creation');
    const encrypted = sealCredentials(generateOrderCredentials(), keyHash);
    const replacement = encrypted.endsWith('0') ? '1' : '0';
    expect(() => openCredentials(encrypted.slice(0, -1) + replacement, keyHash)).toThrow();
    expect(() => openCredentials(encrypted, 'different-record')).toThrow();
    vi.stubEnv('ORDER_TOKEN_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
    expect(() => openCredentials(encrypted, keyHash)).toThrow();
  });

  it.each(['', 'development-secret', 'a'.repeat(63), 'z'.repeat(64)])('fails closed for invalid encryption configuration: %s', (key) => {
    vi.stubEnv('ORDER_TOKEN_ENCRYPTION_KEY', key);
    expect(() => assertCredentialConfiguration()).toThrow();
  });
});
