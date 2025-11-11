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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [challengeTime, setChallengeTime] = useState<string>("");
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const selectedChallengeTitle = useMemo(
    () => (challengePlaylists.find(p => p.id === selectedChallengeId)?.title || ""),
    [challengePlaylists, selectedChallengeId]
  );
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!redirectIfNotLoggedIn) return;
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router, redirectIfNotLoggedIn]);

  useEffect(() => {
    const fetchExisting = async () => {
      try {
        let row: any = null;

        // Try to get the user's WhatsApp number by phone_number from localStorage first
        const localPhone = typeof window !== 'undefined' ? window.localStorage.getItem('agape_whatsapp_phone') : null;
        
        if (localPhone) {
          const { data } = await supabase
            .from('whatsapp_users')
            .select('phone_number, is_active, receives_daily_verse, receives_daily_prayer, receives_daily_routine, prayer_time_wakeup, prayer_time_lunch, prayer_time_dinner, prayer_time_sleep')
            .eq('phone_number', localPhone)
            .maybeSingle();
          row = data || null;
        }

        // If user is logged in, try to find by user_id (if column exists)
        if (!row && user?.id) {
          try {
            const { data, error } = await supabase
              .from('whatsapp_users')
              .select('phone_number, is_active, receives_daily_verse, receives_daily_prayer, receives_daily_routine, prayer_time_wakeup, prayer_time_lunch, prayer_time_dinner, prayer_time_sleep')
              .eq('user_id', user.id)
              .maybeSingle();
            
            // Se não houver erro sobre user_id não existir, usar os dados
            if (!error || (!error.message?.includes('user_id') && !error.message?.includes('schema cache'))) {
              row = data || null;
            }
          } catch (e: any) {
            // Ignorar erro se user_id não existir
            if (!e?.message?.includes('user_id') && !e?.message?.includes('schema cache')) {
              console.warn("Erro ao buscar por user_id:", e);
            }
          }
        }

        if (!row) {
          // Se não encontrou nada e há um telefone no localStorage, pelo menos mostrar ele
          if (localPhone) {
            setPhone(localPhone);
          }
          return;
        }

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
      } catch (e) {
        console.warn("Erro ao buscar dados do WhatsApp:", e);
      }
    };
    fetchExisting();
  }, [user?.id]);

  const formattedExample = useMemo(() => "+55 11 99999-9999", []);

  // Load challenge playlists (admin-managed in /admin/playlists via table public.challenge)
  useEffect(() => {
    const loadChallenges = async () => {
      try {
        const { data: chRows, error: chErr } = await supabase
          .from('challenge')
          .select('playlist_id')
          .order('created_at', { ascending: false });
        if (chErr) {
          // Fallback if table doesn't exist in the environment yet
          const { data: pls, error: fbErr } = await supabase
            .from('playlists')
            .select('id,title,is_public')
            .ilike('title', '%desafio%')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(50);
          if (fbErr) { setChallengePlaylists([]); return; }
          setChallengePlaylists(((pls || []) as any[]).map((p: any) => ({ id: p.id as string, title: (p.title || '') as string })));
          return;
        }
        const ids = (chRows || []).map((r: any) => r.playlist_id).filter(Boolean);
        if (!ids.length) {
          // Fallback to title heuristic if no challenge rows yet
          const { data: pls, error: fbErr } = await supabase
            .from('playlists')
            .select('id,title,is_public')
            .ilike('title', '%desafio%')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(50);
          if (fbErr) { setChallengePlaylists([]); return; }
          setChallengePlaylists(((pls || []) as any[]).map((p: any) => ({ id: p.id as string, title: (p.title || '') as string })));
          return;
        }
        const { data: pls, error: pErr } = await supabase
          .from('playlists')
          .select('id,title')
          .in('id', ids);
        if (pErr) {
          setChallengePlaylists([]);
          return;
        }
        setChallengePlaylists(((pls || []) as any[]).map((p: any) => ({ id: p.id as string, title: (p.title || '') as string })));
      } catch (error) {
        setChallengePlaylists([]);
      }
    };
    loadChallenges();
  }, []);

  // Load current user's selected challenge + preferred time
  useEffect(() => {
    const fetchUserChallenges = async () => {
      try {
        const clean = phone.replace(/\D/g, "");
        if (!clean) {
          setSelectedChallengeId(null);
          setChallengeTime("");
          return;
        }
        const { data, error } = await supabase
          .from('whatsapp_user_challenges')
          .select('playlist_id, send_time, created_at')
          .eq('phone_number', clean);
        if (error) return;
        const rows = (data || []) as any[];
        if (rows.length === 0) {
          setSelectedChallengeId(null);
          setChallengeTime("");
          return;
        }
        // pick the most recent selection
        rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        const row = rows[0];
        setSelectedChallengeId(row.playlist_id as string);
        const t = typeof row.send_time === 'string' && row.send_time.length >= 5 ? String(row.send_time).slice(0, 5) : '';
        setChallengeTime(t);
      } catch (error) {
        setSelectedChallengeId(null);
        setChallengeTime("");
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
    
    // Verificar se o usuário está logado (se redirectIfNotLoggedIn estiver ativo)
    if (redirectIfNotLoggedIn && !user?.id) {
      toast.error("Você precisa estar logado para salvar o número");
      return;
    }
    
    setSaving(true);
    try {
      // Primeiro, fazer upsert básico sem user_id (como os webhooks fazem)
      const payload: any = {
        phone_number: clean,
        name: user?.email?.split("@")[0] ?? "Irmão(ã)",
        is_active: true,
        receives_daily_verse: false,
        updated_at: new Date().toISOString(),
      };

      // Tentar adicionar user_id apenas se o usuário estiver logado
      // Se a coluna não existir, o Supabase vai ignorar silenciosamente
      if (user?.id) {
        payload.user_id = user.id;
      }

      const { error } = await supabase.from("whatsapp_users").upsert(
        payload,
        { onConflict: "phone_number" }
      );
      
      if (error) {
        // Se o erro for sobre user_id não existir, tentar novamente sem user_id
        if (error.message?.includes("user_id") || error.message?.includes("schema cache")) {
          console.warn("Coluna user_id não encontrada, salvando sem ela...");
          const { error: retryError } = await supabase.from("whatsapp_users").upsert(
            {
              phone_number: clean,
              name: user?.email?.split("@")[0] ?? "Irmão(ã)",
              is_active: true,
              receives_daily_verse: false,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "phone_number" }
          );
          
          if (retryError) {
            throw retryError;
          }
        } else {
          throw error;
        }
      }
      
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
    } catch (e: any) {
      console.error("Erro ao salvar número:", e);
      // Mensagens de erro mais específicas
      if (e?.code === '23505') { // Unique violation
        toast.error("Este número já está cadastrado");
      } else if (e?.code === '42501') { // Insufficient privilege
        toast.error("Você não tem permissão para realizar esta ação");
      } else if (e?.message) {
        toast.error(e.message);
      } else {
        toast.error("Não foi possível salvar o número. Tente novamente.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveChallengeSelection() {
    const clean = phone.replace(/\D/g, "");
    if (!clean) {
      toast.error("Cadastre um número válido primeiro");
      return;
    }
    try {
      if (!selectedChallengeId) {
        toast.error('Selecione um desafio');
        return;
      }
      if (!challengeTime || challengeTime.length < 4) {
        toast.error('Defina um horário');
        return;
      }
      // Keep only one selection: delete others first
      await supabase
        .from('whatsapp_user_challenges')
        .delete()
        .eq('phone_number', clean)
        .neq('playlist_id', selectedChallengeId);
      // Upsert current selection with time
      const { error } = await supabase
        .from('whatsapp_user_challenges')
        .upsert({ phone_number: clean, playlist_id: selectedChallengeId, send_time: challengeTime }, { onConflict: 'phone_number,playlist_id' });
      if (error) throw error;
      toast.success('Jornada salva');
    } catch (e: any) {
      toast.error('Não foi possível salvar sua jornada');
    }
  }

  async function updatePreference(field: "is_active" | "receives_daily_verse" | "receives_daily_prayer" | "receives_daily_routine", value: boolean) {
    const clean = phone.replace(/\D/g, "");
    if (!clean) {
      toast.error("Cadastre um número válido primeiro");
      return;
    }
    try {
      const payload: any = {
        phone_number: clean,
        [field]: value,
        updated_at: new Date().toISOString()
      };
      
      // Tentar adicionar user_id apenas se o usuário estiver logado
      if (user?.id) {
        payload.user_id = user.id;
      }

      const { error } = await supabase
        .from('whatsapp_users')
        .upsert(payload, { onConflict: 'phone_number' });
      
      // Se o erro for sobre user_id não existir, tentar novamente sem user_id
      if (error && (error.message?.includes("user_id") || error.message?.includes("schema cache"))) {
        const { error: retryError } = await supabase
          .from('whatsapp_users')
          .upsert({
            phone_number: clean,
            [field]: value,
            updated_at: new Date().toISOString()
          }, { onConflict: 'phone_number' });
        if (retryError) throw retryError;
      } else if (error) {
        throw error;
      }
      
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
      const payload: any = {
        phone_number: clean,
        updated_at: new Date().toISOString()
      };
      
      // Tentar adicionar user_id apenas se o usuário estiver logado
      if (user?.id) {
        payload.user_id = user.id;
      }
      
      // If empty, set null
      payload[field] = value && value.length >= 4 ? value : null;
      
      const { error } = await supabase
        .from('whatsapp_users')
        .upsert(payload, { onConflict: 'phone_number' });
      
      // Se o erro for sobre user_id não existir, tentar novamente sem user_id
      if (error && (error.message?.includes("user_id") || error.message?.includes("schema cache"))) {
        const retryPayload: any = {
          phone_number: clean,
          updated_at: new Date().toISOString()
        };
        retryPayload[field] = value && value.length >= 4 ? value : null;
        const { error: retryError } = await supabase
          .from('whatsapp_users')
          .upsert(retryPayload, { onConflict: 'phone_number' });
        if (retryError) throw retryError;
      } else if (error) {
        throw error;
      }
      
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

  // Usar configurações quando variant="embedded" (onboarding)
  // Se os campos estiverem vazios, não usar valores padrão - deixar vazio ou não renderizar
  const getSettingValue = (key: string, allowDefault: boolean = false) => {
    if (variant !== "embedded") {
      // Quando não é embedded, sempre retornar valores padrão
      switch (key) {
        case 'onboarding_step4_section_title':
          return 'Configuração do WhatsApp';
        case 'onboarding_step4_instruction':
          return `Informe seu número com DDD. Exemplo: ${formattedExample}`;
        case 'onboarding_step4_label':
          return 'Número do WhatsApp';
        case 'onboarding_step4_privacy_text':
          return 'seu número será usado apenas para enviar/receber mensagens.';
        default:
          return '';
      }
    }
    const value = (settings as any)[key];
    // Se for string vazia ou apenas espaços
    if (!value || typeof value !== 'string' || value.trim() === '') {
      // Se allowDefault for true, retornar valor padrão, senão retornar null para não renderizar
      if (allowDefault) {
        switch (key) {
          case 'onboarding_step4_section_title':
            return 'Configuração do WhatsApp';
          default:
            return '';
        }
      }
      return null;
    }
    return value;
  };

  const sectionTitle = getSettingValue('onboarding_step4_section_title', true) || 'Configuração do WhatsApp';
  const instruction = getSettingValue('onboarding_step4_instruction', false);
  const labelText = getSettingValue('onboarding_step4_label', false);
  const privacyText = getSettingValue('onboarding_step4_privacy_text', false);

  const Content = (
    <Card>
      <CardHeader>
        <CardTitle>{sectionTitle}</CardTitle>
        {instruction && <CardDescription>{instruction}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {labelText && <Label htmlFor="wpp-number">{labelText}</Label>}
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
          {privacyText && <p className="text-xs text-muted-foreground">{privacyText}</p>}
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
                  <div className="font-medium">Jornada • Desafios</div>
                  <p className="text-sm text-muted-foreground">Escolha um desafio e defina um horário diário.</p>
                </div>
                {challengePlaylists.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum desafio disponível no momento.</p>
                ) : (
                  <>
                    <div className="max-w-2xl">
                      <label className="block text-sm font-medium mb-2">Desafio</label>
                      {isMobile ? (
                        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                          <Button variant="outline" role="combobox" aria-expanded={drawerOpen} className="w-full justify-between" onClick={() => setDrawerOpen(true)}>
                            {selectedChallengeTitle || "Selecione ou pesquise um desafio..."}
                          </Button>
                          <DrawerContent className="h-[85vh]">
                            <DrawerHeader className="pb-2">
                              <DrawerTitle>Selecionar desafio</DrawerTitle>
                            </DrawerHeader>
                            <div className="p-4">
                              <Command>
                                <CommandInput placeholder="Digite para filtrar..." />
                                <CommandEmpty>Nenhum desafio encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {challengePlaylists.map((p) => (
                                    <CommandItem
                                      key={p.id}
                                      onSelect={() => {
                                        setSelectedChallengeId(p.id);
                                        setDrawerOpen(false);
                                      }}
                                    >
                                      {p.title}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </Command>
                            </div>
                          </DrawerContent>
                        </Drawer>
                      ) : (
                        <Popover open={challengeOpen} onOpenChange={setChallengeOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" role="combobox" aria-expanded={challengeOpen} className="w-full justify-between">
                              {selectedChallengeTitle || "Selecione ou pesquise um desafio..."}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="bottom"
                            align="start"
                            sideOffset={6}
                            avoidCollisions={false}
                            collisionPadding={8}
                            className="w-[--radix-popover-trigger-width] p-0 shadow-lg max-h-80 overflow-hidden"
                          >
                            <Command>
                              <CommandInput placeholder="Digite para filtrar..." />
                              <CommandEmpty>Nenhum desafio encontrado.</CommandEmpty>
                              <CommandGroup>
                                {challengePlaylists.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    onSelect={() => {
                                      setSelectedChallengeId(p.id);
                                      setChallengeOpen(false);
                                    }}
                                  >
                                    {p.title}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 p-3 rounded-md border bg-background">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Horário do desafio</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={challengeTime}
                          onChange={(e) => setChallengeTime(e.target.value)}
                          step={300}
                          disabled={!selectedChallengeId}
                          className="w-[120px]"
                        />
                        <Button disabled={!selectedChallengeId || !challengeTime} onClick={saveChallengeSelection}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </>
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


