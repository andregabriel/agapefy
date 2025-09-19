"use client";

import { Home, Search, Book, Users, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', icon: Home, label: 'Início' },
  { href: '/busca', icon: Search, label: 'Buscar' },
  { href: '/biblia', icon: Book, label: 'Bíblia' },
  { href: '/amigos', icon: Users, label: 'Amigos' },
  { href: '/eu', icon: User, label: 'Você' },
];

export const BottomNavigation = () => {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-40">
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          const isProfileTab = href === '/eu';
          
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center py-2 px-3 rounded-lg transition-colors",
                isActive 
                  ? "text-green-500" 
                  : "text-gray-400 hover:text-white"
              )}
            >
              {/* Ícone ou Avatar */}
              {isProfileTab && user ? (
                <Avatar className="w-6 h-6">
                  <AvatarImage 
                    src={user.user_metadata?.avatar_url} 
                    alt="Perfil"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-gray-700 text-white text-xs">
                    {user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <Icon 
                  size={24} 
                  style={{ pointerEvents: 'none' }}
                  data-no-clone="true"
                />
              )}
              
              <span 
                className="text-xs mt-1"
                style={{ pointerEvents: 'none' }}
                data-no-clone="true"
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};