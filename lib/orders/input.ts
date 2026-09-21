import { createOrderSchema, type CreateOrderInput } from '../validation';
import { MAX_ORDER_BODY_BYTES } from '../order-limits';
import { OrderRequestError } from './errors';

export function parseOrderInput(value: unknown): CreateOrderInput {
  const result = createOrderSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new OrderRequestError(issue?.code === 'unrecognized_keys'
      ? 'لا يمكن إرسال أسعار أو حقول إضافية مع الطلب'
      : issue?.message ?? 'بيانات الطلب غير صالحة');
  }
  return result.data;
}

/** Count actual bytes, not only the client-supplied Content-Length header. */
export async function readOrderInput(request: Request): Promise<CreateOrderInput> {
  const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new OrderRequestError('يرجى إرسال بيانات الطلب بصيغة JSON', 415);
  }
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && Number(declaredLength) > MAX_ORDER_BODY_BYTES) {
    throw new OrderRequestError('حجم الطلب أكبر من المسموح', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new OrderRequestError('بيانات الطلب غير صالحة');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ORDER_BODY_BYTES) {
        await reader.cancel();
        throw new OrderRequestError('حجم الطلب أكبر من المسموح', 413);
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof OrderRequestError) throw error;
    throw new OrderRequestError('تعذر قراءة بيانات الطلب');
  } finally {
    reader.releaseLock();
  }
  let value: unknown;
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new OrderRequestError('بيانات الطلب غير صالحة');
  }
  return parseOrderInput(value);
}
