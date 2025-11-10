"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
interface AudioPreview { id: string; title: string; subtitle?: string | null; duration?: number | null; cover_url?: string | null }

export default function OnboardingClient() {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { routinePlaylist, loading: routineLoading } = useRoutinePlaylist();
  const desiredStep = useMemo(() => {
    const stepParam = searchParams?.get('step');
    const parsed = stepParam ? Number(stepParam) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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
  const [dailyVerseEnabled, setDailyVerseEnabled] = useState<boolean>(true);
  const [savingVersePref, setSavingVersePref] = useState<boolean>(false);
  const [previousResponses, setPreviousResponses] = useState<Map<number, string>>(new Map());
  const [loadingResponses, setLoadingResponses] = useState<boolean>(false);
  
  // Calcular progresso do onboarding
  const { percentage: progressPercentage, loading: progressLoading } = useOnboardingProgress(desiredStep, currentCategoryId);

  // Função para determinar o próximo passo disponível e retornar a URL completa
  async function getNextStepUrl(currentStep: number): Promise<string> {
    const parentFormId = activeFormId || form?.id || '';
    const categoryParam = currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : '';
    const formParam = parentFormId ? `&formId=${encodeURIComponent(parentFormId)}` : '';

    // Buscar todos os formulários dinâmicos ativos ordenados por passo
    let { data: activeForms, error: formsError } = await supabase
      .from('admin_forms')
      .select('id, onboard_step, is_active')
      .eq('form_type', 'onboarding')
      .eq('is_active', true)
      .not('onboard_step', 'is', null)
      .order('onboard_step', { ascending: true });

    // Fallback quando parent_form_id não existe
    if (formsError && (formsError.code === '42703' || /parent_form_id/i.test(String(formsError.message || '')))) {
      const fb = await supabase
        .from('admin_forms')
        .select('id, onboard_step, is_active')
        .eq('form_type', 'onboarding')
        .eq('is_active', true)
        .not('onboard_step', 'is', null)
        .order('onboard_step', { ascending: true });
      if (!fb.error) {
        activeForms = fb.data as any;
      }
    }

    // Buscar todos os formulários dinâmicos (ativos e inativos) para verificar quais passos estão ocupados
    const { data: allForms } = await supabase
      .from('admin_forms')
      .select('onboard_step, is_active')
      .eq('form_type', 'onboarding')
      .not('onboard_step', 'is', null);

    const occupiedSteps = new Set<number>();
    const activeSteps = new Set<number>();
    
    if (allForms) {
      allForms.forEach((f: any) => {
        if (f.onboard_step) {
          occupiedSteps.add(f.onboard_step);
          if (f.is_active) {
            activeSteps.add(f.onboard_step);
          }
        }
      });
    }

    // Função auxiliar para verificar se um passo estático está disponível
    const isStaticStepAvailable = async (stepNum: number): Promise<boolean> => {
      // Se há um formulário dinâmico (ativo ou inativo) neste passo, o estático não está disponível
      if (occupiedSteps.has(stepNum)) {
        return false;
      }
      
      // Verificações específicas para cada passo estático
      if (stepNum === 2) {
        // Passo 2 (preview) só está disponível se tiver categoryId
        return !!currentCategoryId;
      }
      
      // Passos 3, 6, 7, 8 estão sempre disponíveis se não houver formulário dinâmico
      return true;
    };

    // Função auxiliar para gerar URL de passo estático
    const getStaticStepUrl = (stepNum: number): string => {
      if (stepNum === 2) {
        return `/onboarding?step=2&showStatic=preview${categoryParam}${formParam}`;
      }
      if (stepNum === 3) {
        return `/onboarding?step=3&showStatic=whatsapp${categoryParam}${formParam}`;
      }
      return `/onboarding?step=${stepNum}${categoryParam}${formParam}`;
    };

    // Lista de passos estáticos possíveis em ordem
    const staticSteps = [2, 3, 6, 7, 8];

    // Procurar próximo passo ativo (dinâmico ou estático)
    // Começar verificando a partir do próximo passo sequencial
    let candidateStep = currentStep + 1;
    const maxStep = Math.max(
      ...(activeForms?.map(f => f.onboard_step as number) || []),
      ...staticSteps,
      currentStep
    );

    while (candidateStep <= maxStep + 1) {
      // 1) Verificar se há formulário dinâmico ativo neste passo
      if (activeSteps.has(candidateStep)) {
        return `/onboarding?step=${candidateStep}${formParam}${categoryParam}`;
      }

      // 2) Verificar se é um passo estático disponível
      if (staticSteps.includes(candidateStep)) {
        const isAvailable = await isStaticStepAvailable(candidateStep);
        if (isAvailable) {
          return getStaticStepUrl(candidateStep);
        }
      }

      // 3) Se não é passo estático e não há formulário dinâmico ativo,
      // verificar se há formulário dinâmico (mesmo inativo) neste passo
      // Isso garante que passos com formulários configurados sejam considerados
      if (!staticSteps.includes(candidateStep) && occupiedSteps.has(candidateStep)) {
        // Há um formulário dinâmico neste passo (pode estar inativo)
        // Mas só retornar se não houver outro passo ativo antes dele
        // Por enquanto, retornar o passo para não pular
        return `/onboarding?step=${candidateStep}${formParam}${categoryParam}`;
      }

      candidateStep++;
    }

    // Se não houver mais passos, finalizar onboarding
    return '/';
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
        .select('id, onboard_step')
        .eq('form_type', 'onboarding')
        .eq('is_active', true)
        .lt('onboard_step', currentStep)
        .not('onboard_step', 'is', null)
        .order('onboard_step', { ascending: true });
      if (formsError || !forms || (forms as any[]).length === 0) {
        setPreviousResponses(new Map());
        setLoadingResponses(false);
        return;
      }
      const formIds = (forms as any[]).map(f => f.id);
      const { data: responses, error: responsesError } = await supabase
        .from('admin_form_responses')
        .select('form_id, answers')
        .eq('user_id', userId)
        .in('form_id', formIds);
      if (responsesError) {
        setPreviousResponses(new Map());
        setLoadingResponses(false);
        return;
      }
      // Montar mapa step -> valor
      const responseMap = new Map<string, { answers: Record<string, any>; onboard_step: number }>();
      (responses as any[] | null | undefined)?.forEach((resp: any) => {
        const formMatch = (forms as any[]).find((f: any) => f.id === resp.form_id);
        if (formMatch && typeof formMatch.onboard_step === 'number') {
          responseMap.set(resp.form_id, { answers: resp.answers, onboard_step: formMatch.onboard_step });
        }
      });
      const responsesTextMap = new Map<number, string>();
      for (const [formId, { answers, onboard_step }] of responseMap.entries()) {
        const value = await extractResponseValue(formId, answers, onboard_step);
        if (value) responsesTextMap.set(onboard_step, value);
      }

      // Fallback extra para {resposta1} via categoryId quando não houver resposta salva com user_id
      if (currentStep > 1 && categoryId && !responsesTextMap.has(1)) {
        const step1Form = (forms as any[]).find((f: any) => f.onboard_step === 1);
        if (step1Form) {
          const { data: step1Data } = await supabase
            .from('admin_forms')
            .select('schema')
            .eq('id', step1Form.id)
            .maybeSingle();
          const schemaArr = (step1Data as any)?.schema as Array<{ label: string; category_id: string }> | undefined;
          const match = Array.isArray(schemaArr) ? schemaArr.find(opt => opt?.category_id === categoryId) : undefined;
          if (match?.label) {
            responsesTextMap.set(1, match.label);
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
                getPlaylistsByCategoryFast(categoryId)
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
            // Primeiro verificar se há um passo informativo no passo 2
            // Se houver, mostrar ele primeiro; caso contrário, mostrar o passo 2 estático (preview da categoria)
            let infoForm = await supabase
              .from('admin_forms')
              .select('*')
              .eq('form_type', 'onboarding')
              .eq('is_active', true)
              .eq('onboard_step', 2)
              .maybeSingle();
            
            if (infoForm.data && infoForm.data.schema && 
                Array.isArray(infoForm.data.schema) && 
                infoForm.data.schema[0]?.type === 'info') {
              // Há um passo informativo no passo 2, mostrar ele
              if (mounted) setForm((infoForm.data as AdminForm) || null);
            } else {
              // Não há passo informativo, mostrar o passo 2 estático (preview da categoria)
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
                  getPlaylistsByCategoryFast(categoryId)
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
          // Passo 3 é sempre estático (preview da categoria), não busca formulário dinâmico
          // Limpar form state para garantir que não haja interferência de formulários anteriores
          if (mounted) setForm(null);
          const categoryId = searchParams?.get('categoryId');
          if (categoryId) {
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
              getPlaylistsByCategoryFast(categoryId)
            ]);
            if (catErr) throw catErr;
            if (audErr) throw audErr;
            if (mounted) {
              setCategory((cat as any) || null);
              setAudios(((auds as any[]) || []) as AudioPreview[]);
              setPlaylists((getPl as any[]) || []);
            }
          } else {
            if (mounted) {
              setCategory(null);
              setAudios([]);
              setPlaylists([]);
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
        if (desiredStep === 7 && hasPhone) router.replace('/');
      } catch {
        if (mounted) setHasWhatsApp(false);
      }
    }
    void checkWhatsApp();
    return () => { mounted = false; };
  }, [desiredStep, user?.id, router]);

  async function submit() {
    if (!form) {
      toast.error('Formulário não encontrado');
      return;
    }
    
    // Verificar se selecionou uma opção OU preencheu o campo "Outros"
    const hasOtherOption = form.allow_other_option && otherOptionText.trim();
    if (!selected && !hasOtherOption) {
      toast.error('Selecione uma opção ou preencha o campo "Outros"');
      return;
    }

    try {
      setSubmitting(true);
      
      // Salvar resposta do formulário
      await saveFormResponse({ 
        formId: form.id, 
        answers: { 
          option: selected || null,
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
      // Usar getNextStepUrl para determinar o próximo passo
      try {
        const currentStep = form.onboard_step || desiredStep;
        let nextUrl = await getNextStepUrl(currentStep);
        // Garantir categoryId na URL após o passo 1 (usuário pode não estar logado)
        if (currentStep === 1 && selected && !nextUrl.includes('categoryId=')) {
          nextUrl = `${nextUrl}${nextUrl.includes('?') ? '&' : '?'}categoryId=${encodeURIComponent(selected)}`;
        }
        router.replace(nextUrl);
      } catch {
        // Fallback: ir para passo 2 se houver erro
        const categoryParam = `categoryId=${encodeURIComponent(selected)}`;
        const formParam = `formId=${encodeURIComponent(form.id)}`;
        router.replace(`/onboarding?step=2&${categoryParam}&${formParam}`);
      }
      setSubmitting(false);
    }
  }

  // Passo 6: Mostrar playlist da rotina criada
  if (desiredStep === 6) {
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
                <ProgressBar percentage={progressPercentage} loading={progressLoading} />
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
                onClick={async () => {
                  const nextUrl = await getNextStepUrl(desiredStep);
                  router.replace(nextUrl);
                }}
              >
                Pular
              </Button>
              <Button
                onClick={async () => {
                  const nextUrl = await getNextStepUrl(desiredStep);
                  router.replace(nextUrl);
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
      const nextUrl = await getNextStepUrl(currentStep);
      router.replace(nextUrl);
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
      setSubmitting(true);
      await saveFormResponse({ formId: form.id, answers: recordedAnswers, userId: user?.id ?? null });
      toast.success('Resposta enviada');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
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
        console.error('buildRoutinePlaylistFromOnboarding error:', err);
      }

      const nextUrl = await getNextStepUrl(currentStep);
      router.replace(nextUrl);
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
  // Mas passo 3 sempre mostra preview da categoria, não WhatsApp
  const showStaticKind = searchParams?.get('showStatic') || '';
  if (showStaticKind === 'whatsapp' && desiredStep !== 3) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar percentage={progressPercentage} loading={progressLoading} />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-xl md:text-2xl leading-snug break-words max-w-3xl mx-auto">{(() => {
                  const raw = settings.onboarding_step3_title || 'Conecte seu WhatsApp para receber uma mensagem diária para {category}.';
                  const replacement = category?.name || 'sua dificuldade selecionada';
                  return raw.replace('{category}', replacement);
                })()}</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <WhatsAppSetup variant="embedded" redirectIfNotLoggedIn={false} />
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={async () => {
                  const nextUrl = await getNextStepUrl(desiredStep);
                  router.replace(nextUrl);
                }}
              >
                Pular
              </Button>
              <Button onClick={async () => {
                const nextUrl = await getNextStepUrl(desiredStep);
                router.replace(nextUrl);
              }}>Concluir</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showStaticKind === 'preview') {
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
                <ProgressBar percentage={progressPercentage} loading={progressLoading} />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-2xl md:text-3xl leading-tight line-clamp-2 max-w-4xl mx-auto">{settings.onboarding_step2_title || 'Parabéns pela coragem e pela abertura de dar as mãos à Jesus neste momento difícil.'}</CardTitle>
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
                const nextUrl = await getNextStepUrl(desiredStep);
                router.replace(nextUrl);
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
  if (desiredStep === 7) {
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
                <ProgressBar percentage={progressPercentage} loading={progressLoading} />
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
              onSavedPhone={() => setHasWhatsApp(true)}
            />
            <div className="flex justify-between">
              <Button
                variant="ghost"
                onClick={async () => {
                  const nextUrl = await getNextStepUrl(desiredStep);
                  router.replace(nextUrl);
                }}
              >
                Pular
              </Button>
              {hasWhatsApp && (
                <Button onClick={async () => {
                  const nextUrl = await getNextStepUrl(desiredStep);
                  router.replace(nextUrl);
                }}>Concluir</Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passo 8: Opt-in de Versículo Diário
  if (desiredStep === 8) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar percentage={progressPercentage} loading={progressLoading} />
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
                        router.replace('/');
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
                    router.replace('/');
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

  // Passo 3: Preview da categoria (mesmo conteúdo do passo 2)
  if (desiredStep === 3) {
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
                <ProgressBar percentage={progressPercentage} loading={progressLoading} />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-2xl md:text-3xl leading-tight line-clamp-2 max-w-4xl mx-auto">{settings.onboarding_step2_title || 'Parabéns pela coragem e pela abertura de dar as mãos à Jesus neste momento difícil.'}</CardTitle>
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
                const nextUrl = await getNextStepUrl(desiredStep);
                router.replace(nextUrl);
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
  // Não executar se desiredStep === 3 (passo 3 é sempre estático)
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
      const nextUrl = await getNextStepUrl(currentStep);
      router.replace(nextUrl);
    };

    return (
      <div className="min-h-[calc(100vh-0rem)] flex items-center justify-center px-4">
        <Card className="w-full max-w-3xl">
          <CardHeader>
            <div className="space-y-4">
              <div className="w-full">
                <ProgressBar percentage={progressPercentage} loading={progressLoading} />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-2xl md:text-3xl leading-tight max-w-4xl mx-auto">
                  {title}
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {subtitle && (
              <p className="text-black text-lg text-center max-w-3xl mx-auto">
                {subtitle}
              </p>
            )}
            {explanation && (
              <div className="space-y-4">
                <p className="text-black text-base text-center max-w-3xl mx-auto">
                  {explanation}
                </p>
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

  // Passo 2: Preview da categoria (apenas se não for passo informativo OU se showStatic=true)
  const showStaticStep2 = searchParams?.get('showStatic') === 'true';
  if (desiredStep === 2 && (showStaticStep2 || (!form || !Array.isArray((form as any).schema) || (form as any).schema[0]?.type !== 'info'))) {

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
                <ProgressBar percentage={progressPercentage} loading={progressLoading} />
              </div>
              <div className="text-center px-2 md:px-6">
                <CardTitle className="text-2xl md:text-3xl leading-tight line-clamp-2 max-w-4xl mx-auto">{settings.onboarding_step2_title || 'Parabéns pela coragem e pela abertura de dar as mãos à Jesus neste momento difícil.'}</CardTitle>
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
                const nextUrl = await getNextStepUrl(desiredStep);
                router.replace(nextUrl);
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
                  <ProgressBar percentage={progressPercentage} loading={progressLoading} />
                </div>
                <div className="text-center px-2 md:px-6">
                  <CardTitle className="text-2xl md:text-3xl leading-tight line-clamp-2 max-w-4xl mx-auto">{processedForm?.name || form.name}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {(processedForm?.description || form.description) && <p className="text-black text-lg">{processedForm?.description || form.description}</p>}
              <Input placeholder="Digite sua resposta..." value={shortText} onChange={(e) => setShortText(e.target.value)} />
              <div className="flex justify-between">
                <Button variant="ghost" onClick={skip} disabled={submitting}>Agora não</Button>
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
                  <ProgressBar percentage={progressPercentage} loading={progressLoading} />
                </div>
                <CardTitle className="text-2xl">{processedForm?.name || form.name}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {(processedForm?.description || form.description) && (
                <p className="text-black text-lg">{processedForm?.description || form.description}</p>
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
                        <span className="text-base">{opt.label}</span>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between">
                <Button variant="ghost" onClick={skip} disabled={submitting}>Agora não</Button>
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
                <ProgressBar percentage={progressPercentage} loading={progressLoading} />
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
                    <span className="text-base">{opt.label}</span>
                  </label>
                </div>
              ))}
            </RadioGroup>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={skip} disabled={submitting}>Agora não</Button>
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
              <Button onClick={() => router.replace('/')}>Voltar para a Home</Button>
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
              <ProgressBar percentage={progressPercentage} loading={progressLoading} />
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
              if (key === 'other') {
                setSelected('');
                // Não limpar o texto quando selecionar "other"
              } else {
                const index = Number(key);
                const chosen = form.schema?.[index];
                if (chosen) {
                  setSelected(chosen.category_id);
                  // Limpar campo "Outros" quando selecionar uma opção
                  setOtherOptionText('');
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
                  <span className="text-base">{opt.label}</span>
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
                  <label htmlFor="opt-other" className="text-base cursor-pointer flex-1">
                    {processedForm?.other_option_label || form.other_option_label || 'Outros'}
                  </label>
                </div>
                {selectedKey === 'other' && (
                  <div className="pl-9 pr-4">
                    <Input
                      id="opt-other-input"
                      placeholder="Digite sua opção..."
                      value={otherOptionText}
                      onChange={(e) => {
                        setOtherOptionText(e.target.value);
                      }}
                      className="w-full"
                      autoFocus
                    />
                  </div>
                )}
              </div>
            )}
          </RadioGroup>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={skip} disabled={submitting}>Agora não</Button>
            <Button 
              onClick={submit} 
              disabled={(!selected && !(form.allow_other_option && otherOptionText.trim())) || submitting}
            >
              {submitting ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


