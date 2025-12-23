"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { saveFormResponse } from '@/lib/services/forms';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getPlaylistsByCategoryFast } from '@/lib/supabase-queries';
import WhatsAppSetup from '@/components/whatsapp/WhatsAppSetup';
import { useAppSettings } from '@/hooks/useAppSettings';
import { buildRoutinePlaylistFromOnboarding } from '@/lib/services/routine';
import { useRoutinePlaylist } from '@/hooks/useRoutinePlaylist';
import { Switch } from '@/components/ui/switch';
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
import { ProgressBar } from '@/components/onboarding/ProgressBar';
import { getNextStepUrl as getNextStepUrlShared, getOnboardingStepsOrder, getStepUrl, type OnboardingStep } from '@/lib/services/onboarding-steps';
import { processLinks } from '@/lib/utils';
import { Play, Pause } from 'lucide-react';
import { normalizeImageUrl, formatDuration } from '@/app/home/_utils/homeUtils';
import { usePlayer } from '@/contexts/PlayerContext';

const ONB_DEBUG = (...args: any[]) => {
  console.log('[ONB_DEBUG]', ...args);
};

interface FormOption { label: string; category_id: string }
interface AdminForm { 
  id: string; 
  name: string; 
  description?: string; 
  schema: FormOption[]; 
  onboard_step?: number | null;
  allow_other_option?: boolean;
  other_option_label?: string | null;
}
interface AudioPreview { 
  id: string; 
  title: string; 
  subtitle?: string | null; 
  duration?: number | null; 
  cover_url?: string | null;
  thumbnail_url?: string | null;
  audio_url?: string | null;
  category?: { id: string; name: string; image_url?: string | null } | null;
}

export default function OnboardingClient() {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { routinePlaylist, loading: routineLoading } = useRoutinePlaylist();
  const { playQueue, pause, play, state: playerState } = usePlayer();
  const desiredStep = useMemo(() => {
    const stepParam = searchParams?.get('step');
    const parsed = stepParam ? Number(stepParam) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [searchParams]);
  const isAdminPreview = useMemo(() => {
    const raw = (searchParams?.get('adminPreview') || searchParams?.get('preview') || '').toLowerCase();
    return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'admin';
  }, [searchParams]);
  const currentCategoryId = useMemo(() => searchParams?.get('categoryId') || '', [searchParams]);
  const activeFormId = useMemo(() => searchParams?.get('formId') || '', [searchParams]);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [selected, setSelected] = useState<string>(''); // stores selected category_id
  const [selectedKey, setSelectedKey] = useState<string>(''); // stores unique option key (index)
  const [shortText, setShortText] = useState<string>('');
  const [otherOptionText, setOtherOptionText] = useState<string>('');
  const [multiKeys, setMultiKeys] = useState<string[]>([]); // for step 4
  const [multiLabels, setMultiLabels] = useState<string[]>([]); // labels for step 4
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [category, setCategory] = useState<{ id: string; name: string; description?: string | null; image_url?: string | null } | null>(null);
  const [audios, setAudios] = useState<AudioPreview[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; title: string; description?: string | null; cover_url?: string | null }[]>([]);
  const [hasWhatsApp, setHasWhatsApp] = useState<boolean | null>(null);
  const [phoneForWhatsApp, setPhoneForWhatsApp] = useState<string>('');
  const [usedOtherSituation, setUsedOtherSituation] = useState<boolean>(false);
  const [dailyVerseEnabled, setDailyVerseEnabled] = useState<boolean>(true);
  const [savingVersePref, setSavingVersePref] = useState<boolean>(false);
  const [previousResponses, setPreviousResponses] = useState<Map<number, string>>(new Map());
  const [loadingResponses, setLoadingResponses] = useState<boolean>(false);
  const [currentStepMeta, setCurrentStepMeta] = useState<OnboardingStep | null>(null);
  const [selectedChallengePlaylist, setSelectedChallengePlaylist] = useState<{ id: string; title: string; cover_url?: string | null } | null>(null);
  const [playlistAudios, setPlaylistAudios] = useState<AudioPreview[]>([]);
  const [showOtherThankYou, setShowOtherThankYou] = useState(false);
  const [otherNextUrl, setOtherNextUrl] = useState<string | null>(null);
  const playlistCarouselRef = useRef<HTMLDivElement | null>(null);
  const previousStepRef = useRef<number>(desiredStep);
  const pauseRef = useRef<(() => void) | null>(null);
  const isPausingRef = useRef(false);
  
  // Calcular progresso do onboarding
  const { percentage: progressPercentage, loading: progressLoading } = useOnboardingProgress(desiredStep, currentCategoryId);
  
  // Determinar tipo de passo estático (definido cedo para uso em múltiplos lugares)
  const showStaticKind = searchParams?.get('showStatic') || '';

  // Verificar se usuário é admin ou já completou onboarding - redirecionar para home se necessário
  useEffect(() => {
    let mounted = true;
    async function checkAccess() {
      if (!user) return; // aguardar autenticação
      
      try {
        // Verificar se é admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        
        if (!mounted) return;
        
        if (profile?.role === 'admin') {
          // Admin não deve ver onboarding
          if (isAdminPreview) {
            return;
          }
          navigateWithFallback('/');
          return;
        }

        // Se estiver em modo de preview (flag via query), não redirecionar mesmo que não seja admin
        if (isAdminPreview) {
          return;
        }

        // Verificar se já completou o onboarding
        const res = await fetch('/api/onboarding/status', {
          headers: { 'x-user-id': user.id },
        });
        
        if (!mounted) return;
        
        if (res.ok) {
          const json = await res.json();
          // Se não há passos pendentes, o onboarding foi completado
          if (!json?.pending) {
            const stepParam = searchParams?.get('step');
            if (!isAdminPreview && !stepParam) {
              navigateWithFallback('/');
            }
            return;
          }
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Erro ao verificar acesso ao onboarding:', error);
        // Em caso de erro, permitir acesso (não bloquear)
      }
    }
    
    void checkAccess();
    return () => { mounted = false; };
  }, [user, router, isAdminPreview]);

  const withAdminPreviewFlag = (url: string): string => {
    if (!isAdminPreview) return url;
    if (!url || !url.startsWith('/onboarding')) return url;
    if (url.includes('adminPreview=')) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}adminPreview=true`;
  };

  // Navegação resiliente: tenta SPA; se ficar preso, faz fallback para navegação completa.
  const navigateWithFallback = (url: string) => {
    if (!url) return;
    const currentUrl = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '';

    try {
      if (typeof router.prefetch === 'function') {
        void router.prefetch(url);
      }
      router.replace(url);
    } catch (err) {
      if (typeof window !== 'undefined') {
        window.location.assign(url);
      }
      return;
    }

    if (typeof window === 'undefined') return;
    window.setTimeout(() => {
      const stillHere = `${window.location.pathname}${window.location.search}` === currentUrl;
      if (stillHere) {
        window.location.assign(url);
      }
    }, 1500);
  };

  // Helpers
  function parseDaysFromTitle(title?: string | null): number {
    if (!title) return 0;
    const t = String(title).toLowerCase();
    // capture the largest number preceding 'dia' or 'dias'
    const matches = [...t.matchAll(/(\d+)\s*dias?\b/g)];
    if (matches.length === 0) return 0;
    const nums = matches.map(m => Number(m[1])).filter(n => Number.isFinite(n));
    return nums.length ? Math.max(...nums) : 0;
  }

  async function getChallengePlaylistsByCategory(categoryId: string): Promise<Array<{ id: string; title: string; description?: string | null; cover_url?: string | null }>> {
    const { data, error } = await supabase
      .from('playlists')
      .select('id,title,description,cover_url,category_id,category_ids,is_challenge,is_public')
      .contains('category_ids', [categoryId])
      .eq('is_public', true)
      .eq('is_challenge', true)
      .order('created_at', { ascending: false });
    if (error) {
      // eslint-disable-next-line no-console
      console.warn('Erro ao buscar playlists de desafio por categoria:', error);
      return [];
    }
    return ((data || []) as any[]).map(p => ({ id: p.id, title: p.title, description: p.description, cover_url: p.cover_url }));
  }

  // Derived ordering and recommended selection for step 2 (avoid state changes to prevent flicker)
  const orderedChallengePlaylists = useMemo(() => {
    const arr = (playlists || []).map((p) => ({ ...p, _days: parseDaysFromTitle(p.title) }));
    arr.sort((a, b) => b._days - a._days || String(a.title || '').localeCompare(String(b.title || '')));
    return arr;
  }, [playlists]);
  const recommendedOriginalIndex = useMemo(() => {
    if (!playlists || playlists.length === 0) return '';
    const top = orderedChallengePlaylists[0];
    if (!top) return '';
    const idx = playlists.findIndex(pl => pl.id === top.id);
    return idx >= 0 ? String(idx) : '';
  }, [playlists, orderedChallengePlaylists]);
  const recommendedId = orderedChallengePlaylists[0]?.id || '';

  const buildOnboardingSettingsSnapshot = () => ({
    onboarding_step2_title: settings.onboarding_step2_title,
    onboarding_step2_subtitle: settings.onboarding_step2_subtitle,
    onboarding_step3_title: settings.onboarding_step3_title,
    onboarding_step4_section_title: settings.onboarding_step4_section_title,
    onboarding_step4_instruction: settings.onboarding_step4_instruction,
    onboarding_step4_label: settings.onboarding_step4_label,
    onboarding_step4_privacy_text: settings.onboarding_step4_privacy_text,
    onboarding_step4_skip_button: settings.onboarding_step4_skip_button,
    onboarding_step4_complete_button: settings.onboarding_step4_complete_button,
    onboarding_static_preview_active: settings.onboarding_static_preview_active,
    onboarding_static_whatsapp_active: settings.onboarding_static_whatsapp_active,
    onboarding_hardcoded_6_active: settings.onboarding_hardcoded_6_active,
    onboarding_hardcoded_7_active: settings.onboarding_hardcoded_7_active,
    onboarding_hardcoded_8_active: settings.onboarding_hardcoded_8_active,
    onboarding_static_preview_position: settings.onboarding_static_preview_position,
    onboarding_static_whatsapp_position: settings.onboarding_static_whatsapp_position,
    onboarding_hardcoded_6_position: settings.onboarding_hardcoded_6_position,
    onboarding_hardcoded_7_position: settings.onboarding_hardcoded_7_position,
    onboarding_hardcoded_8_position: settings.onboarding_hardcoded_8_position,
  });

  // When entering step 2, clear any previous radio selection (from step 1)
  useEffect(() => {
    if (desiredStep === 2) {
      setSelectedKey('');
    }
  }, [desiredStep]);

  // When returning to step 1, reset radio + helper state so the user can
  // escolher novamente o mesmo motivo sem ser "forçado" a trocar de opção.
  // Isso evita depender apenas do onValueChange do RadioGroup (que não dispara
  // se o value já for o mesmo), sem alterar o layout nem os textos.
  useEffect(() => {
    if (desiredStep === 1) {
      setSelectedKey('');
      setSelected('');
      setOtherOptionText('');
      setUsedOtherSituation(false);
    }
  }, [desiredStep]);

  // Atualizar ref da função pause (separado para evitar loops)
  useEffect(() => {
    pauseRef.current = pause;
  }, [pause]);

  // Pausar áudio quando mudar de step ou sair da página
  useEffect(() => {
    // Pausar áudio quando o step mudar (mas não na primeira renderização)
    const stepChanged = previousStepRef.current !== desiredStep && previousStepRef.current > 0;
    let timeoutId: NodeJS.Timeout | null = null;
    
    if (stepChanged && !isPausingRef.current && pauseRef.current) {
      isPausingRef.current = true;
      pauseRef.current();
      // Reset flag após um pequeno delay para evitar múltiplas chamadas
      timeoutId = setTimeout(() => {
        isPausingRef.current = false;
      }, 100);
    }
    
    previousStepRef.current = desiredStep;

    // Cleanup: pausar áudio quando o componente for desmontado (usuário sai da página)
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (!isPausingRef.current && pauseRef.current) {
        pauseRef.current();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desiredStep]);

  // Removed: Não pré-selecionar nenhuma opção automaticamente no step 2

  // Determinar playlist selecionada no passo 3 após carregar dados
  useEffect(() => {
    const staticKind = searchParams?.get('showStatic') || '';
    if (desiredStep !== 3 || staticKind === 'whatsapp') return;
    
    const categoryId = searchParams?.get('categoryId');
    if (!categoryId || !playlists || playlists.length === 0) {
      setSelectedChallengePlaylist(null);
      return;
    }

    // Prioridade: URL > DB > localStorage > recomendada
    const selPl = searchParams?.get('selPl') || '';
    let chosenPlaylistId: string | null = selPl || null;

    // Buscar do DB se usuário logado e não tem na URL
    if (!chosenPlaylistId && user?.id) {
      (async () => {
        try {
          let step2Form: any = null;
          try {
            const primary = await supabase
              .from('admin_forms')
              .select('id')
              .eq('form_type', 'onboarding')
              .eq('is_active', true)
              .eq('onboard_step', 2)
              .eq('parent_form_id', activeFormId || '-')
              .maybeSingle();
            if (!primary.error && primary.data) step2Form = primary.data;
          } catch {}
          if (!step2Form) {
            const fallback = await supabase
              .from('admin_forms')
              .select('id')
              .eq('form_type', 'onboarding')
              .eq('is_active', true)
              .eq('onboard_step', 2)
              .maybeSingle();
            if (!fallback.error) step2Form = fallback.data;
          }
          if (step2Form?.id) {
            const resp = await supabase
              .from('admin_form_responses')
              .select('answers, created_at')
              .eq('user_id', user.id)
              .eq('form_id', step2Form.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            const ans: any = (resp.data as any)?.answers || {};
            if (ans?.option && typeof ans.option === 'string') {
              chosenPlaylistId = ans.option;
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Falha ao buscar resposta do passo 2:', e);
        }
        
        // Se ainda não tem, tentar localStorage
        if (!chosenPlaylistId && typeof window !== 'undefined') {
          try {
            const localSel = window.localStorage.getItem('ag_onb_selected_playlist');
            if (localSel && typeof localSel === 'string') {
              chosenPlaylistId = localSel;
            }
          } catch {}
        }

        // Fallback: recomendada (maior número de dias)
        const plArr = playlists || [];
        if (!chosenPlaylistId && plArr.length > 0) {
          const withDays = plArr.map((p: any) => ({ ...p, _days: parseDaysFromTitle(p.title) }));
          withDays.sort((a: any, b: any) => b._days - a._days || String(a.title || '').localeCompare(String(b.title || '')));
          chosenPlaylistId = withDays[0]?.id || null;
        }

        const selected = plArr.find((p: any) => p.id === chosenPlaylistId) || null;
        setSelectedChallengePlaylist(selected ? { id: selected.id, title: selected.title, cover_url: selected.cover_url } : null);
      })();
    } else {
      // Para usuários não logados ou quando já tem selPl na URL
      // Tentar localStorage se não tem na URL
      if (!chosenPlaylistId && typeof window !== 'undefined') {
        try {
          const localSel = window.localStorage.getItem('ag_onb_selected_playlist');
          if (localSel && typeof localSel === 'string') {
            chosenPlaylistId = localSel;
          }
        } catch {}
      }

      // Fallback: recomendada (maior número de dias)
      const plArr = playlists || [];
      if (!chosenPlaylistId && plArr.length > 0) {
        const withDays = plArr.map((p: any) => ({ ...p, _days: parseDaysFromTitle(p.title) }));
        withDays.sort((a: any, b: any) => b._days - a._days || String(a.title || '').localeCompare(String(b.title || '')));
        chosenPlaylistId = withDays[0]?.id || null;
      }

      const selected = plArr.find((p: any) => p.id === chosenPlaylistId) || null;
      setSelectedChallengePlaylist(selected ? { id: selected.id, title: selected.title, cover_url: selected.cover_url } : null);
    }
  }, [desiredStep, playlists, searchParams, user?.id, activeFormId]);

  // Buscar áudios da playlist selecionada quando ela mudar
  useEffect(() => {
    if (!selectedChallengePlaylist?.id || desiredStep !== 3) {
      setPlaylistAudios([]);
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        // eslint-disable-next-line no-console
        console.log('🔍 Buscando áudios da playlist:', selectedChallengePlaylist.id);
        
        // Usar a mesma sintaxe que funciona em useRoutinePlaylist
        const { data, error } = await supabase
          .from('playlist_audios')
          .select(`
            position,
            audio:audios(
              *,
              category:categories(*)
            )
          `)
          .eq('playlist_id', selectedChallengePlaylist.id)
          .order('position', { ascending: true });

        if (error) {
          // eslint-disable-next-line no-console
          console.error('❌ Erro na query de áudios:', error);
          // eslint-disable-next-line no-console
          console.error('Detalhes do erro:', JSON.stringify(error, null, 2));
          throw error;
        }

        // eslint-disable-next-line no-console
        console.log('📦 Dados recebidos:', data?.length || 0, 'itens');

        const audiosList = ((data || []) as any[])
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map((pa: any) => {
            const audio = pa.audio;
            if (!audio) return null;
            return {
              id: audio.id,
              title: audio.title,
              subtitle: audio.subtitle,
              duration: audio.duration,
              cover_url: audio.cover_url,
              thumbnail_url: audio.thumbnail_url,
              audio_url: audio.audio_url,
              category: audio.category ? {
                id: audio.category.id,
                name: audio.category.name,
                image_url: audio.category.image_url
              } : null
            };
          })
          .filter(Boolean) as AudioPreview[];

        if (isMounted) {
          setPlaylistAudios(audiosList);
          // eslint-disable-next-line no-console
          console.log('✅ Áudios da playlist carregados:', audiosList.length);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Falha ao buscar áudios da playlist:', e);
        if (isMounted) {
          setPlaylistAudios([]);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [selectedChallengePlaylist?.id, desiredStep]);

  // Função para scroll do carrossel de áudios
  const scrollPlaylistCarousel = (direction: 'left' | 'right') => {
    const carousel = playlistCarouselRef.current;
    if (carousel) {
      const scrollAmount = 200;
      const currentScroll = carousel.scrollLeft;
      const targetScroll = direction === 'left' 
        ? currentScroll - scrollAmount 
        : currentScroll + scrollAmount;
      
      carousel.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  // Função para determinar o próximo passo disponível e retornar a URL completa
  async function getNextStepUrl(
    currentStep: number,
    opts?: { categoryId?: string }
  ): Promise<string> {
    const parentFormId = activeFormId || form?.id || '';

    return withAdminPreviewFlag(getNextStepUrlShared(currentStep, {
      categoryId: (opts?.categoryId ?? currentCategoryId) || undefined,
      formId: parentFormId || undefined,
      settings: buildOnboardingSettingsSnapshot(),
    }));
  }

  async function resolveOtherFlowNextUrl(
    currentStep: number,
    opts?: { categoryId?: string; parentFormId?: string }
  ): Promise<string> {
    const destination = (settings as any).onboarding_other_destination || 'home';
    const parentFormId = opts?.parentFormId || activeFormId || form?.id || '';
    const categoryIdValue = (opts?.categoryId ?? currentCategoryId) || undefined;

    if (destination === 'home') {
      return '/';
    }

    if (destination === 'step') {
      const targetPosition = Number((settings as any).onboarding_other_step_position || '');
      if (Number.isFinite(targetPosition)) {
        const steps = await getOnboardingStepsOrder(buildOnboardingSettingsSnapshot());
        const targetStep = steps.find((s) => {
          if (s.position !== targetPosition || !s.isActive) return false;
          if (s.type === 'static' && s.staticKind === 'preview' && !categoryIdValue) return false;
          return true;
        });
        if (targetStep) {
          return withAdminPreviewFlag(
            getStepUrl(targetStep, {
              categoryId: categoryIdValue,
              formId: parentFormId || undefined,
            })
          );
        }
      }
    }

    // Default: continuar fluxo normal
    return withAdminPreviewFlag(getNextStepUrlShared(currentStep, {
      categoryId: categoryIdValue || undefined,
      formId: parentFormId || undefined,
      settings: buildOnboardingSettingsSnapshot(),
    }));
  }

  // Função helper chamada após salvar o WhatsApp:
  // - conecta a playlist de desafio (se houver)
  // - atualiza o estado local de hasWhatsApp
  // A navegação para o próximo passo fica a cargo do botão "Avançar".
  async function handleWhatsAppSaved(phone: string) {
    ONB_DEBUG('handleWhatsAppSaved:start', {
      rawPhone: phone,
      userId: user?.id ?? null,
      activeFormId,
      formId: form?.id ?? null,
    });
    setHasWhatsApp(true);
    try {
      const cleanPhone = (phone || '').replace(/\D/g, '');
      ONB_DEBUG('handleWhatsAppSaved:cleanPhone', {
        cleanPhone,
        hasUser: !!user?.id,
      });

      // Se o usuário estiver logado e tivermos um telefone válido,
      // tentar vincular automaticamente a playlist de desafio escolhida no passo 2
      if (user?.id && cleanPhone) {
        try {
          // Descobrir o formulário do passo 2 (mesma lógica usada para recuperar a playlist no passo 3)
          let step2Form: any = null;
          const parentFormId = activeFormId || form?.id || '';

          try {
            const primary = await supabase
              .from('admin_forms')
              .select('id')
              .eq('form_type', 'onboarding')
              .eq('is_active', true)
              .eq('onboard_step', 2)
              .eq('parent_form_id', parentFormId || '-')
              .maybeSingle();
            if (!primary.error && primary.data) {
              step2Form = primary.data;
              ONB_DEBUG('handleWhatsAppSaved:primaryStep2Form', {
                parentFormId,
                step2FormId: step2Form?.id,
              });
            }
          } catch (e) {
            console.warn('Falha ao buscar formulário principal do passo 2:', e);
          }

          // Fallback: buscar qualquer formulário ativo do passo 2 se não houver parent_form_id
          if (!step2Form) {
            try {
              const fallback = await supabase
                .from('admin_forms')
                .select('id')
                .eq('form_type', 'onboarding')
                .eq('is_active', true)
                .eq('onboard_step', 2)
                .maybeSingle();
              if (!fallback.error && fallback.data) {
                step2Form = fallback.data;
              ONB_DEBUG('handleWhatsAppSaved:fallbackStep2Form', {
                step2FormId: step2Form?.id,
              });
              }
            } catch (e) {
              console.warn('Falha ao buscar formulário fallback do passo 2:', e);
            }
          }

          // Se existe formulário do passo 2, buscar a última resposta do usuário
          if (step2Form?.id) {
            const resp = await supabase
              .from('admin_form_responses')
              .select('answers, created_at')
              .eq('user_id', user.id)
              .eq('form_id', step2Form.id)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            const ans: any = (resp.data as any)?.answers || {};
            const playlistId = typeof ans?.option === 'string' ? ans.option : null;
            ONB_DEBUG('handleWhatsAppSaved:step2Response', {
              resp,
              ans,
              playlistId,
            });

            // Se o usuário escolheu uma playlist de desafio, criar/atualizar o vínculo em whatsapp_user_challenges
            if (playlistId) {
              const payload: any = {
                phone_number: cleanPhone,
                playlist_id: playlistId,
                // Horário padrão para início da jornada, caso o usuário ainda não defina outro em /whatsapp
                send_time: '08:00',
              };

              try {
                await supabase
                  .from('whatsapp_user_challenges')
                  .upsert(payload, { onConflict: 'phone_number,playlist_id' });
                ONB_DEBUG('handleWhatsAppSaved:upsertPayload', payload);
                ONB_DEBUG('handleWhatsAppSaved:upsertSuccess', {
                  payload,
                });

                // Além de vincular o desafio, garantir que a flag de jornada diária esteja ligada.
                // Isso permite que, após a primeira mensagem no WhatsApp, a cron de desafio
                // já encontre o usuário elegível sem exigir que ele visite /whatsapp.
                try {
                  await supabase
                    .from('whatsapp_users')
                    .upsert(
                      {
                        phone_number: cleanPhone,
                        receives_daily_prayer: true,
                        is_active: true,
                        updated_at: new Date().toISOString(),
                      },
                      { onConflict: 'phone_number' }
                    );
                  ONB_DEBUG('handleWhatsAppSaved:receivesDailyPrayerEnabled', {
                    phone: cleanPhone,
                    playlistId,
                  });
                } catch (prefErr) {
                  console.warn('Falha ao ativar receives_daily_prayer no onboarding:', prefErr);
                }
              } catch (e) {
                // Não quebrar o fluxo do onboarding se esse vínculo falhar
                console.warn('Erro ao vincular desafio do onboarding ao WhatsApp:', e);
              }
            }
          }
        } catch (e) {
          console.warn('Falha ao vincular desafio do onboarding ao WhatsApp:', e);
        }
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[ONB_DEBUG] handleWhatsAppSaved:outerError', error);
    }
  }

  // Função para determinar o passo anterior e retornar a URL completa
  async function getPreviousStepUrl(): Promise<string | null> {
    if (desiredStep <= 1) {
      return null; // Não há passo anterior ao primeiro
    }

    const parentFormId = activeFormId || form?.id || '';

    const steps = await getOnboardingStepsOrder(buildOnboardingSettingsSnapshot());
    
    // Filtrar apenas passos ativos
    let activeSteps = steps.filter((s) => s.isActive);
    
    // Verificação especial para passo preview: só está disponível se tiver categoryId
    activeSteps = activeSteps.filter((s) => {
      if (s.type === 'static' && s.staticKind === 'preview') {
        return !!currentCategoryId;
      }
      return true;
    });

    // Ordenar por position para garantir ordem correta
    activeSteps.sort((a, b) => a.position - b.position);

    // Encontrar o índice do passo atual na lista de passos ativos
    const currentIndex = activeSteps.findIndex((s) => s.position === desiredStep);
    
    let previousStep: OnboardingStep | undefined;
    
    if (currentIndex > 0) {
      // Se encontrou o passo atual na lista de ativos, pegar o anterior da lista
      previousStep = activeSteps[currentIndex - 1];
    } else {
      // Fallback: buscar o último passo ativo com position < desiredStep
      const previousSteps = activeSteps.filter((s) => s.position < desiredStep);
      if (previousSteps.length > 0) {
        previousStep = previousSteps[previousSteps.length - 1];
      }
    }

    if (previousStep) {
      // Usar a função getStepUrl do módulo onboarding-steps
      const { getStepUrl } = await import('@/lib/services/onboarding-steps');
      return withAdminPreviewFlag(
        getStepUrl(previousStep, {
          categoryId: currentCategoryId || undefined,
          formId: parentFormId || undefined,
        })
      );
    }

    // Se não encontrou passo anterior, voltar para o passo 1
    return withAdminPreviewFlag(`/onboarding?step=1${currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : ''}${parentFormId ? `&formId=${encodeURIComponent(parentFormId)}` : ''}`);
  }

  // Função para voltar ao passo anterior
  async function handleGoBack() {
    const previousUrl = await getPreviousStepUrl();
    if (previousUrl) {
      navigateWithFallback(previousUrl);
    }
  }

  // Persistir preferência de versículo diário imediatamente quando o usuário alternar no passo 8.
  // Isso garante que o toggle em `/eu` já apareça sincronizado sem exigir novo clique em "Salvar".
  async function persistDailyVersePreference(nextValue: boolean) {
    try {
      let phone = phoneForWhatsApp;
      if ((!hasWhatsApp || !phone) && typeof window !== 'undefined') {
        try {
          const localPhone = window.localStorage.getItem('agape_whatsapp_phone');
          if (localPhone) phone = localPhone;
        } catch {}
      }
      if (!phone) return; // precisa de telefone para persistir a preferência
      await supabase
        .from('whatsapp_users')
        .upsert(
          {
            phone_number: phone,
            user_id: user?.id || null,
            receives_daily_verse: nextValue,
            updated_at: new Date().toISOString(),
          } as any,
          { onConflict: 'phone_number' }
        );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('persistDailyVersePreference error:', e);
    }
  }

  // Extrai um valor legível da resposta de um formulário anterior
  async function extractResponseValue(formId: string, answers: Record<string, any>, onboardStep: number): Promise<string> {
    try {
      if (answers.other_option && typeof answers.other_option === 'string' && answers.other_option.trim()) {
        return answers.other_option.trim();
      }
      if (answers.text && typeof answers.text === 'string' && answers.text.trim()) {
        return answers.text.trim();
      }
      // Para o passo 2, quando salvamos o id da playlist selecionada
      if (onboardStep === 2 && answers.option && typeof answers.option === 'string') {
        try {
          const { data, error } = await supabase
            .from('playlists')
            .select('title')
            .eq('id', answers.option)
            .maybeSingle();
          if (!error && data?.title) {
            return data.title as string;
          }
        } catch {}
      }
      if (answers.option) {
        const { data: formData, error: formError } = await supabase
          .from('admin_forms')
          .select('schema')
          .eq('id', formId)
          .maybeSingle();
        if (!formError && formData && Array.isArray((formData as any).schema)) {
          const option = (formData as any).schema.find((opt: any) => opt?.category_id === answers.option);
          if (option && option.label) {
            return option.label as string;
          }
        }
      }
      return '';
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Erro ao extrair valor da resposta:', error);
      return '';
    }
  }

  // Substitui {respostaN} nos textos
  function replaceResponseVariables(text: string | null | undefined, responsesMap: Map<number, string>): string {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/\{resposta(\d+)\}/gi, (_match, stepNum) => {
      const step = Number.parseInt(stepNum, 10);
      if (Number.isFinite(step) && responsesMap.has(step)) {
        return responsesMap.get(step) || '';
      }
      return '';
    });
  }

  // Busca respostas anteriores até o passo atual
  async function fetchPreviousResponses(
    currentStep: number,
    params?: { userId: string | null; categoryId: string | null; rootFormId: string | null }
  ) {
    const userId = params?.userId ?? user?.id ?? null;
    const categoryId = params?.categoryId ?? currentCategoryId ?? null;
    const rootFormId = params?.rootFormId ?? (searchParams?.get('formId') || null);
    setLoadingResponses(true);
    try {
      if (currentStep <= 1) {
        setPreviousResponses(new Map());
        setLoadingResponses(false);
        return;
      }

      // Fallback rápido para {resposta1} quando usuário não logado, via categoryId,
      // priorizando o formId da sessão (Testar Onboarding) para garantir o schema correto do passo 1.
      if (!userId && currentStep > 1 && categoryId) {
        try {
          const sessionFormId = (rootFormId || '').trim();
          let step1Form: any = null;

          if (sessionFormId) {
            const { data: byId } = await supabase
              .from('admin_forms')
              .select('id, schema, onboard_step')
              .eq('id', sessionFormId)
              .maybeSingle();
            // aceitar se for passo 1 (ou raiz sem onboard_step definido)
            if (byId && (byId as any).schema && (((byId as any).onboard_step ?? 1) === 1)) {
              step1Form = byId;
            }
          }

          if (!step1Form) {
            const { data: byStep } = await supabase
              .from('admin_forms')
              .select('id, schema')
              .eq('form_type', 'onboarding')
              .eq('is_active', true)
              .eq('onboard_step', 1)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();
            step1Form = byStep;
          }

          if (step1Form && Array.isArray((step1Form as any).schema)) {
            const match = (step1Form as any).schema.find((opt: any) => opt?.category_id === categoryId);
            if (match?.label) {
              const map = new Map<number, string>();
              map.set(1, match.label as string);
              setPreviousResponses(map);
              setLoadingResponses(false);
              return;
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Erro no fallback de categoryId/formId:', e);
        }
        setPreviousResponses(new Map());
        setLoadingResponses(false);
        return;
      }

      if (!userId) {
        setPreviousResponses(new Map());
        setLoadingResponses(false);
        return;
      }

      // Buscar formulários anteriores
      const { data: forms, error: formsError } = await supabase
        .from('admin_forms')
        .select('id, onboard_step, schema')
        .eq('form_type', 'onboarding')
        .eq('is_active', true)
        .lt('onboard_step', currentStep)
        .not('onboard_step', 'is', null)
        .order('onboard_step', { ascending: true });
      
      const responsesTextMap = new Map<number, string>();
      
      // Se há formulários anteriores, buscar respostas salvas
      if (!formsError && forms && (forms as any[]).length > 0) {
        const formIds = (forms as any[]).map(f => f.id);
        const { data: responses, error: responsesError } = await supabase
          .from('admin_form_responses')
          .select('form_id, answers')
          .eq('user_id', userId)
          .in('form_id', formIds);
        
        if (!responsesError && responses) {
          // Montar mapa step -> valor
          const responseMap = new Map<string, { answers: Record<string, any>; onboard_step: number }>();
          (responses as any[]).forEach((resp: any) => {
            const formMatch = (forms as any[]).find((f: any) => f.id === resp.form_id);
            if (formMatch && typeof formMatch.onboard_step === 'number') {
              responseMap.set(resp.form_id, { answers: resp.answers, onboard_step: formMatch.onboard_step });
            }
          });
          
          for (const [formId, { answers, onboard_step }] of responseMap.entries()) {
            const value = await extractResponseValue(formId, answers, onboard_step);
            if (value) responsesTextMap.set(onboard_step, value);
          }
        }
      }

      // Fallback extra para {resposta1} via categoryId quando não houver resposta salva com user_id
      // Este fallback funciona tanto para usuários logados quanto não logados
      if (currentStep > 1 && categoryId && !responsesTextMap.has(1)) {
        // Tentar primeiro com o formulário do passo 1 que já foi buscado (se houver)
        const step1Form = forms && (forms as any[]).find((f: any) => f.onboard_step === 1);
        if (step1Form && Array.isArray((step1Form as any).schema)) {
          const match = (step1Form as any).schema.find((opt: any) => opt?.category_id === categoryId);
          if (match?.label) {
            responsesTextMap.set(1, match.label);
          }
        } else {
          // Se não encontrou no forms já buscado, buscar diretamente do banco
          // Priorizar o formulário raiz (parent_form_id) se rootFormId estiver disponível
          let step1FormToUse: any = null;
          
          if (rootFormId) {
            const { data: byId } = await supabase
              .from('admin_forms')
              .select('id, schema, onboard_step')
              .eq('id', rootFormId)
              .maybeSingle();
            // aceitar se for passo 1 (ou raiz sem onboard_step definido)
            if (byId && (byId as any).schema && (((byId as any).onboard_step ?? 1) === 1)) {
              step1FormToUse = byId;
            }
          }
          
          if (!step1FormToUse) {
            const { data: byStep } = await supabase
              .from('admin_forms')
              .select('id, schema')
              .eq('form_type', 'onboarding')
              .eq('is_active', true)
              .eq('onboard_step', 1)
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle();
            step1FormToUse = byStep;
          }
          
          if (step1FormToUse && Array.isArray((step1FormToUse as any).schema)) {
            const match = (step1FormToUse as any).schema.find((opt: any) => opt?.category_id === categoryId);
            if (match?.label) {
              responsesTextMap.set(1, match.label);
            }
          }
        }
      }

      setPreviousResponses(responsesTextMap);
      setLoadingResponses(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('Erro ao buscar respostas anteriores:', error);
      setPreviousResponses(new Map());
      setLoadingResponses(false);
    }
  }

  // Versão processada do formulário aplicando {respostaN}
  const processedForm = useMemo(() => {
    if (!form) return null;
    const processed: any = {
      ...form,
      name: replaceResponseVariables((form as any).name as any, previousResponses),
      description: replaceResponseVariables((form as any).description as any, previousResponses),
      other_option_label: replaceResponseVariables((form as any).other_option_label as any, previousResponses),
      schema: Array.isArray((form as any).schema)
        ? (form as any).schema.map((opt: any) => {
            if (opt?.type === 'info') {
              return {
                ...opt,
                title: replaceResponseVariables(opt.title, previousResponses),
                subtitle: replaceResponseVariables(opt.subtitle, previousResponses),
                explanation: replaceResponseVariables(opt.explanation, previousResponses),
                buttonText: replaceResponseVariables(opt.buttonText, previousResponses),
              };
            }
            return {
              ...opt,
              label: replaceResponseVariables(opt.label, previousResponses),
            };
          })
        : (form as any).schema,
    };
    return processed as AdminForm;
  }, [form, previousResponses]);
  // Carrossel da categoria (preview sem play)
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollCarousel = (direction: 'left' | 'right') => {
    const carousel = carouselRef.current;
    if (!carousel) return;
    const scrollAmount = 240;
    const current = carousel.scrollLeft;
    const target = direction === 'left' ? current - scrollAmount : current + scrollAmount;
    carousel.scrollTo({ left: target, behavior: 'smooth' });
  };

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const stepParam = Number(searchParams?.get('step') || desiredStep || 1);
        
        // VERIFICAÇÃO CRÍTICA: Verificar se o passo solicitado está ativo
        const steps = await getOnboardingStepsOrder(buildOnboardingSettingsSnapshot());

        if (!steps || steps.length === 0) {
          console.warn('Onboarding indisponível: lista de passos vazia');
          setCurrentStepMeta(null);
          setLoading(false);
          return;
        }
        const requestedStep = steps.find(s => s.position === stepParam);
        if (mounted) {
          setCurrentStepMeta(requestedStep || null);
        }

        // Regra especial: o passo informativo final de WhatsApp (step=11)
        // só deve aparecer para quem escolheu "Outra Situação" no passo 1.
        // Para os demais fluxos, ao tentar acessar esse passo, redirecionamos direto para a home.
        if (requestedStep && requestedStep.type === 'info' && stepParam === 11 && !usedOtherSituation) {
          if (mounted) {
            navigateWithFallback('/');
          }
          return;
        }
        
        // Se o passo solicitado não existe ou está inativo, redirecionar para o próximo ativo
        if ((!requestedStep || !requestedStep.isActive) && steps.length > 0) {
          // Encontrar o último passo ativo antes do solicitado, ou usar 0 se não houver
          const activeStepsBefore = steps
            .filter(s => s.isActive && s.position < stepParam)
            .sort((a, b) => b.position - a.position);
          const previousActiveStep = activeStepsBefore[0]?.position ?? 0;
          
          const nextUrl = await getNextStepUrl(previousActiveStep, {
            categoryId: searchParams?.get('categoryId') || undefined,
          });
          if (mounted) {
            navigateWithFallback(nextUrl);
            return;
          }
        }
        
        const categoryIdFromUrl = searchParams?.get('categoryId') || null;
        const rootFormIdFromUrl = searchParams?.get('formId') || null;
        await fetchPreviousResponses(stepParam, {
          userId: user?.id ?? null,
          categoryId: categoryIdFromUrl,
          rootFormId: rootFormIdFromUrl,
        });
        const staticKind = searchParams?.get('showStatic') || '';
        if (desiredStep === 1) {
          // Primeiro tenta pelo passo configurado = 1
          const primary = await supabase
            .from('admin_forms')
            .select('*')
            .eq('form_type', 'onboarding')
            .eq('is_active', true)
            .eq('onboard_step', desiredStep)
            .maybeSingle();
          if (primary.error) throw primary.error;

          if (primary.data) {
            if (mounted) setForm((primary.data as AdminForm) || null);
          } else {
            // Fallback: preferir o formulário raiz mais antigo (sem parent_form_id), depois o mais antigo geral
            const tryFetchOldestRoot = async () =>
              supabase
                .from('admin_forms')
                .select('*')
                .eq('form_type', 'onboarding')
                .eq('is_active', true)
                .is('parent_form_id', null)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            let fallback = await tryFetchOldestRoot();
            if (fallback.error && (fallback.error.code === '42703' || /parent_form_id/i.test(String(fallback.error.message || '')))) {
              // Coluna parent_form_id pode não existir — buscar sem esse filtro
              fallback = await supabase
                .from('admin_forms')
                .select('*')
                .eq('form_type', 'onboarding')
                .eq('is_active', true)
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();
            }
            if (fallback.error) throw fallback.error;
            if (mounted) setForm((fallback.data as AdminForm) || null);
          }
        } else if (desiredStep === 2 || staticKind === 'preview') {
          // Suporte a passo estático de preview em qualquer step via showStatic=preview
          if (staticKind === 'preview') {
            const categoryId = searchParams?.get('categoryId');
            if (!categoryId) {
              if (mounted) {
                setCategory(null);
                setAudios([]);
              }
            } else {
              const [{ data: cat, error: catErr }, { data: auds, error: audErr }, getPl] = await Promise.all([
                supabase
                .from('categories')
                .select('id,name,description,image_url')
                .eq('id', categoryId)
                .maybeSingle(),
                supabase
                  .from('audios')
                  .select('id,title,subtitle,duration,cover_url')
                  .eq('category_id', categoryId)
                  .order('created_at', { ascending: false })
                  .limit(10),
                getChallengePlaylistsByCategory(categoryId)
              ]);
              if (catErr) throw catErr;
              if (audErr) throw audErr;
              if (mounted) {
                setCategory((cat as any) || null);
                setAudios(((auds as any[]) || []) as AudioPreview[]);
                setPlaylists((getPl as any[]) || []);
              }
            }
          } else {
            // Passo 2: Preferir formulário dinâmico (inclusive múltipla escolha) se existir.
            // 1) Verificar se há um formulário ativo no passo 2 associado ao parent_form_id
            let fetched: any = null;
            let fetchErr: any = null;
            try {
              const primary = await supabase
                .from('admin_forms')
                .select('*')
                .eq('form_type', 'onboarding')
                .eq('is_active', true)
                .eq('onboard_step', 2)
                .eq('parent_form_id', activeFormId || '-')
                .maybeSingle();
              fetched = primary.data as any;
              fetchErr = primary.error as any;
            } catch (e) {
              fetchErr = e;
            }
            // 2) Se não encontrou (ou coluna não existe), buscar somente por onboard_step
            if ((!fetched || fetchErr) && activeFormId) {
              const fb = await supabase
                .from('admin_forms')
                .select('*')
                .eq('form_type', 'onboarding')
                .eq('is_active', true)
                .eq('onboard_step', 2)
                .maybeSingle();
              if (!fb.error && fb.data) {
                fetched = fb.data as any;
                fetchErr = null;
              }
            }
            // 3) Fallback se parent_form_id não existir
            if (fetchErr && (fetchErr.code === '42703' || /parent_form_id/i.test(String(fetchErr.message || '')))) {
              const fb = await supabase
                .from('admin_forms')
                .select('*')
                .eq('form_type', 'onboarding')
                .eq('is_active', true)
                .eq('onboard_step', 2)
                .maybeSingle();
              fetched = fb.data as any;
              fetchErr = fb.error as any;
            }
            // Se encontrou algum formulário no passo 2, mostrar ele (info ou não-info).
            if (fetched) {
              if (mounted) setForm((fetched as AdminForm) || null);
              // Carregar playlists de desafio da categoria selecionada (para listar como opções)
              const categoryId = searchParams?.get('categoryId');
              if (categoryId) {
                const pls = await getChallengePlaylistsByCategory(categoryId);
                if (mounted) setPlaylists(pls as any[]);
              }
            } else {
              // Sem formulário no passo 2: mostrar preview estático da categoria
              const categoryId = searchParams?.get('categoryId');
              if (!categoryId) {
                if (mounted) {
                  setCategory(null);
                  setAudios([]);
                }
              } else {
                const [{ data: cat, error: catErr }, { data: auds, error: audErr }, getPl] = await Promise.all([
                  supabase
                    .from('categories')
                    .select('id,name,description,image_url')
                    .eq('id', categoryId)
                    .maybeSingle(),
                  supabase
                    .from('audios')
                    .select('id,title,subtitle,duration,cover_url')
                    .eq('category_id', categoryId)
                    .order('created_at', { ascending: false })
                    .limit(10),
                  getChallengePlaylistsByCategory(categoryId)
                ]);
                if (catErr) throw catErr;
                if (audErr) throw audErr;
                if (mounted) {
                  setCategory((cat as any) || null);
                  setAudios(((auds as any[]) || []) as AudioPreview[]);
                  setPlaylists((getPl as any[]) || []);
                }
              }
            }
          }
        } else if (desiredStep === 3) {
          // Passo 3 pode ser estático (preview da categoria ou WhatsApp)
          // Limpar form state para garantir que não haja interferência de formulários anteriores
          if (mounted) setForm(null);
          const staticKind = searchParams?.get('showStatic') || '';
          // Só carregar dados da categoria se for preview (ou padrão sem showStatic)
          if (staticKind !== 'whatsapp') {
            const categoryId = searchParams?.get('categoryId');
            if (categoryId) {
            const [{ data: cat, error: catErr }, { data: auds, error: audErr }, plRes] = await Promise.all([
              supabase
                .from('categories')
                .select('id,name,description,image_url')
                .eq('id', categoryId)
                .maybeSingle(),
              supabase
                .from('audios')
                .select('id,title,subtitle,duration,cover_url')
                .eq('category_id', categoryId)
                .order('created_at', { ascending: false })
                .limit(10),
              getChallengePlaylistsByCategory(categoryId)
            ]);
            if (catErr) throw catErr;
            if (audErr) throw audErr;
            let playlistsArr = (plRes as any[]) || [];
            // Fallback: se não houver challenges, usar playlists públicas da categoria
            if (!playlistsArr.length) {
              try {
                const fb = await getPlaylistsByCategoryFast(categoryId);
                playlistsArr = (fb as any[]) || [];
              } catch {}
            }
            if (mounted) {
              setCategory((cat as any) || null);
              setAudios(((auds as any[]) || []) as AudioPreview[]);
              setPlaylists(playlistsArr);
              // A determinação da playlist selecionada será feita em um useEffect separado
              // para garantir que roda após o estado ser atualizado
            }
          } else {
            if (mounted) {
              setCategory(null);
              setAudios([]);
              setPlaylists([]);
              setSelectedChallengePlaylist(null);
            }
          }
          }
        } else {
          // Passos dinâmicos adicionais (>= 2, incluindo passos informativos)
          // Primeiro tenta buscar com parent_form_id
          let { data, error } = await supabase
            .from('admin_forms')
            .select('*')
            .eq('form_type', 'onboarding')
            .eq('is_active', true)
            .eq('onboard_step', desiredStep)
            .eq('parent_form_id', activeFormId || '-')
            .maybeSingle();
          
          // Se não encontrou e a coluna parent_form_id existe, tenta buscar apenas por onboard_step
          if ((!data || error) && activeFormId) {
            const fb = await supabase
              .from('admin_forms')
              .select('*')
              .eq('form_type', 'onboarding')
              .eq('is_active', true)
              .eq('onboard_step', desiredStep)
              .maybeSingle();
            if (!fb.error && fb.data) {
              data = fb.data as any;
              error = null;
            }
          }
          
          // Fallback se a coluna parent_form_id não existir: buscar apenas por onboard_step
          if (error && (error.code === '42703' || /parent_form_id/i.test(String(error.message || '')))) {
            const fb = await supabase
              .from('admin_forms')
              .select('*')
              .eq('form_type', 'onboarding')
              .eq('is_active', true)
              .eq('onboard_step', desiredStep)
              .maybeSingle();
            data = fb.data as any;
            error = fb.error as any;
          }
          if (error) throw error;
          if (mounted) setForm((data as AdminForm) || null);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        toast.error('Onboarding não disponível no momento');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [desiredStep, searchParams]);

  // Verificação para o Passo 7: se o WhatsApp já estiver configurado, redirecionar para a Home
  useEffect(() => {
    let mounted = true;
    async function checkWhatsApp() {
      try {
        if (desiredStep !== 7 && desiredStep !== 8) return;
        const { data } = await supabase
          .from('whatsapp_users')
          .select('phone_number, receives_daily_verse')
          .eq('user_id', user?.id ?? '-')
          .maybeSingle();
        if (!mounted) return;
        let hasPhone = Boolean(data?.phone_number);
        let phone = data?.phone_number || '';

        // Fallback: usar o último número salvo no dispositivo
        if (!hasPhone && typeof window !== 'undefined') {
          try {
            const localPhone = window.localStorage.getItem('agape_whatsapp_phone');
            if (localPhone) {
              phone = localPhone;
              hasPhone = true;
            }
          } catch {}
        }

        setHasWhatsApp(hasPhone);
        setPhoneForWhatsApp(phone);
        if (typeof (data as any)?.receives_daily_verse === 'boolean') {
          setDailyVerseEnabled(Boolean((data as any).receives_daily_verse));
        } else {
          setDailyVerseEnabled(true);
        }
        if (desiredStep === 7 && hasPhone) navigateWithFallback('/');
      } catch {
        if (mounted) setHasWhatsApp(false);
      }
    }
    void checkWhatsApp();
    return () => { mounted = false; };
  }, [desiredStep, user?.id, router]);

  async function submit(selectedOption?: string) {
    if (!form) {
      toast.error('Formulário não encontrado');
      return;
    }
    
    // Usar o parâmetro passado ou o estado atual
    const optionToSubmit = selectedOption !== undefined ? selectedOption : selected;
    
    // Verificar se selecionou uma opção OU preencheu o campo "Outros"
    const hasOtherOption = form.allow_other_option && otherOptionText.trim();
    if (!optionToSubmit && !hasOtherOption) {
      toast.error('Selecione uma opção ou preencha o campo "Outros"');
      return;
    }

    try {
      setSubmitting(true);
      
      // Salvar resposta do formulário
      await saveFormResponse({ 
        formId: form.id, 
        answers: { 
          option: optionToSubmit || null,
          other_option: hasOtherOption ? otherOptionText.trim() : null
        }, 
        userId: user?.id ?? null 
      });

      // Se preencheu o campo "Outros", salvar como sugestão
      if (hasOtherOption) {
        try {
          const { error: suggestionError } = await supabase
            .from('user_suggestions')
            .insert({
              user_id: user?.id || null,
              suggestion_text: otherOptionText.trim(),
              source: 'onboarding',
              form_id: form.id,
              source_id: form.id
            });
          
          if (suggestionError) {
            console.error('Erro ao salvar sugestão:', suggestionError);
            // Não bloquear o fluxo se falhar ao salvar sugestão
          }
        } catch (suggestionErr) {
          console.error('Erro ao salvar sugestão:', suggestionErr);
        }
      }

      toast.success('Resposta enviada');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      toast.error('Não foi possível enviar. Seguimos para o próximo passo.');
    } finally {
      // Se selecionou "Outra situação", redirecionar para o passo do WhatsApp
      if (hasOtherOption && selectedKey === 'other' && form) {
        try {
          const currentStep = form.onboard_step || desiredStep;
          const categoryIdForNext = currentStep === 1 && optionToSubmit ? optionToSubmit : currentCategoryId;
          const targetUrl = await resolveOtherFlowNextUrl(currentStep, {
            categoryId: categoryIdForNext || undefined,
            parentFormId: activeFormId || form.id || '',
          });
          setUsedOtherSituation(true);
          setOtherNextUrl(targetUrl);
          setShowOtherThankYou(true);
          setSubmitting(false);
          return;
        } catch (otherFlowError) {
          // eslint-disable-next-line no-console
          console.error('Erro ao processar fluxo "Outros":', otherFlowError);
          // Se falhar, continuar com fluxo normal
        }
      }
      
      // Usar getNextStepUrl para determinar o próximo passo
      if (form) {
        try {
          const currentStep = form.onboard_step || desiredStep;
          // Garantir que categoryId seja passado para getNextStepUrl quando estamos no passo 1
          const categoryIdForNext = currentStep === 1 && optionToSubmit ? optionToSubmit : currentCategoryId;
          const nextUrl = await getNextStepUrl(currentStep, { categoryId: categoryIdForNext || undefined });
          navigateWithFallback(nextUrl);
        } catch {
          // Fallback: usar getNextStepUrl em vez de hardcode
          try {
            const currentStep = form.onboard_step || desiredStep;
            const categoryIdForFallback = currentStep === 1 && optionToSubmit ? optionToSubmit : currentCategoryId;
            const fallbackUrl = await getNextStepUrl(currentStep, { categoryId: categoryIdForFallback || undefined });
            navigateWithFallback(fallbackUrl);
          } catch {
            // Último fallback: ir para home se tudo falhar
            navigateWithFallback('/');
          }
        }
      }
      setSubmitting(false);
    }
  }

  if (showOtherThankYou) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="space-y-3 text-center">
              <CardTitle className="text-2xl md:text-3xl leading-tight max-w-3xl mx-auto">
                {settings.onboarding_other_title || 'Obrigado por compartilhar'}
              </CardTitle>
              { (settings.onboarding_other_subtitle || '').trim() ? (
                <p className="text-base text-gray-600 max-w-3xl mx-auto">
                  {settings.onboarding_other_subtitle}
                </p>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  const target = otherNextUrl || '/';
                  navigateWithFallback(target);
                }}
              >
                {settings.onboarding_other_button_label || 'Continuar'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passo hardcoded: rotina pronta (via metadado)
  if (currentStepMeta?.type === 'hardcoded' && currentStepMeta?.hardcodedKind === 'routine') {
    const formatDuration = (seconds?: number | null): string | null => {
      if (!seconds && seconds !== 0) return null;
      const mins = Math.floor(seconds / 60);
      const rem = seconds % 60;
      if (!Number.isFinite(mins)) return null;
      if (rem === 0) return `${mins} min`;
      return `${mins}:${String(rem).padStart(2, '0')}`;
    };

    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-2xl md:text-3xl leading-tight max-w-4xl mx-auto">Sua rotina está pronta</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {routineLoading ? (
              <div className="space-y-3">
                <div className="h-6 w-40 bg-gray-800 rounded animate-pulse" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border border-gray-800 rounded-lg">
                      <div className="w-16 h-16 bg-gray-800 rounded" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-2/3 bg-gray-800 rounded" />
                        <div className="h-3 w-1/3 bg-gray-800 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-black">Minha Rotina</h3>
                {routinePlaylist && routinePlaylist.audios.length > 0 ? (
                  <div className="space-y-3">
                    {routinePlaylist.audios.map((audio: any) => (
                      <div key={audio.id} className="flex items-center gap-3 p-3 border border-gray-800 rounded-lg bg-white/5">
                        <div className="w-16 h-16 rounded overflow-hidden bg-gray-800">
                          {audio.cover_url ? (
                            <img src={audio.cover_url} alt={audio.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-black truncate">{audio.title}</div>
                          <div className="text-sm text-gray-500 truncate">{audio.subtitle || audio.category?.name}</div>
                        </div>
                        <div className="text-sm text-gray-500 ml-2">{formatDuration(audio.duration) || ''}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-black">Sua rotina foi criada, mas ainda está vazia.</p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                className="hidden"
                onClick={async () => {
                  const nextUrl = await getNextStepUrl(desiredStep, { categoryId: currentCategoryId || undefined });
                  navigateWithFallback(nextUrl);
                }}
              >
                Pular
              </Button>
              <Button
                onClick={async () => {
                  const nextUrl = await getNextStepUrl(desiredStep, { categoryId: currentCategoryId || undefined });
                  navigateWithFallback(nextUrl);
                }}
              >
                Ver minha rotina
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function skip() {
    if (!form) return;
    try {
      setSubmitting(true);
      await saveFormResponse({ formId: form.id, answers: { skipped: true }, userId: user?.id ?? null });
      toast.success('Passo adiado');
      const currentStep = form.onboard_step || desiredStep;
      const nextUrl = await getNextStepUrl(currentStep, { categoryId: currentCategoryId || undefined });
      navigateWithFallback(nextUrl);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      toast.error('Não foi possível adiar este passo');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAndGoNext(recordedAnswers: Record<string, any>) {
    if (!form) return;
    try {
      // eslint-disable-next-line no-console
      ONB_DEBUG('submitAndGoNext:start', {
        step: form.onboard_step || desiredStep,
        formId: form.id,
        userId: user?.id ?? null,
        recordedAnswers,
      });
      setSubmitting(true);
      await saveFormResponse({ formId: form.id, answers: recordedAnswers, userId: user?.id ?? null });
      // eslint-disable-next-line no-console
      ONB_DEBUG('submitAndGoNext:afterSave', {
        step: form.onboard_step || desiredStep,
        formId: form.id,
        userId: user?.id ?? null,
      });
      toast.success('Resposta enviada');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[ONB_DEBUG] submitAndGoNext:error', e);
      toast.error('Não foi possível enviar. Seguimos para o próximo passo.');
    } finally {
      const currentStep = form.onboard_step || desiredStep;
      const parentFormId = (form as any).parent_form_id || activeFormId || form.id;

      // Após finalizar o Passo 5, construir/atualizar a playlist pessoal "Minha Rotina"
      try {
        if (currentStep === 5 && user?.id) {
          await buildRoutinePlaylistFromOnboarding({ userId: user.id, rootFormId: parentFormId });
        }
      } catch (err) {
        // Não bloquear o fluxo de navegação por erro aqui
        // eslint-disable-next-line no-console
        console.error('[ONB_DEBUG] buildRoutinePlaylistFromOnboarding error:', err);
      }

      let nextUrl = await getNextStepUrl(currentStep, { categoryId: currentCategoryId || undefined });
      // Passar a playlist selecionada via URL de handoff quando vier do passo 2
      try {
        if (currentStep === 2) {
          const selectedPlaylistId = (recordedAnswers as any)?.option;
          if (typeof selectedPlaylistId === 'string' && selectedPlaylistId) {
            const sep = nextUrl.includes('?') ? '&' : '?';
            nextUrl = `${nextUrl}${sep}selPl=${encodeURIComponent(selectedPlaylistId)}`;
          }
        }
      } catch {}
      // eslint-disable-next-line no-console
      ONB_DEBUG('submitAndGoNext:navigate', {
        currentStep,
        nextUrl,
        parentFormId,
        recordedAnswers,
      });
      navigateWithFallback(nextUrl);
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <div className="space-y-4">
          <div className="h-6 w-48 bg-gray-800 rounded animate-pulse" />
          <div className="h-32 w-full bg-gray-900 border border-gray-800 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-800 rounded ml-auto animate-pulse" />
        </div>
      </div>
    );
  }

  // Render estáticos via showStatic em QUALQUER passo
  if (showStaticKind === 'whatsapp') {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="w-full">
              <ProgressBar 
                percentage={progressPercentage} 
                loading={progressLoading}
                onBack={handleGoBack}
                showBackButton={desiredStep > 1}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <WhatsAppSetup
              variant="embedded"
              redirectIfNotLoggedIn={false}
              onSavedPhone={handleWhatsAppSaved}
            />
            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  const nextUrl = await getNextStepUrl(desiredStep, {
                    categoryId: currentCategoryId || undefined,
                  });
                  navigateWithFallback(nextUrl);
                }}
              >
                {settings.onboarding_step4_complete_button || 'Avançar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showStaticKind === 'preview' && desiredStep !== 3) {
    // Reusar o mesmo bloco do Passo 2 (Preview da categoria)
    const formatDuration = (seconds?: number | null): string | null => {
      if (!seconds && seconds !== 0) return null;
      const mins = Math.floor(seconds / 60);
      const rem = seconds % 60;
      if (!Number.isFinite(mins)) return null;
      if (rem === 0) return `${mins} min`;
      return `${mins}:${String(rem).padStart(2, '0')}`;
    };
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-2xl md:text-3xl leading-tight line-clamp-3 max-w-4xl mx-auto">{settings.onboarding_step2_title || 'Parabéns pela coragem e pela abertura de dar as mãos à Jesus neste momento difícil.'}</CardTitle>
                <p className="mt-3 text-black text-base md:text-lg max-w-3xl mx-auto">{settings.onboarding_step2_subtitle || 'Sua playlist foi criada, em breve você poderá escutar essas orações.'}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {(() => {
              const combined: Array<{
                id: string;
                type: 'audio' | 'playlist';
                title: string;
                subtitle?: string | null;
                duration?: number | null;
                image?: string | null;
              }> = [
                ...playlists.map(p => ({ id: p.id, type: 'playlist' as const, title: p.title, subtitle: null, duration: null, image: p.cover_url || category?.image_url || null })),
                ...audios.map(a => ({ id: a.id, type: 'audio' as const, title: a.title, subtitle: a.subtitle || null, duration: a.duration || null, image: a.cover_url || category?.image_url || null })),
              ];
              if (combined.length === 0) return null;
              return (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-black">{category?.name}</h2>
                  <div className="relative group">
                    <div ref={carouselRef} className="flex space-x-6 overflow-x-auto scrollbar-hide pb-2 scroll-smooth snap-x snap-mandatory">
                      {combined.map((item) => (
                        <div key={`${item.type}-${item.id}`} className="flex-shrink-0 w-48 snap-start group">
                          <div className="relative mb-4">
                            <div className="w-48 h-48 rounded-lg overflow-hidden bg-gray-800">
                              {item.image ? (
                                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-48 bg-gray-800" />
                              )}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="font-bold text-black text-base leading-tight truncate">{item.title}</div>
                            {item.subtitle && (
                              <div className="text-sm text-gray-400 truncate">{item.subtitle}</div>
                            )}
                            {typeof item.duration === 'number' && item.duration !== null && (
                              <div className="text-sm text-gray-400">{formatDuration(item.duration)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="flex justify-end">
              <Button onClick={async () => {
                const nextUrl = await getNextStepUrl(desiredStep, { categoryId: currentCategoryId || undefined });
                navigateWithFallback(nextUrl);
              }}>
                Avançar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  // Passo 7: Relembrar cadastro do WhatsApp (apenas para quem não concluiu no passo 3)
  if (currentStepMeta?.type === 'hardcoded' && currentStepMeta?.hardcodedKind === 'whatsapp-final') {
    if (hasWhatsApp === null) {
      return (
        <div className="max-w-2xl mx-auto p-4">
          <div className="space-y-4">
            <div className="h-6 w-48 bg-gray-800 rounded animate-pulse" />
            <div className="h-32 w-full bg-gray-900 border border-gray-800 rounded animate-pulse" />
            <div className="h-10 w-32 bg-gray-800 rounded ml-auto animate-pulse" />
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-xl md:text-2xl leading-snug break-words max-w-3xl mx-auto">
                  Conecte seu WhatsApp para receber suas mensagens diárias.
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <WhatsAppSetup
              variant="embedded"
              redirectIfNotLoggedIn={false}
              onSavedPhone={handleWhatsAppSaved}
            />
            <div className="flex justify-between">
              <Button
                variant="ghost"
                className="hidden"
                onClick={async () => {
                  const nextUrl = await getNextStepUrl(desiredStep, { categoryId: currentCategoryId || undefined });
                  navigateWithFallback(nextUrl);
                }}
              >
                Pular
              </Button>
              {hasWhatsApp && (
                <Button 
                  className="hidden"
                  onClick={async () => {
                    const nextUrl = await getNextStepUrl(desiredStep, { categoryId: currentCategoryId || undefined });
                    navigateWithFallback(nextUrl);
                  }}
                >
                  Concluir
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passo 8: Opt-in de Versículo Diário
  if (currentStepMeta?.type === 'hardcoded' && currentStepMeta?.hardcodedKind === 'daily-verse') {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-[clamp(18px,4.5vw,28px)] leading-snug break-words max-w-3xl mx-auto">
                  Receba um versículo diário para fortalecer sua fé.
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {/* Card de configuração do WhatsApp oculto no passo 8 */}

              <div className="flex items-center justify-between p-3 rounded-md border border-gray-800">
                <div>
                  <div className="font-medium text-black">Ativar versículo diário</div>
                  <p className="text-sm text-gray-500">Receba 1 versículo por dia no seu WhatsApp.</p>
                </div>
                <Switch
                  checked={dailyVerseEnabled}
                  onCheckedChange={(v) => {
                    setDailyVerseEnabled(v);
                    void persistDailyVersePreference(v);
                  }}
                />
              </div>

              {/* Preview simples de como a mensagem chega no WhatsApp */}
              <div className="p-4 rounded-lg border border-gray-800 bg-white/40">
                <div className="text-sm text-gray-600 mb-2">Prévia no WhatsApp</div>
                <div className="max-w-xs bg-white border border-gray-200 rounded-2xl p-3 shadow-sm">
                  <div className="text-gray-800 text-sm">“O Senhor é o meu pastor; nada me faltará.”</div>
                  <div className="text-gray-500 text-xs mt-1">Salmos 23:1 • Agapefy</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={async () => {
                  try {
                    if (true) {
                      setSavingVersePref(true);
                      let phone = phoneForWhatsApp;
                      if ((!hasWhatsApp || !phone) && typeof window !== 'undefined') {
                        try {
                          const localPhone = window.localStorage.getItem('agape_whatsapp_phone');
                          if (localPhone) phone = localPhone;
                        } catch {}
                      }
                      if (!phone) {
                        // sem telefone, apenas concluir sem gravar
                        navigateWithFallback('/');
                        return;
                      }
                      const { error } = await supabase
                        .from('whatsapp_users')
                        .upsert({ phone_number: phone, user_id: user?.id || null, receives_daily_verse: dailyVerseEnabled, updated_at: new Date().toISOString() } as any, { onConflict: 'phone_number' });
                      if (error) throw error;
                    }
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.warn('Falha ao salvar preferência de versículo diário', e);
                } finally {
                  setSavingVersePref(false);
                  navigateWithFallback('/');
                }
              }}
              disabled={savingVersePref}
            >
                {savingVersePref ? 'Salvando...' : 'Concluir'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passo 3: Mostrar apenas a playlist selecionada no passo 2 (se não for showStatic=whatsapp)
  if (((desiredStep === 3) || (currentStepMeta?.type === 'static' && currentStepMeta?.staticKind === 'preview')) && showStaticKind !== 'whatsapp') {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-2xl md:text-3xl leading-tight line-clamp-3 max-w-4xl mx-auto">
                  {settings.onboarding_step2_title || 'Parabéns pela coragem e pela abertura de dar as mãos à Jesus neste momento difícil.'}
                </CardTitle>
                <p className="mt-3 text-black text-base md:text-lg max-w-3xl mx-auto">
                  {settings.onboarding_step2_subtitle || 'Sua playlist foi criada, em breve você poderá escutar essas orações.'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {selectedChallengePlaylist ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-black">{selectedChallengePlaylist.title}</h2>
                
                {/* Carrossel de áudios da playlist */}
                {playlistAudios.length > 0 ? (
                  <div className="relative group">
                    {/* Setas de navegação */}
                    {playlistAudios.length > 1 && (
                      <>
                        <button
                          onClick={() => scrollPlaylistCarousel('left')}
                          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center shadow-lg border-2 border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Rolar para a esquerda"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                        </button>
                        <button
                          onClick={() => scrollPlaylistCarousel('right')}
                          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center shadow-lg border-2 border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Rolar para a direita"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
                        </button>
                      </>
                    )}

                    <div 
                      ref={playlistCarouselRef}
                      className="flex space-x-6 overflow-x-auto pb-2 scroll-smooth snap-x snap-mandatory"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                    >
                      {playlistAudios.map((audio: any) => {
                        const imageUrl = normalizeImageUrl(audio.thumbnail_url) || 
                                       normalizeImageUrl(audio.cover_url) || 
                                       normalizeImageUrl(audio.category?.image_url) ||
                                       normalizeImageUrl(category?.image_url) ||
                                       null;

                        const fallbackContent = (
                          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                            <div className="text-center">
                              <Play className="w-8 h-8 text-white mx-auto mb-2" fill="currentColor" />
                              <p className="text-white text-xs font-medium px-2 text-center line-clamp-2">
                                {audio.category?.name || category?.name || 'Áudio'}
                              </p>
                            </div>
                          </div>
                        );

                        // Verificar se este áudio está tocando atualmente
                        const isCurrentAudio = playerState.currentAudio?.id === audio.id;
                        const isCurrentlyPlaying = isCurrentAudio && playerState.isPlaying;
                        const isPaused = isCurrentAudio && !playerState.isPlaying;
                        const isLoading = isCurrentAudio && playerState.isLoading;

                        return (
                          <Link
                            key={audio.id}
                            href={`/player/audio/${audio.id}`}
                            className="flex-shrink-0 w-48 snap-start cursor-pointer group"
                          >
                            <div className="relative mb-4">
                              <div className="w-48 h-48 rounded-lg overflow-hidden bg-gray-800 shadow-lg">
                                {imageUrl ? (
                                  <img
                                    src={imageUrl}
                                    alt={audio.title}
                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = `
                                          <div class="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                                            <div class="text-center">
                                              <svg class="w-8 h-8 text-white mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                              <p class="text-white text-xs font-medium px-2 text-center">${audio.category?.name || category?.name || 'Áudio'}</p>
                                            </div>
                                          </div>
                                        `;
                                      }
                                    }}
                                  />
                                ) : (
                                  fallbackContent
                                )}
                              </div>
                              
                              {/* Play/Pause Button Overlay */}
                              {audio.audio_url && (
                                <div className={`absolute bottom-2 right-2 transition-all duration-300 transform ${isCurrentlyPlaying || isPaused || isLoading ? 'opacity-100 translate-y-0' : 'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'}`}>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      
                                      // Se está carregando, não fazer nada
                                      if (isLoading) {
                                        return;
                                      }
                                      
                                      // Se já está tocando este áudio, pausar
                                      if (isCurrentlyPlaying) {
                                        pause();
                                        return;
                                      }
                                      
                                      // Se está pausado mas é o áudio atual, retomar reprodução
                                      if (isPaused) {
                                        play();
                                        return;
                                      }
                                      
                                      // Tocar apenas este áudio (substitui qualquer queue existente)
                                      playQueue([{
                                        id: audio.id,
                                        title: audio.title,
                                        subtitle: audio.subtitle || null,
                                        duration: audio.duration || null,
                                        audio_url: audio.audio_url!,
                                        cover_url: audio.cover_url || null,
                                        category: audio.category ? {
                                          id: audio.category.id,
                                          name: audio.category.name,
                                          description: null,
                                          image_url: audio.category.image_url,
                                          created_at: ''
                                        } : undefined
                                      }], 0);
                                    }}
                                    disabled={isLoading}
                                    className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                                      isCurrentlyPlaying 
                                        ? 'bg-orange-500 hover:bg-orange-400' 
                                        : 'bg-green-500 hover:bg-green-400'
                                    } hover:scale-105 ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    title={isCurrentlyPlaying ? 'Pausar' : isPaused ? 'Retomar' : isLoading ? 'Carregando...' : 'Reproduzir preview'}
                                  >
                                    {isCurrentlyPlaying ? (
                                      <Pause size={16} className="text-black fill-current" />
                                    ) : (
                                      <Play size={16} className="text-black ml-0.5" fill="currentColor" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            {/* Título, Sub-título e Duração */}
                            <div className="space-y-1">
                              <h3 className="font-bold text-black text-base leading-tight truncate group-hover:underline">
                                {audio.title}
                              </h3>
                              {audio.subtitle && (
                                <p className="text-sm text-gray-500 truncate">
                                  {audio.subtitle}
                                </p>
                              )}
                              <p className="text-sm text-gray-400">
                                {formatDuration(audio.duration)}
                              </p>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 py-4">
                    Carregando áudios da playlist...
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Nenhuma playlist de desafio encontrada nesta categoria.
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={async () => {
                const nextUrl = await getNextStepUrl(desiredStep, { categoryId: currentCategoryId || undefined });
                navigateWithFallback(nextUrl);
              }}>
                Avançar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passo informativo (tipo 'info' no schema)
  // Não executar se desiredStep === 3 (passo 3 pode ser estático)
  if (desiredStep !== 3 && form && Array.isArray((form as any).schema) && (form as any).schema[0]?.type === 'info') {
    const currentForm: any = processedForm || form;
    const infoData = currentForm.schema[0];
    const categoryName = category?.name || 'o tema escolhido';
    const title = (infoData.title || '').replace(/\{tema escolhido\}/gi, categoryName).replace(/\{category\}/gi, categoryName);
    const subtitle = (infoData.subtitle || '').replace(/\{tema escolhido\}/gi, categoryName).replace(/\{category\}/gi, categoryName);
    const explanation = (infoData.explanation || '').replace(/\{tema escolhido\}/gi, categoryName).replace(/\{category\}/gi, categoryName);
    const buttonText = infoData.buttonText || 'Começar agora →';

    const handleInfoNext = async () => {
      const currentStep = form.onboard_step || desiredStep;
      const nextUrl = await getNextStepUrl(currentStep, { categoryId: currentCategoryId || undefined });
      navigateWithFallback(nextUrl);
    };

    return (
      <div className="min-h-[calc(100vh-0rem)] flex items-center justify-center px-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle 
                  className="text-2xl md:text-3xl leading-tight max-w-4xl mx-auto"
                  dangerouslySetInnerHTML={{ __html: processLinks(title) }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {subtitle && (
              <p 
                className="text-black text-lg text-center max-w-3xl mx-auto"
                dangerouslySetInnerHTML={{ __html: processLinks(subtitle) }}
              />
            )}
            {explanation && (
              <div className="space-y-4">
                <p 
                  className="text-black text-base text-center max-w-3xl mx-auto"
                  dangerouslySetInnerHTML={{ __html: processLinks(explanation) }}
                />
              </div>
            )}
            <div className="flex justify-end pt-4">
              <Button onClick={handleInfoNext} size="lg" className="gap-2">
                {buttonText}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passo 2: Form dinâmico (quando existir e não for informativo)
  if (desiredStep === 2 && form && !(Array.isArray((form as any).schema) && (form as any).schema[0]?.type === 'info')) {
    return (
      <div className="min-h-[calc(100vh-0rem)] flex items-center justify-center px-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
              </div>
              <CardTitle 
                className="text-2xl"
                dangerouslySetInnerHTML={{ __html: processLinks(processedForm?.name || form.name) }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {(processedForm?.description || form.description) && (
              <p 
                className="text-black text-lg"
                dangerouslySetInnerHTML={{ __html: processLinks(processedForm?.description || form.description) }}
              />
            )}

            <RadioGroup
              value={selectedKey}
              onValueChange={(key) => {
                setSelectedKey(key);
                const index = Number(key);
                const chosen = playlists?.[index];
                if (chosen) {
                  ONB_DEBUG('step2:playlistSelected', { playlistId: chosen.id || '', title: chosen.title });
                  setSelected(chosen.id || '');
                  // Auto-avançar para o próximo step quando uma opção for selecionada
                  const finalSelectedId = chosen.id || '';
                  const payload = { option: finalSelectedId, playlist_title: chosen.title || null };
                  ONB_DEBUG('step2:submitPayload', payload);
                  // Salvar no localStorage para usuários anônimos
                  if (finalSelectedId && typeof window !== 'undefined') {
                    try {
                      window.localStorage.setItem('ag_onb_selected_playlist', finalSelectedId);
                    } catch {}
                  }
                  void submitAndGoNext(payload);
                }
              }}
              className="space-y-3"
            >
              {orderedChallengePlaylists.map((pl) => {
                const originalIndex = (playlists || []).findIndex(p => p.id === pl.id);
                return (
                  <div key={pl.id}>
                    <label
                      htmlFor={`opt-${originalIndex}`}
                      className={`flex items-center justify-between gap-4 w-full p-4 rounded-lg border cursor-pointer ${
                        pl.id === recommendedId 
                          ? 'bg-amber-50 border-gray-800 hover:bg-amber-100' 
                          : 'border-gray-800 hover:bg-gray-800/40'
                      }`}
                      onClick={() => {
                        ONB_DEBUG('step2:playlistSelected', { playlistId: pl.id, title: pl.title });
                        setSelectedKey(String(originalIndex));
                        setSelected(pl.id);
                        // Auto-avançar para o próximo step quando uma opção for selecionada
                        const payload = { option: pl.id, playlist_title: pl.title || null };
                        ONB_DEBUG('step2:submitPayload', payload);
                        // Salvar no localStorage para usuários anônimos
                        if (pl.id && typeof window !== 'undefined') {
                          try {
                            window.localStorage.setItem('ag_onb_selected_playlist', pl.id);
                          } catch {}
                        }
                        void submitAndGoNext(payload);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <RadioGroupItem className="h-5 w-5" value={`${originalIndex}`} id={`opt-${originalIndex}`} />
                        <span className="text-base">{pl.title}</span>
                      </div>
                      {pl.id === recommendedId && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-amber-500 text-amber-700 bg-amber-50">
                          Recomendada
                        </span>
                      )}
                    </label>
                  </div>
                );
              })}
            </RadioGroup>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={skip} disabled={submitting} className="hidden">Agora não</Button>
              <Button onClick={() => {
                // Garantir que sempre temos um ID válido: usar selected, ou recommendedId como fallback
                const finalSelectedId = selected || recommendedId || '';
                const chosen = playlists?.find(p => p.id === finalSelectedId) || playlists?.[Number(selectedKey)];
                const payload = { option: finalSelectedId, playlist_title: chosen?.title || null };
                ONB_DEBUG('step2:submitPayload', payload);
                // Salvar no localStorage para usuários anônimos
                if (finalSelectedId && typeof window !== 'undefined') {
                  try {
                    window.localStorage.setItem('ag_onb_selected_playlist', finalSelectedId);
                  } catch {}
                }
                void submitAndGoNext(payload);
              }} disabled={(!selected && !recommendedId) || submitting} className="hidden">{submitting ? 'Enviando...' : 'Enviar'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passo 2: Preview da categoria (apenas se não for passo informativo OU se showStatic=true)
  const showStaticStep2 = searchParams?.get('showStatic') === 'true';
  if (desiredStep === 2 && (showStaticStep2 || !form)) {

    const formatDuration = (seconds?: number | null): string | null => {
      if (!seconds && seconds !== 0) return null;
      const mins = Math.floor(seconds / 60);
      const rem = seconds % 60;
      if (!Number.isFinite(mins)) return null;
      if (rem === 0) return `${mins} min`;
      return `${mins}:${String(rem).padStart(2, '0')}`;
    };
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-2xl md:text-3xl leading-tight line-clamp-3 max-w-4xl mx-auto">{settings.onboarding_step2_title || 'Parabéns pela coragem e pela abertura de dar as mãos à Jesus neste momento difícil.'}</CardTitle>
                <p className="mt-3 text-black text-base md:text-lg max-w-3xl mx-auto">{settings.onboarding_step2_subtitle || 'Sua playlist foi criada, em breve você poderá escutar essas orações.'}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">

            {(() => {
              const combined: Array<{
                id: string;
                type: 'audio' | 'playlist';
                title: string;
                subtitle?: string | null;
                duration?: number | null;
                image?: string | null;
              }> = [
                ...playlists.map(p => ({ id: p.id, type: 'playlist' as const, title: p.title, subtitle: null, duration: null, image: p.cover_url || category?.image_url || null })),
                ...audios.map(a => ({ id: a.id, type: 'audio' as const, title: a.title, subtitle: a.subtitle || null, duration: a.duration || null, image: a.cover_url || category?.image_url || null })),
              ];

              if (combined.length === 0) return null;

              return (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-black">{category?.name}</h2>
                  <div className="relative group">
                    {/* Setas do carrossel */}
                    <button onClick={() => scrollCarousel('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center shadow-lg border-2 border-gray-200" title="Rolar para a esquerda">
                      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
                    </button>
                    <button onClick={() => scrollCarousel('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white text-gray-800 rounded-full w-10 h-10 flex items-center justify-center shadow-lg border-2 border-gray-200" title="Rolar para a direita">
                      <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
                    </button>

                    <div ref={carouselRef} className="flex space-x-6 overflow-x-auto scrollbar-hide pb-2 scroll-smooth snap-x snap-mandatory">
                      {combined.map((item) => (
                        <div key={`${item.type}-${item.id}`} className="flex-shrink-0 w-48 snap-start group">
                          <div className="relative mb-4">
                            <div className="w-48 h-48 rounded-lg overflow-hidden bg-gray-800">
                              {item.image ? (
                                <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-48 bg-gray-800" />
                              )}
                            </div>
                            {/* Sem overlay de play no preview */}
                          </div>
                          <div className="space-y-1">
                            <div className="font-bold text-black text-base leading-tight truncate">{item.title}</div>
                            {item.subtitle && (
                              <div className="text-sm text-gray-400 truncate">{item.subtitle}</div>
                            )}
                            {typeof item.duration === 'number' && item.duration !== null && (
                              <div className="text-sm text-gray-400">{formatDuration(item.duration)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end">
              <Button onClick={async () => {
                const nextUrl = await getNextStepUrl(desiredStep, { categoryId: currentCategoryId || undefined });
                navigateWithFallback(nextUrl);
              }}>
                Avançar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passos dinâmicos (>= 4 ou personalizados, excluindo passos informativos que já foram tratados acima)
  if (desiredStep !== 1 && desiredStep !== 2 && desiredStep !== 3 && form) {
    // Verificar se é passo informativo (já renderizado acima)
    const isInfoStep = Array.isArray((form as any).schema) && (form as any).schema[0]?.type === 'info';
    if (isInfoStep) {
      return null; // Já renderizado acima
    }
    
    const isShortText = Array.isArray((form as any).schema) && (form as any).schema[0]?.type === 'short_text';
    if (isShortText) {
      return (
        <div className="max-w-2xl mx-auto p-4">
          <Card>
            <CardHeader>
              <div className="space-y-4">
                <div className="w-full">
                  <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
                </div>
                <div className="text-center px-2 md:px-6">
                <CardTitle 
                  className="text-2xl md:text-3xl leading-tight line-clamp-3 max-w-4xl mx-auto"
                  dangerouslySetInnerHTML={{ __html: processLinks(processedForm?.name || form.name) }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {(processedForm?.description || form.description) && (
              <p 
                className="text-black text-lg"
                dangerouslySetInnerHTML={{ __html: processLinks(processedForm?.description || form.description) }}
              />
            )}
              <Input placeholder="Digite sua resposta..." value={shortText} onChange={(e) => setShortText(e.target.value)} />
              <div className="flex justify-between">
                <Button variant="ghost" onClick={skip} disabled={submitting} className="hidden">Agora não</Button>
                <Button onClick={() => submitAndGoNext({ text: shortText })} disabled={submitting || !shortText.trim()}>Enviar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Passo 4: múltipla seleção (checkbox)
    if (desiredStep === 4) {
      return (
        <div className="min-h-[calc(100vh-0rem)] flex items-center justify-center px-4">
          <Card className="w-full max-w-3xl">
            <CardHeader>
              <div className="space-y-4">
                <div className="w-full">
                  <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
                </div>
              <CardTitle 
                className="text-2xl"
                dangerouslySetInnerHTML={{ __html: processLinks(processedForm?.name || form.name) }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {(processedForm?.description || form.description) && (
              <p 
                className="text-black text-lg"
                dangerouslySetInnerHTML={{ __html: processLinks(processedForm?.description || form.description) }}
              />
            )}

              <div className="space-y-3">
                {(((processedForm?.schema as any[]) || (form.schema as any[])) as any[])?.map((opt: any, idx: number) => {
                  const checked = multiKeys.includes(String(idx));
                  return (
                    <div key={idx}>
                      <label
                        htmlFor={`chk-${idx}`}
                        className="flex items-center gap-4 w-full p-4 rounded-lg border border-gray-800 hover:bg-gray-800/40 cursor-pointer"
                        onClick={(e) => {
                          // allow label click to toggle
                          e.preventDefault();
                          const key = String(idx);
                          const label = opt.label as string;
                          setMultiKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
                          setMultiLabels(prev => {
                            const exists = prev.includes(label);
                            if (exists) return prev.filter(l => l !== label);
                            return [...prev, label];
                          });
                        }}
                      >
                        <Checkbox id={`chk-${idx}`} checked={checked} onCheckedChange={(state) => {
                          const key = String(idx);
                          const label = opt.label as string;
                          const nextChecked = Boolean(state);
                          setMultiKeys(prev => nextChecked ? [...prev, key] : prev.filter(k => k !== key));
                          setMultiLabels(prev => nextChecked ? [...prev, label] : prev.filter(l => l !== label));
                        }} />
                        <span 
                          className="text-base"
                          dangerouslySetInnerHTML={{ __html: processLinks(opt.label) }}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={skip} disabled={submitting} className="hidden">Agora não</Button>
                <Button onClick={() => submitAndGoNext({ options: multiLabels })} disabled={multiLabels.length === 0 || submitting}>{submitting ? 'Enviando...' : 'Enviar'}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-[calc(100vh-0rem)] flex items-center justify-center px-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar 
                  percentage={progressPercentage} 
                  loading={progressLoading}
                  onBack={handleGoBack}
                  showBackButton={desiredStep > 1}
                />
              </div>
              <CardTitle className="text-2xl">{processedForm?.name || form.name}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {(processedForm?.description || form.description) && (
              <p className="text-black text-lg">{processedForm?.description || form.description}</p>
            )}

            <RadioGroup
              value={selectedKey}
              onValueChange={(key) => {
                setSelectedKey(key);
                const index = Number(key);
                const chosen = (form.schema as any)?.[index];
                if (chosen) setSelected(chosen.label || '');
              }}
              className="space-y-3"
            >
              {(((processedForm?.schema as any[]) || (form.schema as any[])) as any[])?.map((opt: any, idx: number) => (
                <div key={idx}>
                  <label
                    htmlFor={`opt-${idx}`}
                    className="flex items-center gap-4 w-full p-4 rounded-lg border border-gray-800 hover:bg-gray-800/40 cursor-pointer"
                  >
                    <RadioGroupItem className="h-5 w-5" value={`${idx}`} id={`opt-${idx}`} />
                    <span 
                      className="text-base"
                      dangerouslySetInnerHTML={{ __html: processLinks(opt.label) }}
                    />
                  </label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={skip} disabled={submitting} className="hidden">Agora não</Button>
              <Button onClick={() => submitAndGoNext({ option: selected })} disabled={!selected || submitting}>{submitting ? 'Enviando...' : 'Enviar'}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passo 1: Formulário (quiz)
  if (!form) {
    return (
      <div className="min-h-[calc(100vh-0rem)] flex items-center justify-center px-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <CardTitle className="text-2xl">Onboarding indisponível</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-400">Nenhum formulário ativo foi encontrado para o passo 1.</p>
            <div className="flex justify-end">
              <Button onClick={() => navigateWithFallback('/')}>Voltar para a Home</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-0rem)] flex items-center justify-center px-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="space-y-4">
            <div className="w-full">
              <ProgressBar 
                percentage={progressPercentage} 
                loading={progressLoading}
                onBack={handleGoBack}
                showBackButton={desiredStep > 1}
              />
            </div>
            <CardTitle 
              className="text-2xl"
              dangerouslySetInnerHTML={{ __html: processLinks(processedForm?.name || form.name) }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {(processedForm?.description || form.description) && (
            <p 
              className="text-black text-lg"
              dangerouslySetInnerHTML={{ __html: processLinks(processedForm?.description || form.description) }}
            />
          )}

          <RadioGroup
            value={selectedKey}
            onValueChange={(key) => {
              setSelectedKey(key);
              if (key === 'other') {
                setUsedOtherSituation(true);
                setSelected('');
                // Não limpar o texto quando selecionar "other"
              } else {
                setUsedOtherSituation(false);
                const index = Number(key);
                const chosen = form.schema?.[index];
                if (chosen) {
                  const categoryId = chosen.category_id;
                  setSelected(categoryId);
                  // Limpar campo "Outros" quando selecionar uma opção
                  setOtherOptionText('');
                  // Avançar automaticamente para o próximo step após um pequeno delay para feedback visual
                  // Passar o categoryId diretamente para evitar problemas de timing com o estado
                  setTimeout(() => {
                    void submit(categoryId);
                  }, 300);
                }
              }
            }}
            className="space-y-3"
          >
            {(((processedForm?.schema as any[]) || (form.schema as any[])) as any[])?.map((opt: any, idx: number) => (
              <div key={idx}>
                <label
                  htmlFor={`opt-${idx}`}
                  className="flex items-center gap-4 w-full p-4 rounded-lg border border-gray-800 hover:bg-gray-800/40 cursor-pointer"
                >
                  <RadioGroupItem className="h-5 w-5" value={`${idx}`} id={`opt-${idx}`} />
                  <span 
                    className="text-base"
                    dangerouslySetInnerHTML={{ __html: processLinks(opt.label) }}
                  />
                </label>
              </div>
            ))}
            
            {form.allow_other_option && (
              <div className="space-y-2">
                <div className="flex items-center gap-4 w-full p-4 rounded-lg border border-gray-800 hover:bg-gray-800/40">
                  <RadioGroupItem 
                    className="h-5 w-5" 
                    value="other" 
                    id="opt-other"
                  />
                  <label 
                    htmlFor="opt-other" 
                    className="text-base cursor-pointer flex-1"
                    dangerouslySetInnerHTML={{ __html: processLinks(processedForm?.other_option_label || form.other_option_label || 'Outros') }}
                  />
                </div>
                {selectedKey === 'other' && (
                  <div className="pl-9 pr-4">
                    <Textarea
                      id="opt-other-input"
                      placeholder="Escreva aqui o que está pesando seu coração..."
                      value={otherOptionText}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Limitar a 500 caracteres
                        if (value.length <= 500) {
                          setOtherOptionText(value);
                        }
                      }}
                      className="w-full min-h-[60px] max-h-[80px] resize-none"
                      rows={3}
                      maxLength={500}
                      autoFocus
                    />
                    <div className="text-xs text-muted-foreground mt-1 text-right">
                      {otherOptionText.length}/500 caracteres
                    </div>
                  </div>
                )}
              </div>
            )}
          </RadioGroup>

          {selectedKey === 'other' && (
            <div className="flex justify-between">
              <Button variant="ghost" onClick={skip} disabled={submitting} className="hidden">Agora não</Button>
              <Button 
                onClick={submit} 
                disabled={(!selected && !(form.allow_other_option && otherOptionText.trim())) || submitting}
              >
                {submitting ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
