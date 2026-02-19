"use client";

import { Book, User, Sun } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

// Ícone customizado do WhatsApp (bolha + handset), usando currentColor
const WhatsAppIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Bolha */}
    <path
      d="M21 11.5c0 4.694-3.89 8.5-8.69 8.5-1.56 0-3.02-.39-4.28-1.08L3 20.5l1.65-4.72A8.33 8.33 0 0 1 3.62 11.5C3.62 6.806 7.51 3 12.31 3 17.11 3 21 6.806 21 11.5Z"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Handset */}
    <path
      d="M10.9 7.9l-.6 1.4c-.2.5-.1 1.1.3 1.5l.9 1c.4.4 1 .5 1.5.3l1.4-.6c.4-.2.9 0 1.1.4l.6 1.2c.2.4.1.9-.2 1.2-.9.9-2.2 1.4-3.5 1.2-2.4-.3-4.8-2.7-5.1-5.1-.2-1.3.3-2.6 1.2-3.5.3-.3.8-.4 1.2-.2l1.2.6c.4.2.6.7.4 1.1Z"
      fill="currentColor"
    />
  </svg>
);

const PrayerIcon = ({ size = 24 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2C12 2 9 7 9 10c0 1.5.5 2.5 1.5 3.2L9 22h6l-1.5-8.8c1-.7 1.5-1.7 1.5-3.2 0-3-3-8-3-8z" />
    <path d="M9.5 10c0-2 1-4.5 2.5-7 1.5 2.5 2.5 5 2.5 7" />
  </svg>
);

const navItems = [
  { href: '/hoje', icon: Sun, label: 'Hoje' },
  { href: '/home', icon: PrayerIcon, label: 'Orações' },
  { href: '/biblia', icon: Book, label: 'Bíblia' },
  { href: '/whatsapp', icon: WhatsAppIcon, label: 'WhatsApp' },
  { href: '/eu', icon: User, label: 'Você' },
];

export const BottomNavigation = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  const navRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const root = document.documentElement;
    const setVar = () => {
      const { height } = nav.getBoundingClientRect();
      root.style.setProperty('--tabbar-h', `${height}px`);
    };

    setVar();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', setVar);
      return () => window.removeEventListener('resize', setVar);
    }

    const observer = new ResizeObserver(() => setVar());
    observer.observe(nav);

    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={navRef}
      className="fixed bottom-0 left-0 right-0 bg-black border-t border-gray-800 z-40"
    >
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
                  ? href === '/hoje' ? "text-[#B8924A]" : "text-green-500"
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
