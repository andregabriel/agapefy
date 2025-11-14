'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Music, 
  Users, 
  Settings,
  MessageCircle,
  BookOpen,
  BarChart3,
  FileText,
  Sparkles,
  Package,
  PlayCircle,
  Star,
  Wrench,
  TestTube,
  Webhook,
  MessageSquare,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';

const adminRoutes = [
  {
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/admin',
    color: 'text-sky-500'
  },
  {
    label: 'Permissões',
    icon: ShieldCheck,
    href: '/admin/permissoes',
    color: 'text-amber-600'
  },
  {
    label: 'Analytics',
    icon: BarChart3,
    href: '/admin/analytics',
    color: 'text-blue-500'
  },
  {
    label: 'Áudios',
    icon: Music,
    href: '/admin/audios',
    color: 'text-violet-500'
  },
  {
    label: 'Categorias',
    icon: BookOpen,
    href: '/admin/categorias',
    color: 'text-orange-700'
  },
  {
    label: 'Community Analytics',
    icon: TrendingUp,
    href: '/admin/community-analytics',
    color: 'text-emerald-500'
  },
  {
    label: 'Configurações',
    icon: Settings,
    href: '/admin/configuracoes',
    color: 'text-gray-500'
  },
  {
    label: 'Onboarding',
    icon: FileText,
    href: '/admin/onboarding',
    color: 'text-sky-500'
  },
  {
    label: 'Documentos Legais',
    icon: FileText,
    href: '/admin/documentos-legais',
    color: 'text-red-500'
  },
  {
    label: 'Gerar Oração',
    icon: Sparkles,
    href: '/admin/go',
    color: 'text-yellow-500'
  },
  {
    label: 'Gerar Lote',
    icon: Package,
    href: '/admin/gerar-lote',
    color: 'text-purple-500'
  },
  {
    label: 'Gerar Série',
    icon: PlayCircle,
    href: '/admin/gerar-serie',
    color: 'text-pink-500'
  },
  {
    label: 'NPS',
    icon: Star,
    href: '/admin/nps',
    color: 'text-amber-500'
  },
  {
    label: 'Feedbacks',
    icon: MessageCircle,
    href: '/admin/feedback',
    color: 'text-indigo-500'
  },
  {
    label: 'Playlists',
    icon: BookOpen,
    href: '/admin/playlists',
    color: 'text-pink-700'
  },
  {
    label: 'Setup',
    icon: Wrench,
    href: '/admin/setup',
    color: 'text-indigo-500'
  },
  {
    label: 'Testes',
    icon: TestTube,
    href: '/admin/testes',
    color: 'text-green-500'
  },
  {
    label: 'Usuários',
    icon: Users,
    href: '/admin/usuarios',
    color: 'text-emerald-500'
  },
  {
    label: 'Webhook Test',
    icon: Webhook,
    href: '/admin/webhook-test',
    color: 'text-cyan-500'
  },
  {
    label: 'WhatsApp IA',
    icon: MessageSquare,
    href: '/admin/whatsIA',
    color: 'text-green-400'
  },
  {
    label: 'WhatsApp',
    icon: MessageCircle,
    href: '/admin/whatsapp',
    color: 'text-green-600'
  }
];

export default function AdminNavigation() {
  const pathname = usePathname();

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-[#111827] text-white">
      <div className="px-3 py-2 flex-1">
        <Link href="/admin" className="flex items-center pl-3 mb-14">
          <h1 className="text-2xl font-bold">
            Admin Panel
          </h1>
        </Link>
        <div className="space-y-1">
          {adminRoutes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                'text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition',
                pathname === route.href ? 'text-white bg-white/10' : 'text-zinc-400'
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon className={cn('h-5 w-5 mr-3', route.color)} />
                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

// Export das rotas para uso em outros componentes
export { adminRoutes };