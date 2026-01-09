"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Share2 } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua);
}

function isSafariOnIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  if (!isIos) return false;
  // iOS browsers include their own tokens:
  // - Chrome: crios
  // - Firefox: fxios
  // - Edge: edgios
  const isOtherBrowser = /crios|fxios|edgios/.test(ua);
  const isSafari = /safari/.test(ua);
  return isSafari && !isOtherBrowser;
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as any;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || nav.standalone === true;
}

export function InstallAppCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  const isIos = useMemo(() => isIosDevice(), []);
  const isIosSafari = useMemo(() => isSafariOnIos(), []);

  useEffect(() => {
    setInstalled(isInStandaloneMode());

    function onBeforeInstallPrompt(e: Event) {
      // Android/Chrome: capture prompt so we can trigger via button.
      e.preventDefault?.();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }

    function onAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as any);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const canShowAndroidInstall = !!deferredPrompt && !installed;
  const canShowIosHelp = isIos && !installed;

  async function handleAndroidInstall() {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      // Regardless of choice, Chrome may not re-fire immediately.
      setDeferredPrompt(null);
    }
  }

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white font-medium text-lg">Instalar app</CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              Adicione um ícone no seu celular e abra em tela cheia
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="border-t border-gray-800 pt-4 space-y-3">
          {installed ? (
            <p className="text-sm text-emerald-300">
              Já instalado neste dispositivo.
            </p>
          ) : canShowAndroidInstall ? (
            <Button
              onClick={handleAndroidInstall}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Instalar agora
            </Button>
          ) : canShowIosHelp ? (
            <>
              <Button
                onClick={() => setIosHelpOpen(true)}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Instalar App
              </Button>
              <Dialog open={iosHelpOpen} onOpenChange={setIosHelpOpen}>
                <DialogContent className="bg-gray-950 border-gray-800 text-white">
                  <DialogHeader>
                    <DialogTitle>Como instalar no iPhone (Safari)</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-2 text-sm text-gray-300">
                    <p>
                      1) {isIosSafari ? (
                        <>
                          Você já está no <span className="text-white font-medium">Safari</span>.
                        </>
                      ) : (
                        <>
                          Abra este site no <span className="text-white font-medium">Safari</span> (no iPhone, o Chrome não instala o app).
                        </>
                      )}
                    </p>
                    <p>
                      2) Toque em <span className="text-white font-medium">Compartilhar</span>.
                    </p>
                    <p>
                      3) Escolha <span className="text-white font-medium">Adicionar à Tela de Início</span>.
                    </p>
                    <p className="text-xs text-gray-400 pt-2">
                      Observação: o iOS não permite abrir o prompt de instalação automaticamente por botão.
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <div className="space-y-2">
              <Button disabled className="w-full">
                Instalar (indisponível)
              </Button>
              <p className="text-xs text-gray-400">
                Para instalar, abra pelo navegador do celular (Chrome no Android ou Safari no iPhone).
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

