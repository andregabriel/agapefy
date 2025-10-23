"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/hooks/useAppSettings";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";

import { CheckCircle, AlertCircle } from "lucide-react";

type Variant = "standalone" | "embedded";

interface WhatsAppSetupProps {
  variant?: Variant;
  redirectIfNotLoggedIn?: boolean;
}

export default function WhatsAppSetup({ variant = "standalone", redirectIfNotLoggedIn = true }: WhatsAppSetupProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { settings } = useAppSettings();

  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<null | "start" | "chat" | "verse" | "reminder" | "prayer">(null);
  const [status, setStatus] = useState<null | { ok: boolean; details?: any }>(null);
  const [isActive, setIsActive] = useState(false); // Biblicus
  const [dailyVerse, setDailyVerse] = useState(false); // Versículo Diário
  const [dailyPrayer, setDailyPrayer] = useState(false); // Caminho Selecionado
  const [dailyRoutine, setDailyRoutine] = useState(false); // Minha Rotina

  useEffect(() => {
    if (!redirectIfNotLoggedIn) return;
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router, redirectIfNotLoggedIn]);

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const { data, error } = await supabase
          .from("whatsapp_users")
          .select("phone_number, is_active, receives_daily_verse, receives_daily_prayer, receives_daily_routine")
          .eq("user_id", user?.id ?? "-")
          .maybeSingle();
        if (error) return;
        if (data?.phone_number) setPhone(data.phone_number);
        if (typeof data?.is_active === 'boolean') setIsActive(Boolean(data.is_active));
        if (typeof data?.receives_daily_verse === 'boolean') setDailyVerse(Boolean(data.receives_daily_verse));
        if (typeof data?.receives_daily_prayer === 'boolean') setDailyPrayer(Boolean(data.receives_daily_prayer));
        if (typeof data?.receives_daily_routine === 'boolean') setDailyRoutine(Boolean(data.receives_daily_routine));
      } catch {}
    };
    if (user?.id) fetchExisting();
  }, [user?.id]);

  const formattedExample = useMemo(() => "+55 11 99999-9999", []);

  async function save() {
    const clean = phone.replace(/\D/g, "");
    if (!clean) {
      toast.error("Digite um número válido");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("whatsapp_users").upsert(
        {
          phone_number: clean,
          name: user?.email?.split("@")[0] ?? "Irmão(ã)",
          is_active: true,
          receives_daily_verse: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone_number" }
      );
      if (error) throw error;
      toast.success("Número salvo com sucesso. Envie /start no seu WhatsApp.");
      setIsActive(true);

      const welcome = settings.whatsapp_welcome_message?.trim();
      if (welcome) {
        try {
          void fetch("/api/whatsapp/test-message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: clean, message: welcome })
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn("Falha ao agendar envio de mensagem de boas-vindas", e);
        }
      }
    } catch (e) {
      console.warn(e);
      toast.error("Não foi possível salvar o número");
    } finally {
      setSaving(false);
    }
  }

  async function updatePreference(field: "is_active" | "receives_daily_verse" | "receives_daily_prayer" | "receives_daily_routine", value: boolean) {
    const clean = phone.replace(/\D/g, "");
    if (!clean) {
      toast.error("Cadastre um número válido primeiro");
      return;
    }
    try {
      const { error } = await supabase
        .from('whatsapp_users')
        .upsert({ phone_number: clean, [field]: value, updated_at: new Date().toISOString() } as any, { onConflict: 'phone_number' });
      if (error) throw error;
      if (field === 'is_active') setIsActive(value);
      if (field === 'receives_daily_verse') setDailyVerse(value);
      if (field === 'receives_daily_prayer') setDailyPrayer(value);
      if (field === 'receives_daily_routine') setDailyRoutine(value);
      toast.success('Preferência atualizada');
    } catch (e) {
      console.warn(e);
      toast.error('Não foi possível atualizar a preferência');
    }
  }

  async function test(kind: "start" | "chat" | "verse" | "reminder" | "prayer") {
    const clean = phone.replace(/\D/g, "");
    if (!clean) {
      toast.error("Cadastre um número válido primeiro");
      return;
    }
    setTesting(kind);
    const preset: Record<typeof kind, string> = {
      start: "Olá! Sou o Biblicus. Envie /conversa, /versículos, /lembretes ou /oração.",
      chat: "[Conversa] Quem cuida de mim quando tudo parece faltar?",
      verse: "[Versículos] Envie o versículo do dia, por favor.",
      reminder: "[Lembretes] Quero receber lembretes nos horários de oração.",
      prayer: "[Oração] Monte uma oração personalizada para mim sobre esperança.",
    } as const;
    try {
      const res = await fetch("/api/whatsapp/test-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: clean, message: preset[kind] }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Mensagem de teste enviada");
        setStatus({ ok: true, details: data });
      } else {
        toast.error(data?.error || "Falha ao enviar teste");
        setStatus({ ok: false, details: data });
      }
    } catch (e) {
      console.warn(e);
      toast.error("Erro de conexão ao enviar teste");
      setStatus({ ok: false });
    } finally {
      setTesting(null);
    }
  }

  const Content = (
    <Card>
      <CardHeader>
        <CardTitle>Configuração do WhatsApp</CardTitle>
        <CardDescription>Informe seu número com DDD. Exemplo: {formattedExample}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="wpp-number">Número do WhatsApp</Label>
          <div className="flex gap-2">
            <Input
              id="wpp-number"
              placeholder={formattedExample}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">seu número será usado apenas para enviar/receber mensagens.</p>
        </div>

        {variant !== "embedded" && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 p-3 rounded-md bg-muted/40">
              <div>
                <div className="font-medium">Biblicus</div>
                <p className="text-sm text-muted-foreground">Deve ficar ativado obrigatoriamente; ele conduz respostas e automações no WhatsApp.</p>
              </div>
              <Switch checked={isActive} disabled onCheckedChange={(v) => updatePreference('is_active', v)} />
            </div>

            <div className="flex items-start justify-between gap-4 p-3 rounded-md bg-muted/40">
              <div>
                <div className="font-medium">Versículo Diário</div>
                <p className="text-sm text-muted-foreground">Você receberá um versículo diariamente em seu WhatsApp.</p>
              </div>
              <Switch checked={dailyVerse} onCheckedChange={(v) => updatePreference('receives_daily_verse', v)} />
            </div>

            <div className="flex items-start justify-between gap-4 p-3 rounded-md bg-muted/40">
              <div>
                <div className="font-medium">Caminho Selecionado</div>
                <p className="text-sm text-muted-foreground">Você receberá orações diariamente para superar sua dificuldade selecionada.</p>
              </div>
              <Switch checked={dailyPrayer} onCheckedChange={(v) => updatePreference('receives_daily_prayer', v)} />
            </div>

            <div className="flex items-start justify-between gap-4 p-3 rounded-md bg-muted/40">
              <div>
                <div className="font-medium">Minha Rotina</div>
                <p className="text-sm text-muted-foreground">Você receberá sua rotina diariamente em seu WhatsApp.</p>
              </div>
              <Switch checked={dailyRoutine} onCheckedChange={(v) => updatePreference('receives_daily_routine', v)} />
            </div>
          </div>
        )}

        {status && (
          <Alert className="mt-2">
            {status.ok ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {status.ok ? "Tudo certo! Verifique sua conversa no WhatsApp." : "Não foi possível enviar. Tente novamente mais tarde."}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );

  if (variant === "embedded") {
    return (
      <div className="w-full">
        {Content}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>📖</span>
          <div>
            <h1 className="text-xl font-semibold">Biblicus no WhatsApp</h1>
            <p className="text-sm text-muted-foreground">Conecte seu número para conversar com o Biblicus diretamente no WhatsApp.</p>
          </div>
        </div>
      </div>
      {Content}
    </div>
  );
}


