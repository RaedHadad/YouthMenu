import { afterEach, expect, it, vi } from 'vitest';
import { adminRealtimeToken, realtimeConfigured } from '@/lib/realtime/server';
import { KITCHEN_CHANNEL, ADMIN_REALTIME_TTL } from '@/lib/realtime/config';

afterEach(() => vi.unstubAllEnvs());
it('signs only a short-lived kitchen subscribe capability using the server key', async () => {
  vi.stubEnv('ABLY_API_KEY', 'test.key:local-test-secret');
  const token = await adminRealtimeToken('admin-id');
  expect(JSON.parse(token.capability!)).toEqual({ [KITCHEN_CHANNEL]: ['subscribe'] });
  expect(token.ttl).toBe(ADMIN_REALTIME_TTL);
  expect(token.clientId).toBe('admin:admin-id');
  expect(token.mac).toBeTruthy();
  expect(JSON.stringify(token)).not.toContain('local-test-secret');
});
it('fails safely when no provider key is configured', async () => {
  vi.stubEnv('ABLY_API_KEY', '');
  expect(realtimeConfigured()).toBe(false);
  await expect(adminRealtimeToken('admin-id')).rejects.toThrow();
});
