'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { adminRoutes } from './AdminNavigation';

type AdminRoute = (typeof adminRoutes)[number];

// Mantém a mesma organização visual do menu hambúrguer
const adminRouteGroups: { title: string; routes: AdminRoute[] }[] = [
  {
    title: 'Principal',
    routes: [
      adminRoutes.find((r) => r.href === '/admin'),
      adminRoutes.find((r) => r.href === '/admin/community-analytics'),
      adminRoutes.find((r) => r.href === '/admin/analytics'),
      adminRoutes.find((r) => r.href === '/admin/nps'),
    ].filter(Boolean) as AdminRoute[],
  },
  {
    title: 'Sistema',
    routes: [
      adminRoutes.find((r) => r.href === '/admin/usuarios'),
      adminRoutes.find((r) => r.href === '/admin/configuracoes'),
      adminRoutes.find((r) => r.href === '/admin/onboarding'),
    ].filter(Boolean) as AdminRoute[],
  },
  {
    title: 'Conteúdo',
    routes: [
      adminRoutes.find((r) => r.href === '/admin/audios'),
      adminRoutes.find((r) => r.href === '/admin/categorias'),
      adminRoutes.find((r) => r.href === '/admin/playlists'),
    ].filter(Boolean) as AdminRoute[],
  },
  {
    title: 'Geração por IA',
    routes: [
      adminRoutes.find((r) => r.href === '/admin/go'),
      adminRoutes.find((r) => r.href === '/admin/gerar-lote'),
      adminRoutes.find((r) => r.href === '/admin/gerar-serie'),
      adminRoutes.find((r) => r.href === '/admin/gm'),
    ].filter(Boolean) as AdminRoute[],
  },
  {
    title: 'Whatsapp',
    routes: [
      adminRoutes.find((r) => r.href === '/admin/whatsapp'),
      adminRoutes.find((r) => r.href === '/admin/setup'),
    ].filter(Boolean) as AdminRoute[],
  },
  {
    title: 'Legal',
    routes: [adminRoutes.find((r) => r.href === '/admin/documentos-legais')].filter(Boolean) as AdminRoute[],
  },
];

// Mesmas renomeações utilizadas no menu hambúrguer
const labelOverrides: Record<string, string> = {
  '/admin/whatsapp': 'Gerenciador da IA',
};

export default function AdminHorizontalMenu() {
  const pathname = usePathname();

  // Achatar em uma lista preservando a ordem dos grupos
  const orderedRoutes = adminRouteGroups.flatMap((g) => g.routes);

  return (
    <nav className="flex items-center gap-1 overflow-x-auto overflow-y-hidden whitespace-nowrap px-2 scrollbar-hide">
      {orderedRoutes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            'px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-gray-100 text-gray-600',
            pathname === route.href && 'bg-gray-100 text-gray-900 font-medium'
          )}
        >
          {labelOverrides[route.href] ?? route.label}
        </Link>
      ))}
    </nav>
  );
}


