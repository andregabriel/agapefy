"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PaywallShowcase = dynamic(
  () => import('@/components/paywall/PaywallShowcase').then(mod => mod.PaywallShowcase),
  { ssr: false }
);

export function PaywallModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;

    const handler = () => {
      setIsOpen(true);
    };

    window.addEventListener('agapefy:paywall-open', handler as EventListener);
    return () => {
      window.removeEventListener('agapefy:paywall-open', handler as EventListener);
    };
  }, []);

  if (!mounted) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent
        className="
          bg-white text-black p-0 overflow-hidden gap-0
          fixed left-0 top-0 translate-x-0 translate-y-0
          w-full max-w-none h-[100svh] border-0 rounded-none
          sm:left-1/2 sm:top-1/2 sm:translate-x-[-50%] sm:translate-y-[-50%]
          sm:w-full sm:max-w-md sm:h-auto sm:rounded-3xl sm:border sm:border-gray-200
        "
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Tela de assinatura</DialogTitle>
        </DialogHeader>
        <PaywallShowcase variant="modal" onClose={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
