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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  MessageCircle,
  Phone,
  Send,
  CheckCircle,
  AlertCircle,
  Clock,
  BookText,
  Sparkles,
} from "lucide-react";

export default function WhatsAppSetupPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { settings } = useAppSettings();

  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<null | "start" | "chat" | "verse" | "reminder" | "prayer">(null);
  const [status, setStatus] = useState<null | { ok: boolean; details?: any }>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const { data, error } = await supabase
          .from("whatsapp_users")
          .select("phone_number")
          .eq("user_id", user?.id ?? "-")
          .maybeSingle();
        if (error) return;
        if (data?.phone_number) setPhone(data.phone_number);
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
      // Upsert por phone_number e associar user_id quando houver
      const { error } = await supabase.from("whatsapp_users").upsert(
        {
          phone_number: clean,
          name: user?.email?.split("@")[0] ?? "Irmão(ã)",
          is_active: true,
          receives_daily_verse: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "phone_number" }
      );
      if (error) throw error;
      toast.success("Número salvo com sucesso. Envie /start no seu WhatsApp.");

      // Enviar mensagem de boas-vindas configurável (se houver)
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
            <p className="text-xs text-muted-foreground">Seu número será usado apenas para enviar/receber mensagens do Biblicus.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => test("start")} disabled={testing !== null} className="justify-start">
              <Send className="h-4 w-4 mr-2" /> Testar comando /start
            </Button>
            <Button variant="secondary" onClick={() => test("chat")} disabled={testing !== null} className="justify-start">
              <MessageCircle className="h-4 w-4 mr-2" /> Testar Conversa
            </Button>
            <Button variant="secondary" onClick={() => test("verse")} disabled={testing !== null} className="justify-start">
              <BookText className="h-4 w-4 mr-2" /> Testar Versículos
            </Button>
            <Button variant="secondary" onClick={() => test("reminder")} disabled={testing !== null} className="justify-start">
              <Clock className="h-4 w-4 mr-2" /> Testar Lembretes
            </Button>
            <Button variant="secondary" onClick={() => test("prayer")} disabled={testing !== null} className="justify-start">
              <Sparkles className="h-4 w-4 mr-2" /> Testar Oração
            </Button>
          </div>

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

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>O que o Biblicus pode fazer</CardTitle>
            <CardDescription>Use os comandos abaixo no WhatsApp para interagir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="secondary">/conversa</Badge>
              <div>
                <div className="font-medium">Obtenha respostas baseadas na Bíblia</div>
                <p className="text-sm text-muted-foreground">Converse livremente e receba respostas fundamentadas nas Escrituras.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary">/versículos</Badge>
              <div>
                <div className="font-medium">Receba versículos diariamente</div>
                <p className="text-sm text-muted-foreground">Ative o envio automático do versículo do dia.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary">/lembretes</Badge>
              <div>
                <div className="font-medium">Receba lembretes nos horários de oração</div>
                <p className="text-sm text-muted-foreground">Defina horários para ser lembrado de orar.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="secondary">/oração</Badge>
              <div>
                <div className="font-medium">Monte uma oração personalizada pra você</div>
                <p className="text-sm text-muted-foreground">Descreva sua situação e receba uma oração personalizada.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como começar</CardTitle>
            <CardDescription>Após salvar seu número, envie uma mensagem para o Biblicus.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Phone className="h-4 w-4 mt-1" />
              <p className="text-sm text-muted-foreground">Abra o WhatsApp e envie <span className="font-medium">/start</span> para iniciar.</p>
            </div>
            <div className="flex items-start gap-3">
              <MessageCircle className="h-4 w-4 mt-1" />
              <p className="text-sm text-muted-foreground">Use os comandos acima ou apenas converse normalmente.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


