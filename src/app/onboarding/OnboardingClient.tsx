"use client";

import { useEffect, useMemo, useState } from 'react';
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

interface FormOption { label: string; category_id: string }
interface AdminForm { id: string; name: string; description?: string; schema: FormOption[]; onboard_step?: number | null }
interface AudioPreview { id: string; title: string; subtitle?: string | null; duration?: number | null; cover_url?: string | null }

export default function OnboardingClient() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const desiredStep = useMemo(() => {
    const stepParam = searchParams?.get('step');
    const parsed = stepParam ? Number(stepParam) : NaN;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [searchParams]);

  const [form, setForm] = useState<AdminForm | null>(null);
  const [selected, setSelected] = useState<string>(''); // stores selected category_id
  const [selectedKey, setSelectedKey] = useState<string>(''); // stores unique option key (index)
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [category, setCategory] = useState<{ id: string; name: string; description?: string | null; image_url?: string | null } | null>(null);
  const [audios, setAudios] = useState<AudioPreview[]>([]);
  const [playlists, setPlaylists] = useState<{ id: string; title: string; description?: string | null; cover_url?: string | null }[]>([]);

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
            // Fallback: pegar o primeiro formulário ativo de onboarding
            const fallback = await supabase
              .from('admin_forms')
              .select('*')
              .eq('form_type', 'onboarding')
              .eq('is_active', true)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
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
                .limit(3),
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
      // Ir direto para o preview (passo 2) com a categoria selecionada
      router.replace(`/onboarding?step=2&categoryId=${encodeURIComponent(selected)}`);
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
      const { data } = await supabase
        .from('admin_forms')
        .select('id')
        .eq('form_type', 'onboarding')
        .eq('is_active', true)
        .eq('onboard_step', nextStep)
        .maybeSingle();
      if (data) {
        router.replace(`/onboarding?step=${nextStep}`);
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
            <div className="flex items-center justify-between">
              <CardTitle>Parabéns, sua playlist foi criada!</CardTitle>
              <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-200 text-xs">Passo 2</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              {category?.image_url ? (
                <img src={category.image_url} alt={category.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-green-600 to-green-800" />
              )}
              <div className="p-4">
                <div className="text-lg font-semibold">{category?.name || 'Categoria selecionada'}</div>
                {category?.description ? (
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{category.description}</p>
                ) : (
                  <p className="text-gray-400 text-sm mt-1">Sua playlist foi criada com base na categoria escolhida.</p>
                )}
              </div>
            </div>

            {audios.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm text-gray-400">Sugestões dessa categoria</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {audios.slice(0, 3).map((audio) => {
                    const durationText = formatDuration(audio.duration);
                    return (
                      <Link
                        href={`/player/audio/${audio.id}`}
                        key={audio.id}
                        className="group block bg-gray-900 border border-gray-800 rounded-lg overflow-hidden hover:bg-gray-800/60 transition-colors"
                      >
                        <div className="flex items-center gap-3 p-3">
                          <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-800 flex-shrink-0">
                            {audio.cover_url ? (
                              <img src={audio.cover_url} alt={audio.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-green-600 to-green-800" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm truncate group-hover:text-green-400 transition-colors">{audio.title}</div>
                            {audio.subtitle && (
                              <div className="text-xs text-gray-400 truncate">{audio.subtitle}</div>
                            )}
                            {durationText && (
                              <div className="text-xs text-gray-500 mt-1">{durationText}</div>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {playlists.length > 0 && (
              <div className="space-y-3">
                <div className="text-sm text-gray-400">Playlists dessa categoria</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {playlists.map((playlist) => (
                    <div key={playlist.id} className="group bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-800 flex-shrink-0">
                          {playlist.cover_url ? (
                            <img src={playlist.cover_url} alt={playlist.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate group-hover:text-blue-400 transition-colors">{playlist.title}</div>
                          {playlist.description && (
                            <div className="text-xs text-gray-400 truncate">{playlist.description}</div>
                          )}
                        </div>
                      </div>
                      {/* Desabilitar play: não há botão de play e clic não navega */}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => router.replace('/whatsapp')}>
                Avançar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
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


