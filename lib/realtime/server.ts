import { Rest } from 'ably';
import { ADMIN_REALTIME_TTL, KITCHEN_CHANNEL } from './config';

export function realtimeConfigured() {
  return /^[^:\s]+:[^:\s]+$/.test(process.env.ABLY_API_KEY ?? '');
}
export function ablyRest() {
  if (!realtimeConfigured()) throw new Error('Realtime is not configured');
  return new Rest({ key: process.env.ABLY_API_KEY, httpRequestTimeout: 3000, httpMaxRetryCount: 0 });
}
export async function adminRealtimeToken(adminId: string) {
  return ablyRest().auth.createTokenRequest({ clientId: `admin:${adminId}`, ttl: ADMIN_REALTIME_TTL,
    capability: { [KITCHEN_CHANNEL]: ['subscribe'] } });
}
