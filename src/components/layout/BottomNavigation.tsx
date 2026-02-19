"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useLayoutEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
const TabSunIcon = ({ size = 22, color = '#9A9A9A' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" /><line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" /><line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
  </svg>
);

const TabCandleIcon = ({ size = 22, color = '#9A9A9A' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="12" width="6" height="10" rx="1.5" />
    <line x1="12" y1="12" x2="12" y2="9" />
    <path d="M12 2c-1.5 2-2.5 3.5-2.5 5a2.5 2.5 0 0 0 5 0C14.5 5.5 13.5 4 12 2z" fill={color} stroke="none" />
  </svg>
);

const TabBookIcon = ({ size = 22, color = '#9A9A9A' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const TabWhatsAppIcon = ({ size = 22, color = '#9A9A9A' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const TabUserIcon = ({ size = 22, color = '#9A9A9A' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21a8 8 0 0 0-16 0" />
    <circle cx="12" cy="8" r="4" />
  </svg>
);

const tabs = [
  { id: 'hoje', label: 'Hoje', icon: TabSunIcon, route: '/hoje', activeColor: '#B8924A' },
  { id: 'oracoes', label: 'Orações', icon: TabCandleIcon, route: '/home', activeColor: '#B8924A' },
  { id: 'biblia', label: 'Bíblia', icon: TabBookIcon, route: '/biblia', activeColor: '#B8924A' },
  { id: 'whatsapp', label: 'WhatsApp', icon: TabWhatsAppIcon, route: '/whatsapp', activeColor: '#25D366' },
  { id: 'voce', label: 'Você', icon: TabUserIcon, route: '/eu', activeColor: '#B8924A' },
];

export const BottomNavigation = () => {
  const pathname = usePathname();
  const router = useRouter();
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
      className="fixed bottom-0 left-0 right-0 z-50 flex items-start justify-around"
      style={{
        background: '#FFFFFF',
        borderTop: '1px solid #EEEBE5',
        padding: '8px 0 22px',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.route === '/home'
          ? pathname === '/home' || pathname === '/'
          : pathname === tab.route || pathname?.startsWith(`${tab.route}/`);
        const color = isActive ? tab.activeColor : '#9A9A9A';
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => router.push(tab.route)}
            className="flex flex-col items-center border-none bg-transparent cursor-pointer"
            style={{ padding: '0 8px', gap: 3 }}
          >
            {tab.route === '/eu' && user ? (
              <Avatar className="w-[22px] h-[22px]">
                <AvatarImage
                  src={user.user_metadata?.avatar_url}
                  alt="Perfil"
                  className="object-cover"
                />
                <AvatarFallback className="bg-[#F5F0E8] text-[#1A2744] text-[10px]">
                  {user.email?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Icon size={22} color={color} />
            )}
            <span
              className="text-[10px] font-semibold"
              style={{
                fontFamily: "'Source Sans 3', sans-serif",
                color,
                letterSpacing: 0.2,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
