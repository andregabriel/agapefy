"use client";

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { saveFormResponse } from '@/lib/services/forms';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getPlaylistsByCategoryFast } from '@/lib/supabase-queries';
import WhatsAppSetup from '@/components/whatsapp/WhatsAppSetup';
import { useAppSettings } from '@/hooks/useAppSettings';

interface FormOption { label: string; category_id: string }
interface AdminForm { id: string; name: string; description?: string; schema: FormOption[]; onboard_step?: number | null }
interface AudioPreview { id: string; title: string; subtitle?: string | null; duration?: number | null; cover_url?: string | null }

export default function OnboardingClient() {
  const { user } = useAuth();
  const { settings } = useAppSettings();
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [category, setCategory] = useState<{ id: string; name: string; description?: string | null; image_url?: string | null } | null>(null);
  const [audios, setAudios] = useState<AudioPreview[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; title: string; description?: string | null; cover_url?: string | null }[]>([]);

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

  async function submit() {
    if (!form || !selected) {
      toast.error('Selecione uma opção');
      return;
    }
    try {
      setSubmitting(true);
      await saveFormResponse({ formId: form.id, answers: { option: selected }, userId: user?.id ?? null });
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

  async function skip() {
    if (!form) return;
    try {
      setSubmitting(true);
      await saveFormResponse({ formId: form.id, answers: { skipped: true }, userId: user?.id ?? null });
      toast.success('Passo adiado');
      const nextStep = (form.onboard_step || desiredStep) + 1;
      const parentFormId = (form as any).parent_form_id || activeFormId || form.id;
      const { data } = await supabase
        .from('admin_forms')
        .select('id')
        .eq('form_type', 'onboarding')
        .eq('is_active', true)
        .eq('onboard_step', nextStep)
        .eq('parent_form_id', parentFormId)
        .maybeSingle();
      if (data) {
        router.replace(`/onboarding?step=${nextStep}&formId=${encodeURIComponent(parentFormId)}${currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : ''}`);
      } else {
        router.replace('/');
      }
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
      const { data } = await supabase
        .from('admin_forms')
        .select('id')
        .eq('form_type', 'onboarding')
        .eq('is_active', true)
        .eq('onboard_step', nextStep)
        .eq('parent_form_id', parentFormId)
        .maybeSingle();
      if (data) {
        router.replace(`/onboarding?step=${nextStep}&formId=${encodeURIComponent(parentFormId)}${currentCategoryId ? `&categoryId=${encodeURIComponent(currentCategoryId)}` : ''}`);
      } else {
        // considerar passos virtuais 2 e 3
        if (nextStep === 2 || nextStep === 3) {
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
            <div className="flex justify-end">
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
              const index = Number(key);
              const chosen = form.schema?.[index];
              if (chosen) setSelected(chosen.category_id);
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
          </RadioGroup>

          <div className="flex justify-between">
            <Button variant="ghost" onClick={skip} disabled={submitting}>Agora não</Button>
            <Button onClick={submit} disabled={!selected || submitting}>{submitting ? 'Enviando...' : 'Enviar'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


