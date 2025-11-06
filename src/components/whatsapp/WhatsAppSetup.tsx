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

import { CheckCircle, AlertCircle, Sunrise, Utensils, Sunset, Moon } from "lucide-react";

type Variant = "standalone" | "embedded";

interface WhatsAppSetupProps {
  variant?: Variant;
  redirectIfNotLoggedIn?: boolean;
  onSavedPhone?: (phone: string) => void;
}

export default function WhatsAppSetup({ variant = "standalone", redirectIfNotLoggedIn = true, onSavedPhone }: WhatsAppSetupProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { settings } = useAppSettings();

  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<null | "start" | "chat" | "verse" | "reminder" | "prayer">(null);
  const [status, setStatus] = useState<null | { ok: boolean; details?: any }>(null);
  const [isActive, setIsActive] = useState(false); // Biblicus
  const [dailyVerse, setDailyVerse] = useState(false); // Versículo Diário
  const [dailyPrayer, setDailyPrayer] = useState(false); // Jornada
  const [dailyRoutine, setDailyRoutine] = useState(false); // Minha Rotina
  const [wakeTime, setWakeTime] = useState("");
  const [lunchTime, setLunchTime] = useState("");
  const [dinnerTime, setDinnerTime] = useState("");
  const [sleepTime, setSleepTime] = useState("");
  const [wakeEnabled, setWakeEnabled] = useState(false);
  const [lunchEnabled, setLunchEnabled] = useState(false);
  const [dinnerEnabled, setDinnerEnabled] = useState(false);
  const [sleepEnabled, setSleepEnabled] = useState(false);
  const [challengePlaylists, setChallengePlaylists] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedChallenges, setSelectedChallenges] = useState<string[]>([]);

  useEffect(() => {
    if (!redirectIfNotLoggedIn) return;
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router, redirectIfNotLoggedIn]);

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        // Prefer the last phone used on this device
        const localPhone = typeof window !== 'undefined' ? window.localStorage.getItem('agape_whatsapp_phone') : null;
        if (localPhone) setPhone(localPhone);

        let row: any = null;
        if (localPhone) {
          const { data } = await supabase
            .from('whatsapp_users')
            .select('phone_number, is_active, receives_daily_verse, receives_daily_prayer, receives_daily_routine, prayer_time_wakeup, prayer_time_lunch, prayer_time_dinner, prayer_time_sleep')
            .eq('phone_number', localPhone)
            .maybeSingle();
          row = data || null;
        }

        if (!row) {
          // Fallback: get most recent record (best-effort prefill if user used a different device)
          const res = await supabase
            .from('whatsapp_users')
            .select('phone_number, is_active, receives_daily_verse, receives_daily_prayer, receives_daily_routine, prayer_time_wakeup, prayer_time_lunch, prayer_time_dinner, prayer_time_sleep')
            .order('updated_at', { ascending: false })
            .limit(1);
          row = (res.data && res.data[0]) || null;
        }

        if (!row) return;
        if (row.phone_number) setPhone(row.phone_number);
        if (typeof row.is_active === 'boolean') setIsActive(Boolean(row.is_active));
        if (typeof row.receives_daily_verse === 'boolean') setDailyVerse(Boolean(row.receives_daily_verse));
        if (typeof row.receives_daily_prayer === 'boolean') setDailyPrayer(Boolean(row.receives_daily_prayer));
        if (typeof row.receives_daily_routine === 'boolean') setDailyRoutine(Boolean(row.receives_daily_routine));
        // Times may come as 'HH:MM:SS' from Postgres time; normalize to 'HH:MM'
        const slice5 = (t: any) => (typeof t === 'string' && t.length >= 5 ? t.slice(0, 5) : "");
        const wt = slice5(row.prayer_time_wakeup);
        const lt = slice5(row.prayer_time_lunch);
        const dt = slice5(row.prayer_time_dinner);
        const st = slice5(row.prayer_time_sleep);
        setWakeTime(wt);
        setLunchTime(lt);
        setDinnerTime(dt);
        setSleepTime(st);
        setWakeEnabled(!!wt);
        setLunchEnabled(!!lt);
        setDinnerEnabled(!!dt);
        setSleepEnabled(!!st);
      } catch {}
    };
    fetchExisting();
  }, [user?.id]);

  const formattedExample = useMemo(() => "+55 11 99999-9999", []);

  // Load challenge playlists (admin-managed in /admin/playlists)
  useEffect(() => {
    const loadChallenges = async () => {
      try {
        console.log('🔍 Carregando desafios disponíveis...');
        const { data: pls, error: pErr } = await supabase
          .from('playlists')
          .select('id,title')
          .eq('is_challenge', true)
          .order('created_at', { ascending: false });
        
        if (pErr) {
          console.error('❌ Erro ao buscar playlists de desafio:', pErr);
          setChallengePlaylists([]);
          return;
        }
        
        const challengePlaylists = ((pls || []) as any[]).map((p: any) => ({ 
          id: p.id as string, 
          title: (p.title || '') as string 
        }));
        console.log('✅ Desafios carregados:', challengePlaylists.length);
        setChallengePlaylists(challengePlaylists);
      } catch (error) {
        console.error('❌ Erro inesperado ao carregar desafios:', error);
        setChallengePlaylists([]);
      }
    };
    loadChallenges();
  }, []);

  // Load current user's selected challenge playlists
  useEffect(() => {
    const fetchUserChallenges = async () => {
      try {
        const clean = phone.replace(/\D/g, "");
        if (!clean) {
          console.log('ℹ️ Número não informado, limpando desafios selecionados');
          setSelectedChallenges([]);
          return;
        }
        console.log('🔍 Carregando desafios selecionados para:', clean);
        const { data, error } = await supabase
          .from('whatsapp_user_challenges')
          .select('playlist_id')
          .eq('phone_number', clean);
        if (error) {
          console.error('❌ Erro ao buscar desafios selecionados:', error);
          // Se a tabela não existe, apenas logar e continuar sem desafios selecionados
          if (error.message?.includes('Could not find the table') || error.message?.includes('schema cache') || error.code === 'PGRST204') {
            console.warn('⚠️ Tabela whatsapp_user_challenges não existe ainda. Execute a migração SQL: supabase/sql/2025-11-06_create_whatsapp_user_challenges.sql');
          }
          setSelectedChallenges([]);
          return;
        }
        const selected = ((data || []) as any[]).map(r => r.playlist_id as string);
        console.log('✅ Desafios selecionados carregados:', selected.length);
        setSelectedChallenges(selected);
      } catch (error) {
        console.error('❌ Erro inesperado ao carregar desafios selecionados:', error);
        setSelectedChallenges([]);
      }
    };
    fetchUserChallenges();
  }, [phone]);

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
      try {
        if (typeof window !== 'undefined') window.localStorage.setItem('agape_whatsapp_phone', clean);
      } catch {}
      if (typeof onSavedPhone === 'function') onSavedPhone(clean);

      const welcome = settings.whatsapp_welcome_message?.trim();
      if (welcome) {
        try {
          // Só tenta enviar se a instância Z-API estiver OK
          const status = await fetch('/api/whatsapp/status');
          if (status.ok) {
            void fetch("/api/whatsapp/test-message", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: clean, message: welcome })
            });
          }
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

  async function toggleChallenge(playlistId: string, checked: boolean) {
    const clean = phone.replace(/\D/g, "");
    if (!clean) {
      toast.error("Cadastre um número válido primeiro");
      return;
    }
    try {
      console.log('🔄 Alternando desafio:', { playlistId, checked, phone: clean });
      if (checked) {
        const { data, error } = await supabase
          .from('whatsapp_user_challenges')
          .upsert({ phone_number: clean, playlist_id: playlistId }, { onConflict: 'phone_number,playlist_id' })
          .select();
        if (error) {
          console.error('❌ Erro ao adicionar desafio:', error);
          // Verificar se o erro é porque a tabela não existe
          if (error.message?.includes('Could not find the table') || error.message?.includes('schema cache') || error.code === 'PGRST204') {
            const errorMsg = '⚠️ A tabela whatsapp_user_challenges não foi criada ainda.\n\nPor favor, execute a migração SQL:\n\n1. Acesse o Supabase Dashboard\n2. Vá em SQL Editor\n3. Execute o conteúdo do arquivo:\n   supabase/sql/2025-11-06_create_whatsapp_user_challenges.sql\n\nOu execute via CLI:\n   supabase db push';
            alert(errorMsg);
            throw new Error('Tabela whatsapp_user_challenges não encontrada. Execute a migração SQL primeiro.');
          }
          throw error;
        }
        console.log('✅ Desafio adicionado:', data);
        setSelectedChallenges(prev => Array.from(new Set([...prev, playlistId])));
        toast.success('Desafio adicionado');
      } else {
        const { error } = await supabase
          .from('whatsapp_user_challenges')
          .delete()
          .eq('phone_number', clean)
          .eq('playlist_id', playlistId);
        if (error) {
          console.error('❌ Erro ao remover desafio:', error);
          // Verificar se o erro é porque a tabela não existe
          if (error.message?.includes('Could not find the table') || error.message?.includes('schema cache') || error.code === 'PGRST204') {
            // Se a tabela não existe e estamos tentando remover, não há problema
            console.log('ℹ️ Tabela whatsapp_user_challenges não existe, mas não há problema ao remover');
            setSelectedChallenges(prev => prev.filter(id => id !== playlistId));
            return;
          }
          throw error;
        }
        console.log('✅ Desafio removido');
        setSelectedChallenges(prev => prev.filter(id => id !== playlistId));
        toast.success('Desafio removido');
      }
    } catch (error: any) {
      console.error('❌ Erro ao atualizar desafio:', error);
      // Se já mostramos um alert, não mostrar toast também
      if (error?.message?.includes('Tabela whatsapp_user_challenges não encontrada')) {
        return;
      }
      toast.error(`Não foi possível atualizar seus desafios: ${error?.message || 'Erro desconhecido'}`);
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

  async function updatePrayerTime(field: "prayer_time_wakeup" | "prayer_time_lunch" | "prayer_time_dinner" | "prayer_time_sleep", value: string) {
    const clean = phone.replace(/\D/g, "");
    if (!clean) {
      toast.error("Cadastre um número válido primeiro");
      return;
    }
    try {
      // Persist as time (HH:MM); Postgres will cast string to time
      const payload: any = { phone_number: clean, updated_at: new Date().toISOString() };
      // If empty, set null
      (payload as any)[field] = value && value.length >= 4 ? value : null;
      const { error } = await supabase
        .from('whatsapp_users')
        .upsert(payload, { onConflict: 'phone_number' });
      if (error) throw error;
      toast.success('Horário atualizado');
    } catch (e) {
      console.warn(e);
      toast.error('Não foi possível salvar o horário');
    }
  }

  function defaultTimeFor(slot: 'wakeup' | 'lunch' | 'dinner' | 'sleep'): string {
    switch (slot) {
      case 'wakeup': return '07:00';
      case 'lunch': return '12:00';
      case 'dinner': return '19:00';
      case 'sleep': return '22:00';
      default: return '09:00';
    }
  }

  async function toggleSlot(slot: 'wakeup' | 'lunch' | 'dinner' | 'sleep', enabled: boolean) {
    if (slot === 'wakeup') setWakeEnabled(enabled);
    if (slot === 'lunch') setLunchEnabled(enabled);
    if (slot === 'dinner') setDinnerEnabled(enabled);
    if (slot === 'sleep') setSleepEnabled(enabled);

    // When disabling, persist null (empty string)
    if (!enabled) {
      if (slot === 'wakeup') {
        setWakeTime("");
        await updatePrayerTime('prayer_time_wakeup', "");
      } else if (slot === 'lunch') {
        setLunchTime("");
        await updatePrayerTime('prayer_time_lunch', "");
      } else if (slot === 'dinner') {
        setDinnerTime("");
        await updatePrayerTime('prayer_time_dinner', "");
      } else if (slot === 'sleep') {
        setSleepTime("");
        await updatePrayerTime('prayer_time_sleep', "");
      }
      return;
    }

    // When enabling with empty time, set a sensible default and persist
    if (enabled) {
      if (slot === 'wakeup') {
        const v = wakeTime && wakeTime.length >= 4 ? wakeTime : defaultTimeFor('wakeup');
        setWakeTime(v);
        await updatePrayerTime('prayer_time_wakeup', v);
      } else if (slot === 'lunch') {
        const v = lunchTime && lunchTime.length >= 4 ? lunchTime : defaultTimeFor('lunch');
        setLunchTime(v);
        await updatePrayerTime('prayer_time_lunch', v);
      } else if (slot === 'dinner') {
        const v = dinnerTime && dinnerTime.length >= 4 ? dinnerTime : defaultTimeFor('dinner');
        setDinnerTime(v);
        await updatePrayerTime('prayer_time_dinner', v);
      } else if (slot === 'sleep') {
        const v = sleepTime && sleepTime.length >= 4 ? sleepTime : defaultTimeFor('sleep');
        setSleepTime(v);
        await updatePrayerTime('prayer_time_sleep', v);
      }
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
                <div className="font-medium">Jornada</div>
                <p className="text-sm text-muted-foreground">Você receberá orações diariamente para superar sua dificuldade selecionada.</p>
              </div>
              <Switch checked={dailyPrayer} onCheckedChange={(v) => updatePreference('receives_daily_prayer', v)} />
            </div>

            {dailyPrayer && (
              <div className="p-3 rounded-md bg-muted/40 space-y-3">
                <div>
                  <div className="font-medium">Desafios</div>
                  <p className="text-sm text-muted-foreground">Selecione os desafios que você deseja acompanhar.</p>
                </div>
                {challengePlaylists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum desafio disponível no momento.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {challengePlaylists.map(p => (
                      <label key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-md border bg-background cursor-pointer">
                        <span className="text-sm">{p.title}</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={selectedChallenges.includes(p.id)}
                          onChange={(e) => toggleChallenge(p.id, e.target.checked)}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-start justify-between gap-4 p-3 rounded-md bg-muted/40">
              <div>
                <div className="font-medium">Minha Rotina</div>
                <p className="text-sm text-muted-foreground">Você receberá sua rotina diariamente em seu WhatsApp.</p>
              </div>
              <Switch checked={dailyRoutine} onCheckedChange={(v) => updatePreference('receives_daily_routine', v)} />
            </div>

            {dailyRoutine && (
              <div className="p-3 rounded-md bg-muted/40 space-y-3">
                <div>
                  <div className="font-medium">Horários das orações</div>
                  <p className="text-sm text-muted-foreground">Defina os melhores horários para receber as orações da sua rotina.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-background">
                    <div className="flex items-center gap-2">
                      <Sunrise className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Ao acordar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={wakeEnabled} onCheckedChange={(v) => toggleSlot('wakeup', v)} />
                      <Input
                        type="time"
                        value={wakeTime}
                        disabled={!wakeEnabled}
                        step={300}
                        onChange={(e) => {
                          const v = e.target.value;
                          setWakeTime(v);
                          updatePrayerTime('prayer_time_wakeup', v);
                        }}
                        className="w-[120px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-background">
                    <div className="flex items-center gap-2">
                      <Utensils className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">No almoço</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={lunchEnabled} onCheckedChange={(v) => toggleSlot('lunch', v)} />
                      <Input
                        type="time"
                        value={lunchTime}
                        disabled={!lunchEnabled}
                        step={300}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLunchTime(v);
                          updatePrayerTime('prayer_time_lunch', v);
                        }}
                        className="w-[120px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-background">
                    <div className="flex items-center gap-2">
                      <Sunset className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">No jantar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={dinnerEnabled} onCheckedChange={(v) => toggleSlot('dinner', v)} />
                      <Input
                        type="time"
                        value={dinnerTime}
                        disabled={!dinnerEnabled}
                        step={300}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDinnerTime(v);
                          updatePrayerTime('prayer_time_dinner', v);
                        }}
                        className="w-[120px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-background">
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Ao dormir</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={sleepEnabled} onCheckedChange={(v) => toggleSlot('sleep', v)} />
                      <Input
                        type="time"
                        value={sleepTime}
                        disabled={!sleepEnabled}
                        step={300}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSleepTime(v);
                          updatePrayerTime('prayer_time_sleep', v);
                        }}
                        className="w-[120px]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
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


