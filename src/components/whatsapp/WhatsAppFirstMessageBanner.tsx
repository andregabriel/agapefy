"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

// Banner reutilizável para incentivar o envio da primeira mensagem no WhatsApp.
// Regras de exibição:
// - Usuário autenticado
// - Possui número de WhatsApp salvo (via página /whatsapp)
// - has_sent_first_message === false no banco
// - Enquanto essas condições forem verdadeiras, o banner aparece em qualquer página que o use.

export function WhatsAppFirstMessageBanner() {
  const { user } = useAuth();
  const [phone, setPhone] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState<string>("");
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState<boolean | null>(null);
  const [loadingFirstMessage, setLoadingFirstMessage] = useState<boolean>(true);

  const whatsappFirstMessageUrl =
    "https://api.whatsapp.com/send?phone=5531996302706&text=Ol%C3%A1%2C%20gostaria%20de%20come%C3%A7ar%20a%20receber%20minhas%20ora%C3%A7%C3%B5es%20do%20Agapefy.";

  const getLocalStorageKey = () => (user?.id ? `whatsapp_phone_${user.id}` : null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = getLocalStorageKey();
    if (!key) {
      setLoadingFirstMessage(false);
      return;
    }

    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { full?: string; formatted?: string };
        if (parsed.full) setPhone(parsed.full);
        if (parsed.formatted) setPhoneNumber(parsed.formatted);
      }
    } catch (e) {
      console.warn("Erro ao carregar telefone do localStorage (banner home):", e);
    }
  }, [user?.id]);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!user?.id) {
        setLoadingFirstMessage(false);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("whatsapp_users")
          .select("phone_number, has_sent_first_message")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          const msg = error.message || "";
          const code = (error as any).code || "";
          const isSchemaError =
            code === "42703" ||
            code === "42883" ||
            msg.toLowerCase().includes("schema cache") ||
            (msg.toLowerCase().includes("column") && msg.toLowerCase().includes("does not exist"));

          if (isSchemaError) {
            console.warn("Erro de schema ao buscar whatsapp (banner home, ignorado):", error);
            setLoadingFirstMessage(false);
            return;
          }

          console.warn("Erro ao buscar whatsapp (banner home):", error);
          setLoadingFirstMessage(false);
          return;
        }

        if (data?.phone_number) {
          setPhone((prev) => prev || data.phone_number);
        }
        setHasSentFirstMessage(data?.has_sent_first_message ?? false);
        setLoadingFirstMessage(false);
      } catch (e) {
        console.warn("Erro inesperado ao buscar whatsapp (banner home):", e);
        setLoadingFirstMessage(false);
      }
    };

    fetchStatus();
  }, [user?.id]);

  const shouldShow =
    !!user?.id &&
    !loadingFirstMessage &&
    hasSentFirstMessage === false &&
    !!phone &&
    !!phoneNumber;

  if (!shouldShow) return null;

  return (
    <Card className="mb-6 border border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10">
      <CardContent className="pt-6 pb-6 px-5">
        <div className="flex flex-col items-center text-center space-y-5">
          <div className="rounded-full bg-amber-500/10 dark:bg-amber-500/20 p-4">
            <MessageCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
              Ative o recebimento de orações em seu whatsapp
            </h3>
            <p className="text-sm text-amber-700/70 dark:text-amber-300/70 px-2">
              Envie uma primeira mensagem pra Agapefy
            </p>
          </div>
          <Button
            asChild
            className="bg-amber-600 hover:bg-amber-700 text-white shadow-md hover:shadow-lg transition-all"
          >
            <a
              href={whatsappFirstMessageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-6"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar mensagem
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}




