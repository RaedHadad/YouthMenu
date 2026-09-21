import { requireAdminPage } from '@/lib/auth';
import QRScannerPage from '@/components/qr-scanner';

export default async function ScannerPage() {
  await requireAdminPage();

  return <QRScannerPage />;
}
