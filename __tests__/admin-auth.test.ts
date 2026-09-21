import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionCookieOptions, validSessionToken } from '@/lib/admin/session';
import { requireAdminOrigin } from '@/lib/admin/http';
import { adminLoginSchema } from '@/lib/validation';

afterEach(() => vi.unstubAllEnvs());
describe('admin authentication boundaries', () => {
  it('uses HTTPS-only, private, same-site cookies with bounded lifetime in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(sessionCookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 28800 });
  });
  it('rejects old signed payloads, truncated tokens and malformed session values', () => {
    for (const token of [undefined, '', 'payload.signature', 'a'.repeat(63), 'g'.repeat(64), 'A'.repeat(64)]) expect(validSessionToken(token)).toBe(false);
    expect(validSessionToken('a'.repeat(64))).toBe(true);
  });
  it('checks the configured origin, ignoring forwarded host spoofing', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://menu.example');
    expect(() => requireAdminOrigin(new Request('http://internal/login', { headers: { Origin: 'https://menu.example' } }))).not.toThrow();
    for (const origin of ['null', 'https://evil.example', '']) {
      expect(() => requireAdminOrigin(new Request('http://internal/login', { headers: { Origin: origin, 'x-forwarded-host': 'evil.example' } }))).toThrow();
    }
  });
  it('normalizes email and rejects unknown fields and bcrypt byte truncation', () => {
    expect(adminLoginSchema.parse({ email: ' ADMIN@example.com ', password: 'abc' }).email).toBe('admin@example.com');
    expect(adminLoginSchema.safeParse({ email: 'a@example.com', password: 'أ'.repeat(37) }).success).toBe(false);
    expect(adminLoginSchema.safeParse({ email: 'a@example.com', password: 'abc', role: 'admin' }).success).toBe(false);
  });
});
