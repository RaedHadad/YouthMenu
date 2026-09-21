import { AdminNavigation } from '@/components/admin-navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><AdminNavigation />{children}</>;
}
