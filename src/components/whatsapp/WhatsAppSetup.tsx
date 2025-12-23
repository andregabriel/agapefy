"use client";

import React from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";

import { CheckCircle, AlertCircle, Sunrise, Utensils, Sunset, Moon, MessageCircle } from "lucide-react";
import { TimePicker } from "@/components/ui/time-picker";

const WHATS_DEBUG = (...args: any[]) => {
  console.log('[WHATS_DEBUG]', ...args);
};

type Variant = "standalone" | "embedded";

interface WhatsAppSetupProps {
  variant?: Variant;
  redirectIfNotLoggedIn?: boolean;
  onSavedPhone?: (phone: string) => void;
}

// Feature flags keep legacy flows available in the codebase while allowing
// us to disable specific surfaces in the UI without deleting logic.
const WHATSAPP_FEATURES = {
  bibleResponses: false,
  dailyVerse: false,
  dailyRoutine: false,
} as const;

// Funções auxiliares para formatação de telefone
function formatPhoneNumber(value: string): string {
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, "");
  
  // Se não tem números, retorna vazio
  if (!numbers) return "";
  
  // Se tem menos de 2 dígitos, retorna como está
  if (numbers.length < 2) {
    return numbers;
  }
  
  // Se tem exatamente 2 dígitos (DDD), retorna com espaço
  if (numbers.length === 2) {
    return `${numbers} `;
  }
  
  // Se tem mais de 2 dígitos, formata DDD + número
  const ddd = numbers.slice(0, 2);
  const phone = numbers.slice(2);
  
  // Formata o número: XXXXX-XXXX (8 ou 9 dígitos)
  if (phone.length <= 4) {
    return `${ddd} ${phone}`;
  } else if (phone.length <= 8) {
    return `${ddd} ${phone.slice(0, 4)}-${phone.slice(4)}`;
  } else {
    // Para números com 9 dígitos (celular)
    return `${ddd} ${phone.slice(0, 5)}-${phone.slice(5, 9)}`;
  }
}

function parsePhoneNumber(formatted: string): string {
  // Remove tudo que não é número
  return formatted.replace(/\D/g, "");
}

function validatePhoneNumber(countryCode: string, phoneNumber: string): boolean {
  const clean = parsePhoneNumber(phoneNumber);
  // Para Brasil (+55): precisa de 11 dígitos (55 + DDD + número)
  // DDD tem 2 dígitos, número tem 8 ou 9 dígitos
  if (countryCode === "55") {
    // Remove o código do país se estiver incluído
    const withoutCountryCode = clean.startsWith("55") ? clean.slice(2) : clean;
    // Deve ter DDD (2 dígitos) + número (8 ou 9 dígitos) = 10 ou 11 dígitos
    return withoutCountryCode.length >= 10 && withoutCountryCode.length <= 11;
  }
  // Para outros países, validação básica
  return clean.length >= 8;
}

export default function WhatsAppSetup({ variant = "standalone", redirectIfNotLoggedIn = true, onSavedPhone }: WhatsAppSetupProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { settings } = useAppSettings();

  const [phone, setPhone] = useState(""); // Mantido para compatibilidade com código existente
  const [country, setCountry] = useState("BR"); // Código do país (BR = Brasil)
  const [countryCode, setCountryCode] = useState("55"); // Código telefônico (+55)
  const [phoneNumber, setPhoneNumber] = useState(""); // Número formatado (DDD XXXXX-XXXX)
  const [saving, setSaving] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // Função helper para obter o número completo limpo (apenas dígitos)
  const getFullPhoneNumber = (): string => {
    const parsedNumber = parsePhoneNumber(phoneNumber);
    // Se phoneNumber tem conteúdo, usar os campos separados
    if (parsedNumber && parsedNumber.length >= 10) {
      return countryCode + parsedNumber;
    }
    // Fallback para phone se phoneNumber estiver vazio (compatibilidade)
    const cleanPhone = phone.replace(/\D/g, "");
    return cleanPhone || "";
  };
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
  const [attemptedOnboardingLink, setAttemptedOnboardingLink] = useState(false);
  const [hasSentFirstMessage, setHasSentFirstMessage] = useState<boolean | null>(null);
  const [loadingFirstMessage, setLoadingFirstMessage] = useState(true);
  const selectedChallengeTitle = useMemo(
    () => (challengePlaylists.find(p => p.id === selectedChallengeId)?.title || ""),
    [challengePlaylists, selectedChallengeId]
  );
  const isMobile = useIsMobile();

  useEffect(() => {
    WHATS_DEBUG('stateChange', { selectedChallengeId, challengePlaylistsIds: challengePlaylists.map(p => p.id) });
  }, [selectedChallengeId, challengePlaylists]);

  const getLocalStorageKey = () => (user?.id ? `whatsapp_phone_${user.id}` : null);

  // Carregar número salvo no localStorage como fallback suave
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (phone || phoneNumber) return;
    const key = getLocalStorageKey();
    if (!key) return;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        full?: string;
        formatted?: string;
        country?: string;
        countryCode?: string;
      };
      if (parsed.full) setPhone(parsed.full);
      if (parsed.formatted) setPhoneNumber(parsed.formatted);
      if (parsed.country) setCountry(parsed.country);
      if (parsed.countryCode) setCountryCode(parsed.countryCode);
    } catch (e) {
      console.warn("Erro ao carregar telefone do localStorage:", e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

        // Buscar WhatsApp do usuário logado pelo user_id no Supabase
        if (user?.id) {
          try {
            const { data, error } = await supabase
              .from('whatsapp_users')
              .select('phone_number, is_active, receives_daily_verse, receives_daily_prayer, receives_daily_routine, prayer_time_wakeup, prayer_time_lunch, prayer_time_dinner, prayer_time_sleep, has_sent_first_message')
              .eq('user_id', user.id)
              .maybeSingle();
            
            // Se não houver erro sobre user_id não existir, usar os dados
            if (!error || (!error.message?.includes('user_id') && !error.message?.includes('schema cache'))) {
              row = data || null;
              if (row) {
                setHasSentFirstMessage(row.has_sent_first_message ?? false);
                setLoadingFirstMessage(false);
              }
            }
          } catch (e: any) {
            const msg = (e?.message || '').toLowerCase();
            const code = (e?.code || '').toString();
            const isSchemaError =
              code === '42703' || // undefined_column
              code === '42883' || // undefined_function / cache
              msg.includes('schema cache') ||
              (msg.includes('column') && msg.includes('does not exist'));

            if (isSchemaError) {
              // Em ambientes onde a migration ainda não rodou, evitamos quebrar a UX.
              console.warn("Erro de schema ao buscar whatsapp por user_id (ignorado no cliente):", e);
            } else {
              console.warn("Erro ao buscar whatsapp por user_id:", e);
            }
          }
        }

        // Se não encontrou nada, assumimos que ainda não enviou a primeira mensagem
        // (has_sent_first_message === false). O card de "envie sua primeira mensagem"
        // só depende disso + existir um número salvo.
        if (!row) {
          setHasSentFirstMessage(false);
          setLoadingFirstMessage(false);
          return;
        }

        if (row.phone_number) {
          setPhone(row.phone_number);
          // Processar o número para extrair país, código e número formatado
          const clean = parsePhoneNumber(row.phone_number);
          if (clean.startsWith("55") && clean.length >= 12) {
            // Número brasileiro com código do país
            setCountry("BR");
            setCountryCode("55");
            const dddAndNumber = clean.slice(2); // Remove 55
            setPhoneNumber(formatPhoneNumber(dddAndNumber));
          } else if (clean.length >= 10) {
            // Número brasileiro sem código do país (assumir Brasil)
            setCountry("BR");
            setCountryCode("55");
            setPhoneNumber(formatPhoneNumber(clean));
          }

          // Sincronizar também com localStorage para evitar "sumir" em futuros carregamentos
          const key = getLocalStorageKey();
          if (typeof window !== "undefined" && key) {
            try {
              window.localStorage.setItem(
                key,
                JSON.stringify({
                  full: row.phone_number,
                  formatted: phoneNumber || formatPhoneNumber(clean.startsWith("55") ? clean.slice(2) : clean),
                  country,
                  countryCode,
                })
              );
            } catch (e) {
              console.warn("Erro ao salvar telefone no localStorage a partir do Supabase:", e);
            }
          }
        }
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
        
        // Verificar se enviou a primeira mensagem
        if (row.has_sent_first_message !== undefined) {
          setHasSentFirstMessage(row.has_sent_first_message ?? false);
        }
        setLoadingFirstMessage(false);
      } catch (e) {
        console.warn("Erro ao buscar dados do WhatsApp:", e);
        setLoadingFirstMessage(false);
      }
    };
    fetchExisting();
  }, [user?.id]);

  const formattedExample = useMemo(() => "+55 11 99999-9999", []);

  // Load challenge playlists usados na jornada de orações.
  // Estratégia:
  // 1) Priorizar a nova coluna playlists.is_challenge = true (mesma usada no onboarding passo 2)
  // 2) Manter fallbacks para ambientes onde a migration ainda não rodou (tabela challenge ou título contendo "desafio")
  useEffect(() => {
    const loadChallenges = async () => {
      try {
        WHATS_DEBUG('loadChallenges:start');
        // 1) Nova fonte canônica: playlists marcadas como desafio
        try {
          const { data: challengePlaylistsRows, error: challengePlaylistsError } = await supabase
            .from('playlists')
            .select('id,title,is_public,is_challenge')
            .eq('is_public', true)
            .eq('is_challenge', true)
            .order('created_at', { ascending: false })
            .limit(100);

          const isSchemaError =
            challengePlaylistsError &&
            (challengePlaylistsError.code === '42703' ||
              (String(challengePlaylistsError.message || '').toLowerCase().includes('is_challenge') ||
                String(challengePlaylistsError.message || '').toLowerCase().includes('schema cache')));

          if (!challengePlaylistsError && (challengePlaylistsRows || []).length > 0) {
            setChallengePlaylists(
              ((challengePlaylistsRows || []) as any[]).map((p: any) => ({
                id: p.id as string,
                title: (p.title || '') as string,
              }))
            );
            WHATS_DEBUG('loadChallenges:setChallengePlaylists', {
              source: 'is_challenge',
              ids: (challengePlaylistsRows || []).map((p: any) => p.id),
              count: (challengePlaylistsRows || []).length,
            });
            return;
          }

          // Se houve erro de schema, caímos para o fallback abaixo.
          // Se não houve erro mas não há linhas, também usamos o fallback
          if (challengePlaylistsError && !isSchemaError) {
            // Em caso de erro "real" (permissão, etc), ainda assim tentamos o fallback antigo
            // mas registramos no console para facilitar debug.
            console.warn('Erro ao carregar playlists de desafio via is_challenge (WhatsAppSetup):', challengePlaylistsError);
          }
        } catch (e) {
          // Em qualquer erro inesperado, continuar para os fallbacks antigos
          console.warn('Erro inesperado ao carregar playlists de desafio via is_challenge (WhatsAppSetup):', e);
        }

        // 2) Fallback legacy: tabela public.challenge
        let challengeRows: any[] = [];
        try {
          const { data: chRows, error: chErr } = await supabase
            .from('challenge')
            .select('playlist_id')
            .order('created_at', { ascending: false });

          if (!chErr && chRows) {
            challengeRows = chRows as any[];
            // eslint-disable-next-line no-console
            console.log('[WPP_DEBUG] loadChallenges:legacyChallengeRows', {
              count: (challengeRows || []).length,
            });
            WHATS_DEBUG('loadChallenges:setChallengePlaylists', {
              source: 'challenge_table_rows',
              ids: (challengeRows || []).map((r: any) => r.playlist_id),
              count: (challengeRows || []).length,
            });
          } else if (chErr) {
            console.warn('Erro ao buscar tabela legacy challenge (WhatsAppSetup):', chErr);
            WHATS_DEBUG('loadChallenges:error', chErr);
          }
        } catch (e) {
          console.warn('Erro ao carregar tabela legacy challenge (WhatsAppSetup):', e);
          WHATS_DEBUG('loadChallenges:error', e);
        }

        const ids = (challengeRows || []).map((r: any) => r.playlist_id).filter(Boolean);
        // eslint-disable-next-line no-console
        console.log('[WPP_DEBUG] loadChallenges:legacyIds', { idsCount: ids.length });
        WHATS_DEBUG('loadChallenges:setChallengePlaylists', {
          source: 'challenge_table_ids',
          ids,
          count: ids.length,
        });

        // 3) Se não houver tabela challenge ou ela estiver vazia, manter heurística por título
        if (!ids.length) {
          const { data: pls, error: fbErr } = await supabase
            .from('playlists')
            .select('id,title,is_public')
            .ilike('title', '%desafio%')
            .eq('is_public', true)
            .order('created_at', { ascending: false })
            .limit(50);
          if (fbErr) { setChallengePlaylists([]); return; }
          setChallengePlaylists(((pls || []) as any[]).map((p: any) => ({ id: p.id as string, title: (p.title || '') as string })));
          WHATS_DEBUG('loadChallenges:setChallengePlaylists', {
            source: 'title_fallback',
            ids: (pls || []).map((p: any) => p.id),
            count: (pls || []).length,
          });
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
        // eslint-disable-next-line no-console
        console.log('[WPP_DEBUG] loadChallenges:finalChallengePlaylists', {
          count: ((pls || []) as any[]).length,
        });
        WHATS_DEBUG('loadChallenges:setChallengePlaylists', {
          source: 'legacy_ids_lookup',
          ids: (pls || []).map((p: any) => p.id),
          count: (pls || []).length,
        });
      } catch (error) {
        setChallengePlaylists([]);
        WHATS_DEBUG('loadChallenges:error', error);
      }
      WHATS_DEBUG('loadChallenges:done');
    };
    loadChallenges();
  }, []);

  // Load current user's selected challenge + preferred time
  useEffect(() => {
    const fetchUserChallenges = async () => {
      try {
        WHATS_DEBUG('fetchUserChallenges:start');
        const clean = getFullPhoneNumber();
        let rows: any[] = [];
        // eslint-disable-next-line no-console
        console.log('[WPP_DEBUG] fetchUserChallenges:start', {
          cleanPhone: clean,
          userId: user?.id ?? null,
        });
        WHATS_DEBUG('fetchUserChallenges:phoneAndUser', { clean, userId: user?.id });
        
        // Primeiro, tentar buscar por número de telefone se disponível
        if (clean) {
          const { data, error } = await supabase
            .from('whatsapp_user_challenges')
            .select('playlist_id, send_time, created_at')
            .eq('phone_number', clean);
          if (!error && data) {
            rows = data;
            // eslint-disable-next-line no-console
            console.log('[WPP_DEBUG] fetchUserChallenges:byPhone', {
              count: (rows || []).length,
              rows,
            });
            WHATS_DEBUG('fetchUserChallenges:byPhone', { error, data });
          }
        }
        
        // Se não encontrou por telefone e usuário está logado, tentar buscar por user_id
        if (rows.length === 0 && user?.id) {
          try {
            const { data, error } = await supabase
              .from('whatsapp_user_challenges')
              .select('playlist_id, send_time, created_at')
              .eq('user_id', user.id);
            if (!error && data) {
              rows = data;
              // eslint-disable-next-line no-console
              console.log('[WPP_DEBUG] fetchUserChallenges:byUserId', {
                count: (rows || []).length,
                rows,
              });
              WHATS_DEBUG('fetchUserChallenges:byUserId', { error, data });
            }
          } catch (e) {
            // Ignorar erro se coluna user_id não existir
            console.warn('Erro ao buscar desafio por user_id:', e);
          }
        }
        WHATS_DEBUG('fetchUserChallenges:rowsFinal', rows);
        
        if (rows.length === 0) {
          setSelectedChallengeId(null);
          setChallengeTime("");

          // Fallback: se não houver vínculo ainda, tentar reaproveitar a playlist escolhida no onboarding (passo 2)
          // Isso cobre o caso em que o usuário escolheu o desafio no onboarding mas só cadastrou o WhatsApp depois em /whatsapp.
          // Nota: não precisa esperar clean (telefone) porque as fontes de fallback (admin_form_responses e localStorage) não dependem dele
          if (!attemptedOnboardingLink && user?.id) {
            WHATS_DEBUG('fetchUserChallenges:noRows_beforeFallback', { attemptedOnboardingLink, hasUser: !!user?.id });
            setAttemptedOnboardingLink(true);
            try {
              let playlistId: string | null = null;

              // 1) Tentar buscar o formulário/resposta do passo 2 do onboarding
              let step2Form: any = null;
              try {
                const { data: primary, error: primaryErr } = await supabase
                  .from('admin_forms')
                  .select('id')
                  .eq('form_type', 'onboarding')
                  .eq('is_active', true)
                  .eq('onboard_step', 2)
                  .maybeSingle();
                if (!primaryErr && primary) {
                  step2Form = primary;
                }
              } catch (e) {
                console.warn('Falha ao buscar formulário do passo 2 (WhatsAppSetup):', e);
              }
              WHATS_DEBUG('fetchUserChallenges:step2FormLookup', { step2FormId: step2Form?.id });

              if (step2Form?.id) {
                const { data: resp, error: respErr } = await supabase
                  .from('admin_form_responses')
                  .select('answers, created_at')
                  .eq('user_id', user.id)
                  .eq('form_id', step2Form.id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (!respErr && resp?.answers && typeof (resp as any).answers === 'object') {
                  const ans: any = (resp as any).answers;
                  if (typeof ans.option === 'string') {
                    playlistId = ans.option;
                    // eslint-disable-next-line no-console
                    console.log('[WPP_DEBUG] fetchUserChallenges:step2Answers', {
                      step2FormId: step2Form.id,
                      ans,
                      playlistId,
                    });
                    WHATS_DEBUG('fetchUserChallenges:step2Response', { step2FormId: step2Form.id, ans, playlistId });
                  }
                }
              }

              // 2) Fallback extra: se ainda não tiver playlistId, usar o localStorage do onboarding
              if (!playlistId && typeof window !== "undefined") {
                try {
                  const stored = window.localStorage.getItem("ag_onb_selected_playlist");
                  if (stored && typeof stored === "string") {
                    playlistId = stored;
                    // eslint-disable-next-line no-console
                    console.log('[WPP_DEBUG] fetchUserChallenges:localStorage', {
                      stored,
                    });
                    WHATS_DEBUG('fetchUserChallenges:localStorage', { stored });
                  }
                } catch {
                  // ignore
                }
              }
              WHATS_DEBUG('fetchUserChallenges:fallbackFinalPlaylistId', { playlistId });

              if (playlistId) {
                // Reconectar a jornada usando a playlist escolhida no onboarding
                setSelectedChallengeId(playlistId);
                const defaultTime = challengeTime && challengeTime.length >= 4 ? challengeTime : "08:00";
                setChallengeTime(defaultTime);
                // Se a playlist escolhida ainda não está em challengePlaylists, buscar e adicioná-la
                try {
                  const { data: pl, error: plErr } = await supabase
                    .from('playlists')
                    .select('id,title')
                    .eq('id', playlistId)
                    .maybeSingle();
                  if (!plErr && pl) {
                    setChallengePlaylists(prev => {
                      if (prev.some(p => p.id === pl.id)) return prev;
                      return [
                        ...prev,
                        {
                          id: pl.id as string,
                          title: (pl.title || '') as string,
                        },
                      ];
                    });
                  }
                } catch (e) {
                  console.warn('Falha ao garantir playlist do onboarding em challengePlaylists:', e);
                }
                // eslint-disable-next-line no-console
                console.log('[WPP_DEBUG] fetchUserChallenges:usingFallbackPlaylist', {
                  playlistId,
                  challengeTime: defaultTime,
                });
                WHATS_DEBUG('fetchUserChallenges:applyFallbackSelection', { playlistId, defaultTime });

                // Garantir que a flag de desafio diário esteja ligada para que a cron possa enviar após a primeira mensagem.
                if (!dailyPrayer) {
                  setTimeout(() => {
                    updatePreference('receives_daily_prayer', true);
                  }, 100);
                }
              }
            } catch (e) {
              console.warn('Falha ao reaproveitar playlist do onboarding em /whatsapp:', e);
            }
          }
          WHATS_DEBUG('fetchUserChallenges:done', { rows: 0 });
          return;
        }
        
        // pick the most recent selection
        rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        const row = rows[0];
        setSelectedChallengeId(row.playlist_id as string);
        const t = typeof row.send_time === 'string' && row.send_time.length >= 5 ? String(row.send_time).slice(0, 5) : '';
        // Se não houver horário salvo, usar padrão 08:00
        setChallengeTime(t || "08:00");
        // eslint-disable-next-line no-console
        console.log('[WPP_DEBUG] fetchUserChallenges:fromRows', {
          chosenRow: row,
          finalTime: t || '08:00',
        });
        WHATS_DEBUG('fetchUserChallenges:done', { rows: rows.length, chosenRow: row });
      } catch (error) {
        setSelectedChallengeId(null);
        setChallengeTime("");
        WHATS_DEBUG('fetchUserChallenges:done', { error });
      }
    };
    fetchUserChallenges();
  }, [phone, phoneNumber, countryCode, user?.id, attemptedOnboardingLink, dailyPrayer]);

  // Auto-save when both challenge and time are set
  useEffect(() => {
    // Só salvar se tiver número salvo ou user_id
    const clean = getFullPhoneNumber();
    if (selectedChallengeId && challengeTime && challengeTime.length >= 4 && (clean || user?.id)) {
      WHATS_DEBUG('autosave:start', { selectedChallengeId, challengeTime, clean, userId: user?.id });
      const timer = setTimeout(() => {
        saveChallengeSelection();
      }, 500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChallengeId, challengeTime, phone, user?.id]);

  async function save() {
    // Construir número completo a partir dos campos separados
    const parsedNumber = parsePhoneNumber(phoneNumber);
    if (!parsedNumber || !validatePhoneNumber(countryCode, phoneNumber)) {
      toast.error("Digite um número válido");
      return;
    }
    
    // Construir número completo: código do país + número
    const fullNumber = countryCode + parsedNumber;
    
    // Verificar se o usuário está logado (se redirectIfNotLoggedIn estiver ativo)
    if (redirectIfNotLoggedIn && !user?.id) {
      toast.error("Você precisa estar logado para salvar o número");
      return;
    }
    
    setSaving(true);
    try {
      // Garantir que user_id seja sempre salvo quando o usuário está logado
      // O número deve estar vinculado ao usuário no Supabase para poder buscar dados incluindo WhatsApp e email
      if (!user?.id) {
        toast.error("Você precisa estar logado para salvar o número");
        return;
      }

      const payload: any = {
        phone_number: fullNumber,
        user_id: user.id, // Sempre salvar user_id quando usuário está logado
        name: user?.email?.split("@")[0] ?? "Irmão(ã)",
        is_active: true,
        receives_daily_verse: false,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from("whatsapp_users").upsert(
        payload,
        { onConflict: "phone_number" }
      );
      
      if (error) {
        // Se o erro for sobre user_id não existir, informar que precisa rodar a migration
        if (error.message?.includes("user_id") || error.message?.includes("schema cache")) {
          console.error("Coluna user_id não encontrada. Execute a migration: add_user_id_to_whatsapp_users.sql");
          toast.error("Erro ao salvar. A coluna user_id não existe na tabela. Execute a migration SQL.");
        } else {
          throw error;
        }
      }
      
      toast.success("Número salvo com sucesso. Envie /start no seu WhatsApp.");
      setIsActive(true);
      // Atualizar estado phone para manter compatibilidade
      setPhone(fullNumber);
      setIsEditingPhone(false); // Sair do modo de edição após salvar

      // Persistir número no localStorage como fonte de verdade para o frontend
      const key = getLocalStorageKey();
      if (typeof window !== "undefined" && key) {
        try {
          window.localStorage.setItem(
            key,
            JSON.stringify({
              full: fullNumber,
              formatted: formatPhoneNumber(parsedNumber),
              country,
              countryCode,
            })
          );
        } catch (e) {
          console.warn("Erro ao salvar telefone no localStorage após salvar número:", e);
        }
      }
      
      // Recarregar dados do Supabase para atualizar o estado (incluindo has_sent_first_message)
      if (user?.id) {
        const { data: updatedRow } = await supabase
          .from('whatsapp_users')
          .select('phone_number, has_sent_first_message')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (updatedRow) {
          setHasSentFirstMessage(updatedRow.has_sent_first_message ?? false);
        }
      }
      setLoadingFirstMessage(false);
      
      if (typeof onSavedPhone === 'function') onSavedPhone(fullNumber);
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
    const clean = getFullPhoneNumber();
    // Precisa ter pelo menos phone_number ou user_id para salvar
    if (!clean && !user?.id) {
      return;
    }
    try {
      if (!selectedChallengeId) {
        return;
      }
      if (!challengeTime || challengeTime.length < 4) {
        return;
      }
      
      const payload: any = {
        playlist_id: selectedChallengeId,
        send_time: challengeTime,
      };
      WHATS_DEBUG('autosave:payload', payload);
      
      // Adicionar phone_number se disponível
      if (clean) {
        payload.phone_number = clean;
      }
      
      // Adicionar user_id se disponível
      if (user?.id) {
        payload.user_id = user.id;
      }
      
      // Validar que temos pelo menos um identificador antes de salvar
      if (!payload.phone_number && !payload.user_id) {
        return;
      }
      
      // Keep only one selection: delete others first
      if (clean) {
        await supabase
          .from('whatsapp_user_challenges')
          .delete()
          .eq('phone_number', clean)
          .neq('playlist_id', selectedChallengeId);
      }
      
      if (user?.id) {
        await supabase
          .from('whatsapp_user_challenges')
          .delete()
          .eq('user_id', user.id)
          .neq('playlist_id', selectedChallengeId);
      }
      
      // Upsert current selection with time
      const conflictKey = clean ? 'phone_number,playlist_id' : 'user_id,playlist_id';
      const { error } = await supabase
        .from('whatsapp_user_challenges')
        .upsert(payload, { onConflict: conflictKey });
      WHATS_DEBUG('autosave:result', { error });
      
      if (error) {
        // Log do erro mas não quebra a UX
        console.error('Erro ao salvar jornada:', error);
        // Não mostrar toast para não atrapalhar a experiência
      }
    } catch (e: any) {
      // Log do erro mas não quebra a UX
      console.error('Erro ao salvar jornada:', e);
      // Não mostrar toast para não atrapalhar a experiência
    }
  }

  async function updatePreference(field: "is_active" | "receives_daily_verse" | "receives_daily_prayer" | "receives_daily_routine", value: boolean) {
    const clean = getFullPhoneNumber();
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
    const clean = getFullPhoneNumber();
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
    const clean = getFullPhoneNumber();
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
          return 'Receba suas orações no Whatsapp';
        case 'onboarding_step4_instruction':
          return `Informe seu número com DDD. Exemplo: ${formattedExample}`;
        case 'onboarding_step4_label':
          return 'Digite seu número de whatsapp abaixo';
        case 'onboarding_step4_privacy_text':
          return 'Escolha o que quer receber:';
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
            return 'Receba suas orações no Whatsapp';
          case 'onboarding_step4_label':
            return 'Digite seu número de whatsapp abaixo';
          case 'onboarding_step4_privacy_text':
            return 'Escolha o que quer receber:';
          default:
            return '';
        }
      }
      return null;
    }
    return value;
  };

  const sectionTitle = getSettingValue('onboarding_step4_section_title', true) || 'Receba suas orações no Whatsapp';
  const instruction = getSettingValue('onboarding_step4_instruction', false);
  const labelText = getSettingValue('onboarding_step4_label', true) || 'Digite seu número de whatsapp abaixo';
  const privacyText = getSettingValue('onboarding_step4_privacy_text', true) || 'Escolha o que quer receber:';

  const whatsappFirstMessageUrl = "https://api.whatsapp.com/send?phone=5531996302706&text=Ol%C3%A1%2C%20gostaria%20de%20come%C3%A7ar%20a%20receber%20minhas%20ora%C3%A7%C3%B5es%20do%20Agapefy.";

  const Content = (
    <>
      {/* Card destacado para primeira mensagem - apenas quando variant é standalone, usuário tem número salvo no Supabase e não enviou primeira mensagem */}
      {variant === "standalone" && !loadingFirstMessage && hasSentFirstMessage === false && phone && phoneNumber && (
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
                <a href={whatsappFirstMessageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-6">
                  <MessageCircle className="h-4 w-4" />
                  Enviar mensagem
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>{sectionTitle}</CardTitle>
          {instruction && !(phone && phoneNumber && !isEditingPhone) && <CardDescription>{instruction}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
        <div className="space-y-4">
          {/* Se já tem número salvo e não está editando, mostra apenas o número com opção de trocar */}
          {phone && phoneNumber && !isEditingPhone ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{`+${countryCode} ${phoneNumber}`}</span>
              <span 
                className="text-xs underline cursor-pointer hover:text-foreground transition-colors" 
                onClick={() => setIsEditingPhone(true)}
              >
                trocar
              </span>
            </div>
          ) : (
            <>
              {labelText && <Label htmlFor="wpp-number">{labelText}</Label>}
              
              {/* País - linha separada */}
              <div>
                <Select value={country} onValueChange={(value) => {
                  setCountry(value);
                  // Por enquanto, apenas Brasil é suportado
                  if (value === "BR") {
                    setCountryCode("55");
                  }
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="País" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BR">Brasil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Código do país e número - mesma linha */}
              <div className="flex gap-2">
                <Input
                  id="wpp-country-code"
                  value={`+${countryCode}`}
                  readOnly
                  className="w-[100px] flex-shrink-0"
                  placeholder="+55"
                />
                <Input
                  id="wpp-number"
                  placeholder=""
                  value={phoneNumber}
                  onChange={(e) => {
                    // Remove caracteres não numéricos antes de formatar
                    const numbersOnly = e.target.value.replace(/\D/g, "");
                    const formatted = formatPhoneNumber(numbersOnly);
                    setPhoneNumber(formatted);
                  }}
                  className="flex-1"
                  maxLength={15}
                  type="tel"
                />
              </div>

              {/* Botão Salvar */}
              <Button onClick={save} disabled={saving} className="w-full">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </>
          )}

          {variant !== "embedded" && privacyText && (
            <p className="text-sm font-medium text-foreground">{privacyText}</p>
          )}
        </div>

        {variant !== "embedded" && (
          <div className="space-y-4">
            {WHATSAPP_FEATURES.bibleResponses && (
              <div className="flex items-start justify-between gap-4 p-3 rounded-md bg-muted/40">
                <div>
                  <div className="font-medium">Respostas baseadas na Bíblia</div>
                  <p className="text-sm text-muted-foreground">
                    Tire dúvidas ou pergunte sobre sua vida. As respostas serão baseadas na Bíblia.
                  </p>
                </div>
                <Switch checked={isActive} disabled onCheckedChange={(v) => updatePreference('is_active', v)} />
              </div>
            )}

            <div className="p-4 rounded-md bg-muted/40 space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-foreground">
                  Uma oração por dia do seu Desafio de orações:
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{dailyPrayer ? 'Ativo' : 'Pausado'}</span>
                  <Switch checked={dailyPrayer} onCheckedChange={(v) => updatePreference('receives_daily_prayer', v)} />
                </div>
              </div>

              {/* Card de desafio sempre visível, independente do toggle */}
              {challengePlaylists.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum desafio disponível no momento.</p>
              ) : (
                <>
                  <div className="max-w-2xl">
                    {isMobile ? (
                      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={drawerOpen}
                          aria-label="Selecione seu desafio de orações"
                          className="w-full justify-between"
                          onClick={() => setDrawerOpen(true)}
                        >
                          {selectedChallengeTitle || "Selecione ou pesquise um desafio..."}
                        </Button>
                        <DrawerContent className="h-[85vh]">
                          <DrawerHeader className="pb-2">
                            <DrawerTitle>Selecionar desafio</DrawerTitle>
                          </DrawerHeader>
                          <div className="p-4">
                            <Command
                              onValueChange={(val) => {
                                WHATS_DEBUG('combobox:onValueChange', { val });
                              }}
                            >
                              <CommandInput placeholder="Digite para filtrar..." />
                              <CommandEmpty>Nenhum desafio encontrado.</CommandEmpty>
                              <CommandGroup>
                                {challengePlaylists.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  onSelect={async () => {
                                    setSelectedChallengeId(p.id);
                                    setDrawerOpen(false);
                                    // Se não houver horário definido, definir padrão como 08:00
                                    if (!challengeTime || challengeTime.length < 4) {
                                      setChallengeTime("08:00");
                                    }
                                    // Se o toggle estiver desligado, ligar automaticamente
                                    // Aguardar um pouco para garantir que o estado foi atualizado
                                    if (!dailyPrayer) {
                                      setTimeout(() => {
                                        updatePreference('receives_daily_prayer', true);
                                      }, 100);
                                    }
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
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={challengeOpen}
                            aria-label="Selecione seu desafio de orações"
                            className="w-full justify-between"
                          >
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
                          <Command
                            onValueChange={(val) => {
                              WHATS_DEBUG('combobox:onValueChange', { val });
                            }}
                          >
                            <CommandInput placeholder="Digite para filtrar..." />
                            <CommandEmpty>Nenhum desafio encontrado.</CommandEmpty>
                            <CommandGroup>
                              {challengePlaylists.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  onSelect={async () => {
                                    setSelectedChallengeId(p.id);
                                    setChallengeOpen(false);
                                    // Se não houver horário definido, definir padrão como 08:00
                                    if (!challengeTime || challengeTime.length < 4) {
                                      setChallengeTime("08:00");
                                    }
                                    // Se o toggle estiver desligado, ligar automaticamente
                                    // Aguardar um pouco para garantir que o estado foi atualizado
                                    if (!dailyPrayer) {
                                      setTimeout(() => {
                                        updatePreference('receives_daily_prayer', true);
                                      }, 100);
                                    }
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
                      <span className="text-sm font-medium text-foreground">Quero receber no horário</span>
                    </div>
                    <div className="flex items-center gap-2">
                    <TimePicker
                      value={challengeTime}
                      onChange={(value) => {
                        setChallengeTime(value);
                      }}
                      disabled={!selectedChallengeId}
                    />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      type="button"
                      variant="default"
                      className="sm:w-auto"
                      disabled={!selectedChallengeId || !challengeTime || challengeTime.length < 4}
                      onClick={async () => {
                        // Garantir que seleção + horário estejam persistidos
                        await saveChallengeSelection();
                        // Ativar flag de desafio diário
                        if (!dailyPrayer) {
                          await updatePreference('receives_daily_prayer', true);
                        }
                      }}
                    >
                      Iniciar novo desafio
                    </Button>
                    {selectedChallengeId && dailyPrayer && (
                      <Button
                        type="button"
                        variant="outline"
                        className="sm:w-auto"
                        onClick={async () => {
                          await updatePreference('receives_daily_prayer', false);
                        }}
                      >
                        Pausar desafio
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            {WHATSAPP_FEATURES.dailyVerse && (
              <div className="flex items-start justify-between gap-4 p-3 rounded-md bg-muted/40">
                <div>
                  <div className="font-medium">Versículo Diário (em breve)</div>
                  <p className="text-sm text-muted-foreground">Você receberá um versículo diariamente em seu WhatsApp.</p>
                </div>
                <Switch checked={dailyVerse} onCheckedChange={(v) => updatePreference('receives_daily_verse', v)} />
              </div>
            )}

            {WHATSAPP_FEATURES.dailyRoutine && (
              <>
                <div className="flex items-start justify-between gap-4 p-3 rounded-md bg-muted/40">
                  <div>
                    <div className="font-medium">Minha Rotina Diária de Orações (em breve)</div>
                    <p className="text-sm text-muted-foreground">
                      Você receberá as orações da sua playlist Minha Rotina diariamente em seu WhatsApp.
                    </p>
                  </div>
                  <Switch checked={dailyRoutine} onCheckedChange={(v) => updatePreference('receives_daily_routine', v)} />
                </div>

                {dailyRoutine && (
                  <div className="p-3 rounded-md bg-muted/40 space-y-3">
                    <div>
                      <div className="font-medium">Horários das orações</div>
                      <p className="text-sm text-muted-foreground">
                        Defina os melhores horários para receber as orações da sua rotina.
                      </p>
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
              </>
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
    </>
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
      {Content}
    </div>
  );
}


