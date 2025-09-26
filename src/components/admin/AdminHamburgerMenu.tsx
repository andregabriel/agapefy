'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { adminRoutes } from './AdminNavigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Organizando rotas em grupos lógicos
const adminRouteGroups = [
  {
    title: 'Dashboard',
    routes: adminRoutes.filter(route => route.href === '/admin')
  },
  {
    title: 'Conteúdo',
    routes: adminRoutes.filter(route => 
      ['/admin/audios', '/admin/playlists', '/admin/categorias'].includes(route.href)
    )
  },
  {
    title: 'Usuários & Comunidade',
    routes: adminRoutes.filter(route => 
      ['/admin/usuarios', '/admin/community-analytics'].includes(route.href)
    )
  },
  {
    title: 'Geração por IA',
    routes: adminRoutes.filter(route => 
      ['/admin/gerar-conteudo', '/admin/gerar-lote', '/admin/gerar-serie'].includes(route.href)
    )
  },
  {
    title: 'Analytics & Dados',
    routes: adminRoutes.filter(route => 
      ['/admin/analytics', '/admin/nps'].includes(route.href)
    )
  },
  {
    title: 'Comunicação',
    routes: adminRoutes.filter(route => 
      ['/admin/whatsapp', '/admin/whatsIA', '/admin/webhook-test'].includes(route.href)
    )
  },
  {
    title: 'Sistema',
    routes: adminRoutes.filter(route => 
      ['/admin/configuracoes', '/admin/setup', '/admin/testes'].includes(route.href)
    )
  },
  {
    title: 'Legal',
    routes: adminRoutes.filter(route => 
      ['/admin/documentos-legais'].includes(route.href)
    )
  }
];

export default function AdminHamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="bg-[#111827] border-gray-600 text-white hover:bg-gray-700 hover:text-white"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menu de navegação</span>
        </Button>
      </SheetTrigger>
      
      <SheetContent side="left" className="w-80 bg-[#111827] border-gray-700 flex flex-col">
        <SheetHeader className="border-b border-gray-700 pb-4 flex-shrink-0">
          <SheetTitle className="text-white text-xl font-bold text-left">
            Admin Panel
          </SheetTitle>
        </SheetHeader>
        
        {/* Área com scroll */}
        <div className="flex-1 overflow-y-auto mt-6 pr-2">
          <div className="space-y-6">
            {adminRouteGroups.map((group, groupIndex) => (
              <div key={groupIndex} className="space-y-2">
                {/* Título do grupo */}
                <div className="px-3 py-1">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {group.title}
                  </h3>
                </div>
                
                {/* Links do grupo */}
                <div className="space-y-1">
                  {group.routes.map((route) => (
                    <Link
                      key={route.href}
                      href={route.href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        'text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition',
                        pathname === route.href ? 'text-white bg-white/10' : 'text-zinc-400'
                      )}
                    >
                      <div className="flex items-center flex-1">
                        <route.icon className={cn('h-4 w-4 mr-3', route.color)} />
                        {route.label}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer fixo */}
        <div className="border-t border-gray-700 pt-4 flex-shrink-0">
          <div className="text-xs text-gray-500 text-center">
            {adminRoutes.length} páginas administrativas
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}