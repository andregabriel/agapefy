"use client";

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Play, Share2, VolumeX, SkipBack, SkipForward, Pause } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── TYPES ──────────────────────────────────────────────────────
type BlockType = 'verso' | 'reflexao' | 'oracao';

interface DevotionalContent {
  title: string;
  label: string;
  reference: string;
  time: string;
  text: string;
  audioId?: string;
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────
const VALID_BLOCKS: BlockType[] = ['verso', 'reflexao', 'oracao'];

export default function DevotionalBlockPage() {
  const params = useParams();
  const router = useRouter();
  const bloco = params.bloco as string;

  // ── Fix 1: Validate block param, redirect if invalid ──
  useEffect(() => {
    if (!VALID_BLOCKS.includes(bloco as BlockType)) {
      router.replace('/hoje');
    }
  }, [bloco, router]);

  const blockType = bloco as BlockType;

  const [content, setContent] = useState<DevotionalContent | null>(null);
  const [loading, setLoading] = useState(true);

  // State for versículo/reflexão
  const [choiceMade, setChoiceMade] = useState(blockType === 'oracao');
  const [reachedEnd, setReachedEnd] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State for oração (friction)
  const [progress, setProgress] = useState(0);
  const [visiblePara, setVisiblePara] = useState(0);
  const [totalDuration, setTotalDuration] = useState(102);

  // ── Fix 2: reset state when changing block ──
  useEffect(() => {
    setChoiceMade(blockType === 'oracao');
    setReachedEnd(false);
    setProgress(0);
    setVisiblePara(0);
    setContent(null);
    setLoading(true);
  }, [blockType]);

  // ─── LOAD CONTENT FROM REAL SCHEMA ─────────────────────────────
  useEffect(() => {
    async function loadContent() {
      if (!VALID_BLOCKS.includes(bloco as BlockType)) return;

      try {
        const today = new Date().toISOString().split('T')[0];
        const { data: devotional, error } = await supabase
          .from('devotionals')
          .select('*')
          .eq('date', today)
          .single();

        if (error || !devotional) {
          console.error('❌ Devocional não encontrado:', error);
          setLoading(false);
          return;
        }

        let blockContent: DevotionalContent;

        if (blockType === 'verso') {
          // ── Schema real: passage_ref, passage_intro, passage_verses (jsonb) ──
          // passage_verses é um array de objetos: [{ n: 5, t: "texto..." }, ...]
          const verses = devotional.passage_verses as Array<{ n: number; t: string }> | null;
          const versesText = verses
            ? verses.map(v => `${v.n} ${v.t}`).join('\n\n')
            : '';
          const fullText = devotional.passage_intro
            ? `${devotional.passage_intro}\n\n${versesText}`
            : versesText;

          blockContent = {
            title: devotional.title || 'Versículo do Dia',
            label: 'PASSAGEM',
            reference: devotional.passage_ref || '',
            time: '1 min',
            text: fullText,
          };

        } else if (blockType === 'reflexao') {
          // ── Schema real: reflection_text ──
          blockContent = {
            title: devotional.title || 'Reflexão do Dia',
            label: 'REFLEXÃO',
            reference: devotional.theme || devotional.passage_ref || '',
            time: '5 min',
            text: devotional.reflection_text || '',
          };

        } else {
          // ── Schema real: prayer_text, prayer_audio_id ──
          let prayerText = devotional.prayer_text || '';

          // Se não tem prayer_text mas tem audio, buscar transcript
          if (!prayerText && devotional.prayer_audio_id) {
            const { data: audio } = await supabase
              .from('audios')
              .select('transcript, duration')
              .eq('id', devotional.prayer_audio_id)
              .single();
            prayerText = audio?.transcript || '';
            if (audio?.duration) setTotalDuration(Math.ceil(audio.duration));
          }

          blockContent = {
            title: devotional.title || 'Oração do Dia',
            label: 'ORAÇÃO',
            reference: 'Oração do dia',
            time: '2 min',
            text: prayerText,
            audioId: devotional.prayer_audio_id || undefined,
          };
        }

        setContent(blockContent);
      } catch (err) {
        console.error('❌ Erro ao carregar bloco:', err);
      } finally {
        setLoading(false);
      }
    }

    loadContent();
  }, [bloco, blockType]);

  // ─── PRAYER FRICTION: auto-advance progress ────────────────────
  useEffect(() => {
    if (blockType !== 'oracao' || !content) return;

    const interval = setInterval(() => {
      setProgress(p => {
        const next = p + 1;
        if (next >= totalDuration) {
          clearInterval(interval);
          return totalDuration;
        }
        const paraCount = content.text.split('\n\n').length;
        const paraIdx = Math.min(
          Math.floor((next / totalDuration) * paraCount),
          paraCount - 1
        );
        setVisiblePara(paraIdx);
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [blockType, content, totalDuration]);

  // ─── SCROLL DETECTION (versículo/reflexão) ─────────────────────
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
      setReachedEnd(true);
    }
  }, []);

  // ── Fix 2: If text fits without scroll, auto-enable Concluir ──
  useEffect(() => {
    if (blockType === 'oracao' || !choiceMade) return;
    // Small delay to let DOM render text content
    const timer = setTimeout(() => {
      const el = scrollContainerRef.current;
      if (!el) return;
      if (el.scrollHeight <= el.clientHeight + 60) {
        setReachedEnd(true);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [choiceMade, blockType]);

  // ─── HANDLERS ──────────────────────────────────────────────────
  const handleBack = () => router.push('/hoje');

  // Paywall via evento global (PaywallModal já existe em AppShell)
  const handlePay = () => {
    window.dispatchEvent(new CustomEvent('agapefy:paywall-open'));
  };

  const handleDone = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { data: devotional } = await supabase
        .from('devotionals')
        .select('id')
        .eq('date', today)
        .single();

      if (devotional) {
        const blockTypeMap: Record<BlockType, string> = {
          verso: 'verse',
          reflexao: 'reflection',
          oracao: 'prayer',
        };

        // upsert com onConflict explícito para UNIQUE(user_id, devotional_id, block_type)
        await supabase
          .from('user_devotional_progress')
          .upsert(
            {
              user_id: user.id,
              devotional_id: devotional.id,
              block_type: blockTypeMap[blockType],
              completed_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,devotional_id,block_type' }
          );
      }
    } catch (err) {
      console.error('Erro ao registrar progresso:', err);
    }

    router.push('/hoje');
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: content?.title,
          text: content?.text?.substring(0, 200) + '...',
          url: window.location.href,
        });
      } catch {
        // User cancelled share
      }
    }
  };

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!content) return;
    const val = Number(e.target.value);
    setProgress(val);
    const paraCount = content.text.split('\n\n').length;
    setVisiblePara(Math.min(Math.floor((val / totalDuration) * paraCount), paraCount - 1));
  };

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ─── LOADING ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAFAF7' }}>
        <div className="w-6 h-6 border-2 border-[#B8924A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!content || !content.text) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#FAFAF7' }}>
        <p className="text-[#9A9A9A] text-sm" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
          Conteúdo não encontrado
        </p>
        <button
          onClick={handleBack}
          className="text-[13px] font-semibold cursor-pointer bg-transparent border-none"
          style={{ fontFamily: "'Source Sans 3', sans-serif", color: '#B8924A' }}
        >
          ← Voltar
        </button>
      </div>
    );
  }

  const paras = content.text.split('\n\n').filter(p => p.trim());
  const isPrayer = blockType === 'oracao';

  // ═══════════════════════════════════════════════════════════════
  // ORAÇÃO — Friction mode (blur + mini-player + mute CTA)
  // ═══════════════════════════════════════════════════════════════
  if (isPrayer) {
    return (
      <div className="min-h-screen relative flex flex-col" style={{ background: '#FAFAF7' }}>
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 pt-3 pb-[160px]">
          {/* Back */}
          <button onClick={handleBack} className="mb-3 p-1 bg-transparent border-none cursor-pointer">
            <ArrowLeft size={22} color="#1A2744" />
          </button>

          {/* Header */}
          <p
            className="text-[11px] font-semibold uppercase tracking-[2px] mb-1.5"
            style={{ fontFamily: "'Source Sans 3', sans-serif", color: '#B8924A' }}
          >
            Oração
          </p>
          <h2
            className="text-[22px] font-semibold mb-1"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#1A2744' }}
          >
            {content.title}
          </h2>
          <p
            className="text-[12px] mb-5"
            style={{ fontFamily: "'Source Sans 3', sans-serif", color: '#9A9A9A' }}
          >
            Oração do dia • {content.time}
          </p>

          {/* Prayer text with blur friction */}
          <div>
            {paras.map((p, i) => (
              <p
                key={i}
                className="mb-[18px] transition-all duration-500"
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: 15,
                  lineHeight: 1.85,
                  color: '#1A2744',
                  filter: i > visiblePara ? 'blur(3.5px)' : 'none',
                  userSelect: i > visiblePara ? 'none' : 'auto',
                }}
              >
                {p}
              </p>
            ))}
          </div>

          {/* Concluir — only when last paragraph revealed */}
          {visiblePara >= paras.length - 1 && (
            <div className="mt-2 text-center">
              <button
                onClick={handleDone}
                className="px-12 py-3.5 border-none rounded-[10px] text-white text-[13px] font-semibold cursor-pointer"
                style={{ fontFamily: "'Source Sans 3', sans-serif", background: '#3D8B5F' }}
              >
                Concluir leitura ✓
              </button>
            </div>
          )}
        </div>

        {/* ── MINI-PLAYER (fixed bottom, dark) ── */}
        <div
          className="fixed bottom-0 left-0 right-0 z-30"
          style={{ background: '#1A2744', paddingBottom: 24 }}
        >
          {/* Progress bar */}
          <div className="px-4">
            <input
              type="range"
              min={0}
              max={totalDuration}
              value={progress}
              onChange={handleSlider}
              className="w-full h-[3px] cursor-pointer block"
              style={{ accentColor: '#B8924A' }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-white/50 tabular-nums" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
                {fmt(progress)}
              </span>
              <span className="text-[10px] text-white/50 tabular-nums" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
                {fmt(totalDuration)}
              </span>
            </div>
          </div>

          {/* Track info + controls */}
          <div className="flex items-center px-4 pt-1.5 gap-3">
            {/* Play */}
            <button className="w-9 h-9 rounded-full bg-white/10 border-none flex items-center justify-center cursor-pointer shrink-0">
              <Play size={16} color="rgba(255,255,255,0.6)" fill="rgba(255,255,255,0.6)" />
            </button>

            {/* Track info */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate m-0" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
                {content.title}
              </p>
              <p className="text-[11px] text-white/50 m-0" style={{ fontFamily: "'Source Sans 3', sans-serif" }}>
                Oração do dia
              </p>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2.5 shrink-0">
              <button className="bg-transparent border-none cursor-pointer p-0.5">
                <SkipBack size={16} color="rgba(255,255,255,0.5)" fill="rgba(255,255,255,0.5)" />
              </button>
              <button className="bg-transparent border-none cursor-pointer p-0.5">
                <Pause size={20} color="white" fill="white" />
              </button>
              <button className="bg-transparent border-none cursor-pointer p-0.5">
                <SkipForward size={16} color="rgba(255,255,255,0.5)" fill="rgba(255,255,255,0.5)" />
              </button>
            </div>

            {/* 🔇 MUTE CTA — gold pulsing, main conversion trigger */}
            <button
              onClick={handlePay}
              className="w-10 h-10 rounded-full border-none cursor-pointer flex items-center justify-center shrink-0 animate-mute-pulse"
              style={{ background: '#B8924A' }}
            >
              <VolumeX size={18} color="white" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VERSÍCULO / REFLEXÃO — Choice card (OUVIR/LER) + reading mode
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen relative flex flex-col" style={{ background: '#FAFAF7' }}>
      {/* Scrollable content */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`flex-1 px-5 pt-3 pb-[100px] ${choiceMade ? 'overflow-y-auto' : 'overflow-hidden'}`}
      >
        {/* Back */}
        <button onClick={handleBack} className="mb-3 p-1 bg-transparent border-none cursor-pointer">
          <ArrowLeft size={22} color="#1A2744" />
        </button>

        {/* Header */}
        <p
          className="text-[11px] font-semibold uppercase tracking-[2px] mb-1.5"
          style={{ fontFamily: "'Source Sans 3', sans-serif", color: '#B8924A' }}
        >
          {content.label}
        </p>
        <h2
          className="text-[22px] font-semibold mb-1"
          style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#1A2744' }}
        >
          {content.title}
        </h2>
        <p
          className="text-[12px] mb-5"
          style={{ fontFamily: "'Source Sans 3', sans-serif", color: '#9A9A9A' }}
        >
          {content.reference} • {content.time}
        </p>

        {/* ── Choice card: OUVIR / LER ── */}
        {!choiceMade && (
          <div
            className="rounded-[14px] p-7 text-center"
            style={{ background: '#FFFFFF', boxShadow: '0 2px 12px rgba(0,0,0,0.05)' }}
          >
            <p
              className="text-[18px] font-semibold mb-1.5"
              style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: '#1A2744' }}
            >
              Como deseja vivenciar?
            </p>
            <p
              className="text-[12px] mb-6"
              style={{ fontFamily: "'Source Sans 3', sans-serif", color: '#9A9A9A' }}
            >
              Ouça com narração em áudio ou leia o texto
            </p>

            {/* OUVIR — premium */}
            <button
              onClick={handlePay}
              className="w-full py-[15px] rounded-[10px] text-white text-[13px] font-semibold cursor-pointer border-none mb-2.5 flex items-center justify-center gap-2"
              style={{ fontFamily: "'Source Sans 3', sans-serif", background: '#1A2744' }}
            >
              <span
                className="flex items-center justify-center rounded-full"
                style={{ width: 28, height: 28, background: '#B8924A' }}
              >
                <Play size={13} color="white" fill="white" />
              </span>
              OUVIR
              <span
                className="text-[9px] font-bold tracking-wide rounded-lg"
                style={{ padding: '2px 8px', background: 'rgba(184,146,74,0.3)', color: '#D4B06A' }}
              >
                PREMIUM
              </span>
            </button>

            {/* LER — free */}
            <button
              onClick={() => setChoiceMade(true)}
              className="w-full py-[15px] rounded-[10px] text-[13px] font-semibold cursor-pointer border-none flex items-center justify-center gap-2"
              style={{ fontFamily: "'Source Sans 3', sans-serif", background: '#F5F0E8', color: '#1A2744' }}
            >
              <span className="text-[15px]">📖</span>
              LER
              <span
                className="text-[9px] font-bold tracking-wide rounded-lg"
                style={{ padding: '2px 8px', background: 'rgba(61,139,95,0.15)', color: '#3D8B5F' }}
              >
                GRATUITO
              </span>
            </button>
          </div>
        )}

        {/* ── Text content (only after choosing LER) ── */}
        {choiceMade && (
          <div>
            {paras.map((p, i) => (
              <p
                key={i}
                className="mb-[18px]"
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: 15,
                  lineHeight: 1.85,
                  color: '#1A2744',
                }}
              >
                {p}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* ── Floating Concluir bar ── */}
      {choiceMade && (
        <div
          className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center"
          style={{
            background: '#FFFFFF',
            borderTop: '1.5px solid #EEEBE5',
            padding: '14px 20px 26px',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.06)',
          }}
        >
          {reachedEnd ? (
            <button
              onClick={handleDone}
              className="px-10 py-3.5 border-none rounded-[10px] text-white text-[13px] font-semibold cursor-pointer"
              style={{ fontFamily: "'Source Sans 3', sans-serif", background: '#3D8B5F' }}
            >
              Concluir leitura ✓
            </button>
          ) : (
            <p
              className="text-[14px] font-semibold m-0 opacity-50"
              style={{ fontFamily: "'Source Sans 3', sans-serif", color: '#1A2744' }}
            >
              Leia até o final para concluir ↓
            </p>
          )}
        </div>
      )}

      {/* ── Floating play + share ── */}
      {choiceMade && (
        <div className="fixed z-30 flex flex-col gap-2.5" style={{ bottom: 80, right: 16 }}>
          <button
            onClick={handlePay}
            className="w-[50px] h-[50px] rounded-full border-none cursor-pointer flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #B8924A, #D4B06A)',
              boxShadow: '0 4px 16px rgba(184,146,74,0.45)',
            }}
          >
            <Play size={22} color="white" fill="white" />
          </button>
          <button
            onClick={handleShare}
            className="w-[50px] h-[50px] rounded-full cursor-pointer flex items-center justify-center"
            style={{
              background: '#FFFFFF',
              border: '1px solid #EEEBE5',
              boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
            }}
          >
            <Share2 size={19} color="#1A2744" />
          </button>
        </div>
      )}
    </div>
  );
}
