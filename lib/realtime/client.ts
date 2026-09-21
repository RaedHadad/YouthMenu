import { Realtime, type TokenRequest } from 'ably';
import { KITCHEN_CHANNEL, ORDER_EVENT, orderChannel } from './config';

export function connectKitchen(onChange: () => void, onState: (live: boolean) => void, onUnauthorized: () => void) {
  return connectChannel(KITCHEN_CHANNEL, '/api/admin/realtime-token', {}, onChange, onState, onUnauthorized);
}

export function connectCustomer(id: string, token: string, onChange: () => void, onState: (live: boolean) => void) {
  return connectChannel(orderChannel(id), `/api/orders/${encodeURIComponent(id)}/realtime-token`,
    { Authorization: `Bearer ${token}` }, onChange, onState, () => onState(false));
}

function connectChannel(channelName: string, url: string, headers: Record<string, string>, onChange: () => void, onState: (live: boolean) => void, onUnauthorized: () => void) {
  const client = new Realtime({ autoConnect: false, authCallback: async (_params, callback) => {
    try {
      const response = await fetch(url, { method: 'POST', cache: 'no-store', headers });
      if (response.status === 401) onUnauthorized();
      if (!response.ok) { callback('Realtime authentication unavailable', null); return; }
      callback(null, await response.json() as TokenRequest);
    } catch { callback('Realtime connection unavailable', null); }
  } });
  const channel = client.channels.get(channelName);
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
