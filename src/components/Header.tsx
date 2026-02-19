"use client";

import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

const CheckIcon = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="11" fill="#3D8B5F" />
    <path d="M7 12.5l3 3 7-7" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const UsersIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1A2744" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const DownloadIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1A2744" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function Header() {
  const { user } = useAuth();
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [streak] = useState(0);

  // Buscar role do usuário quando user mudar
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        return;
      }

      try {
        setRoleLoading(true);
        
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) {
          console.warn('⚠️ Header: Erro ao buscar perfil:', error);
          setUserRole('user');
        } else {
          setUserRole(profile?.role || 'user');
        }
      } catch (error) {
        console.error('❌ Header: Erro ao buscar role:', error);
        setUserRole('user');
      } finally {
        setRoleLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  const isAdmin = userRole === 'admin';
  const initial = user?.user_metadata?.name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?';

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-5 py-2.5"
      style={{ background: '#FAFAF7' }}
    >
      {!user ? (
        <>
          <Link href="/hoje" className="text-[19px] font-semibold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#1A2744' }}>
            agapefy
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/login')}
              className="text-[13px] font-semibold cursor-pointer bg-transparent border-none"
              style={{ fontFamily: "'Source Sans 3', sans-serif", color: '#1A2744' }}
            >
              Entrar
            </button>
            <button
              onClick={() => router.push('/login')}
              className="text-[12px] font-semibold cursor-pointer border-none text-white rounded-full"
              style={{ fontFamily: "'Source Sans 3', sans-serif", background: '#B8924A', padding: '7px 16px' }}
            >
              Experimente
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => router.push('/eu')}
              className="flex items-center justify-center border-none cursor-pointer"
              style={{
                width: 34, height: 34, borderRadius: '50%', background: '#F5F0E8',
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 15, fontWeight: 700, color: '#1A2744',
              }}
            >
              {initial}
            </button>
            <Link href="/hoje" className="text-[19px] font-semibold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#1A2744' }}>
              agapefy
            </Link>
          </div>

          <div className="flex items-center gap-1.5">
            {!installed && !!deferredPrompt && (
              <button
                onClick={handleInstall}
                className="flex items-center justify-center border-none cursor-pointer"
                style={{ width: 34, height: 34, borderRadius: '50%', background: '#F5F0E8' }}
                aria-label="Instalar aplicativo"
              >
                <DownloadIcon size={16} />
              </button>
            )}

            <button
              onClick={() => router.push('/hoje')}
              className="flex items-center border-none cursor-pointer"
              style={{ gap: 4, padding: '5px 10px', background: '#F5F0E8', borderRadius: 18 }}
              aria-label="Sequência"
            >
              <CheckIcon size={17} />
              <span className="text-[13px] font-bold" style={{ fontFamily: "'Source Sans 3', sans-serif", color: '#1A2744' }}>
                {streak}
              </span>
            </button>

            <button
              onClick={() => router.push('/amigos')}
              className="flex items-center justify-center border-none cursor-pointer"
              style={{ width: 34, height: 34, borderRadius: '50%', background: '#F5F0E8' }}
              aria-label="Amigos"
            >
              <UsersIcon size={15} />
            </button>

            {isAdmin && !roleLoading && (
              <button
                onClick={() => router.push('/admin')}
                className="border-none cursor-pointer rounded-full px-3 py-1 text-xs font-semibold"
                style={{ fontFamily: "'Source Sans 3', sans-serif", background: '#F5F0E8', color: '#1A2744' }}
              >
                Admin
              </button>
            )}
          </div>
        </>
      )}
    </header>
  );
}
