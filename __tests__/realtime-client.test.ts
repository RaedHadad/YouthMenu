import { afterEach, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({
  auth: undefined as undefined | ((params: object, callback: (error: string | null, token: unknown) => void) => Promise<void>),
  connectionListener: undefined as undefined | ((event: { current: string }) => void),
  channelListener: undefined as undefined | ((event: { current: string }) => void),
  messageListener: undefined as undefined | (() => void),
  close: vi.fn(), unsubscribe: vi.fn(),
}));
vi.mock('ably', () => ({ Realtime: class {
  constructor(options: { authCallback: typeof fake.auth }) { fake.auth = options.authCallback; }
  connection = { state: 'connected', on: (listener: typeof fake.connectionListener) => { fake.connectionListener = listener; } };
  channels = { get: () => ({ state: 'attached', on: (listener: typeof fake.channelListener) => { fake.channelListener = listener; },
    subscribe: async (_name: string, listener: () => void) => { fake.messageListener = listener; }, unsubscribe: fake.unsubscribe }) };
  connect() {}
  close = fake.close;
} }));
import { connectKitchen } from '@/lib/realtime/client';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('refreshes snapshots for messages and channel reattachment, reports disconnect and closes on cleanup', () => {
  const refresh = vi.fn();
  const state = vi.fn();
  const cleanup = connectKitchen(refresh, state, vi.fn());
  fake.messageListener!();
  fake.channelListener!({ current: 'attached' });
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(state).toHaveBeenCalledWith(true);
  fake.connectionListener!({ current: 'disconnected' });
  expect(state).toHaveBeenLastCalledWith(false);
  cleanup();
  expect(fake.unsubscribe).toHaveBeenCalledOnce();
  expect(fake.close).toHaveBeenCalledOnce();
});
it('obtains credentials only through the authenticated endpoint and handles expired sessions', async () => {
  const request = vi.fn().mockResolvedValue(new Response('{}', { status: 401 }));
  vi.stubGlobal('fetch', request);
  const unauthorized = vi.fn();
  const cleanup = connectKitchen(vi.fn(), vi.fn(), unauthorized);
  const callback = vi.fn();
  await fake.auth!({}, callback);
  expect(request).toHaveBeenCalledWith('/api/admin/realtime-token', { method: 'POST', cache: 'no-store', headers: {} });
  expect(unauthorized).toHaveBeenCalledOnce();
  expect(callback).toHaveBeenCalledWith('Realtime authentication unavailable', null);
  cleanup();
});
