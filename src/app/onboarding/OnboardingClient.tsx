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
        } else if (desiredStep === 2) {
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
        } else if (desiredStep === 3) {
          const categoryId = searchParams?.get('categoryId');
          if (categoryId && !category) {
            const { data: cat } = await supabase
              .from('categories')
              .select('id,name,description,image_url')
              .eq('id', categoryId)
              .maybeSingle();
            if (mounted) setCategory((cat as any) || null);
          }
        } else {
          // Passos dinâmicos adicionais (>= 4)
          let { data, error } = await supabase
            .from('admin_forms')
            .select('*')
            .eq('form_type', 'onboarding')
            .eq('is_active', true)
            .eq('onboard_step', desiredStep)
            .eq('parent_form_id', activeFormId || '-')
            .maybeSingle();
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
      // Procurar próximo formulário encadeado (filho) e ir direto para ele se existir; caso contrário, ir para o preview (passo 2)
      try {
        let nextStep: number | null = null;
        let resp = await supabase
          .from('admin_forms')
          .select('onboard_step')
          .eq('form_type', 'onboarding')
          .eq('is_active', true)
          .eq('parent_form_id', form.id)
          .order('onboard_step', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (resp.error && (resp.error.code === '42703' || /parent_form_id/i.test(String(resp.error.message || '')))) {
          // Ambiente sem parent_form_id – não há encadeamento; mantém fluxo padrão
          resp = null as any;
        }
        if (resp && resp.data && typeof (resp.data as any).onboard_step === 'number') {
          nextStep = (resp.data as any).onboard_step as number;
        }
        const stepToGo = Number.isFinite(nextStep as any) ? (nextStep as number) : 2;
        const categoryParam = `categoryId=${encodeURIComponent(selected)}`;
        const formParam = `formId=${encodeURIComponent(form.id)}`;
        router.replace(`/onboarding?step=${stepToGo}&${categoryParam}&${formParam}`);
      } catch {
        router.replace(`/onboarding?step=2&categoryId=${encodeURIComponent(selected)}&formId=${encodeURIComponent(form.id)}`);
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
            <div className="relative">
              <span className="absolute right-0 top-0 px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo 6</span>
              <div className="mt-10 md:mt-12 text-center px-2 md:px-6">
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
                onClick={() => router.replace(`/onboarding?step=7${currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : ''}${activeFormId ? `&formId=${encodeURIComponent(activeFormId)}` : ''}`)}
              >
                Pular
              </Button>
              <Button
                onClick={() => {
                  router.replace(`/onboarding?step=7${currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : ''}${activeFormId ? `&formId=${encodeURIComponent(activeFormId)}` : ''}`);
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
      const nextStep = currentStep + 1;
      const parentFormId = (form as any).parent_form_id || activeFormId || form.id;

      // 1) Tentar ir exatamente para o próximo formulário encadeado
      let { data, error } = await supabase
        .from('admin_forms')
        .select('id')
        .eq('form_type', 'onboarding')
        .eq('is_active', true)
        .eq('onboard_step', nextStep)
        .eq('parent_form_id', parentFormId)
        .maybeSingle();

      // 2) Se a coluna parent_form_id não existir OU não houver formulário no próximo passo,
      //    tentar encontrar o próximo passo disponível (> passo atual)
      if ((error && (error.code === '42703' || /parent_form_id/i.test(String(error.message || '')))) || (!error && !data)) {
        let fb2 = await supabase
          .from('admin_forms')
          .select('id, onboard_step')
          .eq('form_type', 'onboarding')
          .eq('is_active', true)
          .eq('parent_form_id', parentFormId)
          .gt('onboard_step', currentStep)
          .order('onboard_step', { ascending: true })
          .limit(1)
          .maybeSingle();
        // Se parent_form_id não existir, buscar globalmente o próximo passo disponível
        if (fb2.error && (fb2.error.code === '42703' || /parent_form_id/i.test(String(fb2.error.message || '')))) {
          fb2 = await supabase
            .from('admin_forms')
            .select('id, onboard_step')
            .eq('form_type', 'onboarding')
            .eq('is_active', true)
            .gt('onboard_step', currentStep)
            .order('onboard_step', { ascending: true })
            .limit(1)
            .maybeSingle();
        }
        if (!fb2.error && fb2.data) {
          const nextAvailable = (fb2.data as any).onboard_step as number;
          const cat = currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : '';
          router.replace(`/onboarding?step=${nextAvailable}&formId=${encodeURIComponent(parentFormId)}${cat}`);
          return;
        }
      }

      // 3) Fallback final: seguir para o próximo passo "estático" conhecido
      const cat = currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : '';
      const formParam = parentFormId ? `&formId=${encodeURIComponent(parentFormId)}` : '';
      let fallbackStep = nextStep;
      if (fallbackStep <= 3) {
        router.replace(`/onboarding?step=${fallbackStep}${formParam}${cat}`);
        return;
      }
      if (fallbackStep <= 5) {
        router.replace(`/onboarding?step=6${formParam}${cat}`);
        return;
      }
      if (fallbackStep === 6) {
        router.replace(`/onboarding?step=7${formParam}${cat}`);
        return;
      }
      if (fallbackStep === 7) {
        router.replace(`/onboarding?step=8${formParam}${cat}`);
        return;
      }
      router.replace('/');
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
      const nextStep = (form.onboard_step || desiredStep) + 1;
      const parentFormId = (form as any).parent_form_id || activeFormId || form.id;

      // Após finalizar o Passo 5, construir/atualizar a playlist pessoal "Minha Rotina"
      try {
        const currentStep = form.onboard_step || desiredStep;
        if (currentStep === 5 && user?.id) {
          await buildRoutinePlaylistFromOnboarding({ userId: user.id, rootFormId: parentFormId });
        }
      } catch (err) {
        // Não bloquear o fluxo de navegação por erro aqui
        // eslint-disable-next-line no-console
        console.error('buildRoutinePlaylistFromOnboarding error:', err);
      }
      let { data, error } = await supabase
        .from('admin_forms')
        .select('id')
        .eq('form_type', 'onboarding')
        .eq('is_active', true)
        .eq('onboard_step', nextStep)
        .eq('parent_form_id', parentFormId)
        .maybeSingle();
      // Fallback quando parent_form_id não existe ou quando não foi vinculado
      if ((error && (error.code === '42703' || /parent_form_id/i.test(String(error.message || '')))) || (!error && !data)) {
        const fb = await supabase
          .from('admin_forms')
          .select('id')
          .eq('form_type', 'onboarding')
          .eq('is_active', true)
          .eq('onboard_step', nextStep)
          .maybeSingle();
        data = fb.data as any;
        error = fb.error as any;
      }
      if (data) {
        router.replace(`/onboarding?step=${nextStep}&formId=${encodeURIComponent(parentFormId)}${currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : ''}`);
      } else {
        // considerar passos virtuais 2, 3 e 6 (playlist da rotina)
        if (nextStep === 2 || nextStep === 3 || nextStep === 6) {
          router.replace(`/onboarding?step=${nextStep}&formId=${encodeURIComponent(parentFormId)}${currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : ''}`);
        } else {
          router.replace('/');
        }
      }
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
            <div className="relative">
              <span className="absolute right-0 top-0 px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo 7</span>
              <div className="mt-10 md:mt-12 text-center px-2 md:px-6">
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
                onClick={() => router.replace(`/onboarding?step=8${currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : ''}${activeFormId ? `&formId=${encodeURIComponent(activeFormId)}` : ''}`)}
              >
                Pular
              </Button>
              {hasWhatsApp && (
                <Button onClick={() => router.replace(`/onboarding?step=8${currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : ''}${activeFormId ? `&formId=${encodeURIComponent(activeFormId)}` : ''}`)}>Concluir</Button>
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
            <div className="relative">
              <span className="absolute right-0 top-0 px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo 8</span>
              <div className="mt-10 md:mt-12 text-center px-2 md:px-6">
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

  // Passo 3: Configurar WhatsApp (embedded)
  if (desiredStep === 3) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Card>
          <CardHeader>
            <div className="relative">
              <span className="absolute right-0 top-0 px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo 3</span>
              <div className="mt-10 md:mt-12 text-center px-2 md:px-6">
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
                  try {
                    // Pular este passo: tentar encontrar o próximo formulário encadeado (> 3)
                    const parentId = activeFormId || '';
                    if (parentId) {
                      let { data, error } = await supabase
                        .from('admin_forms')
                        .select('onboard_step')
                        .eq('form_type', 'onboarding')
                        .eq('is_active', true)
                        .eq('parent_form_id', parentId)
                        .gt('onboard_step', 3)
                        .order('onboard_step', { ascending: true })
                        .limit(1)
                        .maybeSingle();
                      if (error && (error.code === '42703' || /parent_form_id/i.test(String(error.message || '')))) {
                        const fb = await supabase
                          .from('admin_forms')
                          .select('onboard_step')
                          .eq('form_type', 'onboarding')
                          .eq('is_active', true)
                          .gt('onboard_step', 3)
                          .order('onboard_step', { ascending: true })
                          .limit(1)
                          .maybeSingle();
                        data = fb.data as any;
                        error = fb.error as any;
                      }
                      if (!error && data && typeof (data as any).onboard_step === 'number') {
                        const next = (data as any).onboard_step as number;
                        const cat = currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : '';
                        router.replace(`/onboarding?step=${next}&formId=${encodeURIComponent(parentId)}${cat}`);
                        return;
                      }
                    }
                  } catch {
                    // Ignorar e cair no redirecionamento padrão
                  }
                  router.replace('/');
                }}
              >
                Pular
              </Button>

              <Button
                onClick={async () => {
                  try {
                    // Após configurar o WhatsApp, tentar seguir para a próxima etapa filha (ex.: Passo 4)
                    const parentId = activeFormId || '';
                    if (parentId) {
                      let { data, error } = await supabase
                        .from('admin_forms')
                        .select('onboard_step')
                        .eq('form_type', 'onboarding')
                        .eq('is_active', true)
                        .eq('parent_form_id', parentId)
                        .gt('onboard_step', 3)
                        .order('onboard_step', { ascending: true })
                        .limit(1)
                        .maybeSingle();
                      // Fallback se a coluna parent_form_id não existir
                      if (error && (error.code === '42703' || /parent_form_id/i.test(String(error.message || '')))) {
                        const fb = await supabase
                          .from('admin_forms')
                          .select('onboard_step')
                          .eq('form_type', 'onboarding')
                          .eq('is_active', true)
                          .gt('onboard_step', 3)
                          .order('onboard_step', { ascending: true })
                          .limit(1)
                          .maybeSingle();
                        data = fb.data as any;
                        error = fb.error as any;
                      }
                      if (!error && data && typeof (data as any).onboard_step === 'number') {
                        const next = (data as any).onboard_step as number;
                        const cat = currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : '';
                        router.replace(`/onboarding?step=${next}&formId=${encodeURIComponent(parentId)}${cat}`);
                        return;
                      }
                    }
                  } catch {
                    // Ignorar e cair no redirecionamento padrão
                  }
                  router.replace('/');
                }}
              >
                Concluir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passo 2: Preview da categoria
  if (desiredStep === 2) {

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
            <div className="relative">
              <span className="absolute right-0 top-0 px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo 2</span>
              <div className="mt-10 md:mt-12 text-center px-2 md:px-6">
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
              <Button onClick={() => router.replace(`/onboarding?step=3${currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : ''}${activeFormId ? `&formId=${encodeURIComponent(activeFormId)}` : ''}`)}>
                Avançar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passos dinâmicos (>= 4 ou personalizados)
  if (desiredStep !== 1 && desiredStep !== 2 && desiredStep !== 3 && form) {
    const isShortText = Array.isArray((form as any).schema) && (form as any).schema[0]?.type === 'short_text';
    if (isShortText) {
      return (
        <div className="max-w-2xl mx-auto p-4">
          <Card>
            <CardHeader>
              <div className="relative">
                <span className="absolute right-0 top-0 px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo {desiredStep}</span>
                <div className="mt-10 md:mt-12 text-center px-2 md:px-6">
                  <CardTitle className="text-2xl md:text-3xl leading-tight line-clamp-2 max-w-4xl mx-auto">{form.name}</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {form.description && <p className="text-black text-lg">{form.description}</p>}
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
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">{form.name}</CardTitle>
                <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo {desiredStep}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {form.description && (
                <p className="text-black text-lg">{form.description}</p>
              )}

              <div className="space-y-3">
                {(form.schema as any[])?.map((opt: any, idx: number) => {
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">{form.name}</CardTitle>
              <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo {desiredStep}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {form.description && (
              <p className="text-black text-lg">{form.description}</p>
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
              {(form.schema as any[])?.map((opt: any, idx: number) => (
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
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{form.name}</CardTitle>
            {typeof form.onboard_step === 'number' && (
              <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo {form.onboard_step}</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {form.description && (
            <p className="text-black text-lg">{form.description}</p>
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
            {form.schema?.map((opt, idx) => (
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
                    {form.other_option_label || 'Outros'}
                  </label>
                </div>
                <Input
                  id="opt-other-input"
                  placeholder="Digite sua opção..."
                  value={otherOptionText}
                  onChange={(e) => {
                    setOtherOptionText(e.target.value);
                    if (e.target.value.trim()) {
                      setSelectedKey('other');
                      setSelected('');
                    } else {
                      setSelectedKey('');
                    }
                  }}
                  className="ml-9"
                />
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


