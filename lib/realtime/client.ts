import { Realtime, type TokenRequest } from 'ably';
import { KITCHEN_CHANNEL, ORDER_EVENT } from './config';

export function connectKitchen(onChange: () => void, onState: (live: boolean) => void, onUnauthorized: () => void) {
  const client = new Realtime({ autoConnect: false, authCallback: async (_params, callback) => {
    try {
      const response = await fetch('/api/admin/realtime-token', { method: 'POST', cache: 'no-store' });
      if (response.status === 401) onUnauthorized();
      if (!response.ok) { callback('Realtime authentication unavailable', null); return; }
      callback(null, await response.json() as TokenRequest);
    } catch { callback('Realtime connection unavailable', null); }
  } });
  const channel = client.channels.get(KITCHEN_CHANNEL);
  client.connection.on((change) => {
    onState(change.current === 'connected' && channel.state === 'attached');
  });
  channel.on((change) => {
    onState(change.current === 'attached' && client.connection.state === 'connected');
    if (change.current === 'attached') onChange();
  });
  void channel.subscribe(ORDER_EVENT, onChange).catch(() => onState(false));
  client.connect();
  return () => { channel.unsubscribe(); client.close(); };
}
