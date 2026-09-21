import { requireAdmin } from '@/lib/auth';
import { adminError, adminJson } from '@/lib/admin/http';
import { adminRealtimeToken, realtimeConfigured } from '@/lib/realtime/server';

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    if (!realtimeConfigured()) return adminJson({ message: 'التحديث الدوري متاح' }, 503);
    return adminJson(await adminRealtimeToken(admin.id));
  } catch (error) { return adminError(error); }
}
