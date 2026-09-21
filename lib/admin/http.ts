export class AdminHttpError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export const privateHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
export function adminJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: privateHeaders });
}
export function adminError(error: unknown) {
  if (error instanceof AdminHttpError) return adminJson({ message: error.message }, error.status);
  return adminJson({ message: 'تعذر الاتصال بالخادم، حاول مرة أخرى' }, 503);
}
export function requireAdminOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured && process.env.NODE_ENV === 'production') throw new Error('Public origin is not configured');
  const origin = new URL(configured || request.url).origin;
  if (request.headers.get('origin') !== origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    throw new AdminHttpError('طلب غير مسموح', 403);
  }
}

export async function readAdminJson(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new AdminHttpError('يرجى إرسال البيانات بصيغة JSON', 415);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AdminHttpError('بيانات غير صالحة', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new AdminHttpError('حجم الطلب أكبر من المسموح', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { throw new AdminHttpError('بيانات غير صالحة', 400); }
}
