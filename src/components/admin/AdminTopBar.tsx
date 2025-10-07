'use client';

import AdminHamburgerMenu from './AdminHamburgerMenu';
import AdminHorizontalMenu from './AdminHorizontalMenu';
import { usePathname } from 'next/navigation';
import { adminRoutes } from './AdminNavigation';

export default function AdminTopBar() {
  const pathname = usePathname();
  const current = adminRoutes.find((r) => r.href === pathname);
  const title = current?.label || 'Dashboard Admin';

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center py-4 gap-4">
          <div className="flex items-center space-x-4 shrink-0">
            <AdminHamburgerMenu />
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          </div>
          <div className="flex-1 min-w-0">
            <AdminHorizontalMenu />
          </div>
          <div className="text-sm text-gray-500 shrink-0">
            Painel de controle administrativo
          </div>
        </div>
      </div>
    </div>
  );
}


