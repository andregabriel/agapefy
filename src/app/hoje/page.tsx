"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// ─── DESIGN TOKENS ───────────────────────────────────────────────
const C = {
  bg: "#FAFAF7",
  primary: "#1A2744",
  accent: "#B8924A",
  accentLight: "#D4B06A",
  success: "#3D8B5F",
  successLight: "#E8F5EE",
  text: "#1A2744",
  textMuted: "#9A9A9A",
  card: "#FFFFFF",
  warm: "#F5F0E8",
  border: "#EEEBE5",
  danger: "#C0392B",
};

const sf = "'Cormorant Garamond', Georgia, serif";
const ss = "'Source Sans 3', -apple-system, sans-serif";

const TOTAL_BLOCKS = 4;
const BLOCK_TYPES = ["citation", "verse", "reflection", "prayer"] as const;

// ─── FALLBACK DATA ───────────────────────────────────────────────
const FALLBACK_DEVOTIONAL = {
  id: "fallback",
  date: new Date().toISOString().split("T")[0],
  title: "A Coragem que Vem de Deus",
  theme: "Josué 1:9",
  citation_text: "Não fui eu que ordenei a você? Seja forte e corajoso! Não se apavore, nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.",
  citation_reference: "Josué 1:9",
  passage_ref: "Josué 1:5-9",
  passage_intro: "Após a morte de Moisés, Deus levanta Josué para conduzir o povo de Israel à Terra Prometida. Neste momento de transição, Deus fala diretamente ao coração de Josué com uma promessa que ecoa até os nossos dias.",
  passage_verses: [
    { n: 5, t: "Ninguém conseguirá resistir a você todos os dias da sua vida. Assim como estive com Moisés, estarei com você; nunca o deixarei, nunca o abandonarei." },
    { n: 6, t: "Seja forte e corajoso, porque você conduzirá este povo para herdar a terra que jurei dar aos seus antepassados." },
    { n: 7, t: "Somente seja forte e muito corajoso! Tenha o cuidado de obedecer a toda a lei que o meu servo Moisés lhe ordenou; não se desvie dela, nem para a direita nem para a esquerda, para que você seja bem-sucedido por onde quer que andar." },
    { n: 8, t: "Não deixe de falar as palavras deste Livro da Lei e de meditar nelas de dia e de noite, para que você cumpra fielmente tudo o que nele está escrito. Só então os seus caminhos prosperarão e você será bem-sucedido." },
    { n: 9, t: "Não fui eu que ordenei a você? Seja forte e corajoso! Não se apavore, nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar." },
  ],
  reflection_text: `Filho, filha, Eu sei que muitas vezes você acorda com o coração pesado. O dia mal começou e as preocupações já batem à porta. O trabalho, as contas, a saúde, os relacionamentos… tudo parece exigir de você uma força que você sente que não tem.

Mas Eu quero te dizer algo hoje: a coragem que você precisa não vem de você. Nunca veio. Ela vem de Mim.

Quando Eu disse a Josué "Seja forte e corajoso", não era porque ele tinha motivos humanos para ter coragem. Pelo contrário — ele estava assumindo uma missão enorme, sem o líder que o guiou a vida inteira. Ele tinha todo motivo para sentir medo.

Mas Eu não disse "não tenha medo porque tudo vai ser fácil." Eu disse: "Eu estarei com você." A coragem não nasce da ausência de dificuldade. Nasce da presença de Deus.

Hoje, Eu te faço a mesma promessa: onde você pisar, Eu já estou. O emprego novo, a conversa difícil, o exame médico, a decisão que você adia — Eu já estou lá. Você não vai sozinho.

Então levante a cabeça. Respire fundo. E dê o próximo passo. Não porque você é forte. Mas porque Eu sou.`,
  prayer_text: `Senhor, eu confesso que muitas vezes o medo toma conta do meu coração. As incertezas parecem maiores do que a Tua promessa.

Mas hoje eu escolho crer na Tua Palavra. Tu disseste que estarias comigo por onde eu andasse, e eu me agarro a essa verdade.

Me dá coragem para enfrentar este dia. Não a coragem do mundo, mas a coragem que vem de saber que Tu estás ao meu lado.

Que eu não me apavore diante das dificuldades, nem desanime no meio do caminho. Que cada passo meu hoje seja firme, porque é dado na Tua presença.

Em nome de Jesus, Amém.`,
};

// ─── TYPES ───────────────────────────────────────────────────────
interface FullDevotional {
  id: string;
  date: string;
  title: string;
  theme: string;
  citation_text: string;
  citation_reference: string;
  passage_ref: string;
  passage_intro: string;
  passage_verses: { n: number; t: string }[];
  reflection_text: string;
  prayer_text: string;
}

interface UserStreaks {
  current_streak: number;
  longest_streak: number;
  total_days_with_god: number;
  trophies: number;
}

// ─── ICONS ───────────────────────────────────────────────────────
const Icons = {
  childCheck: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" stroke={C.success} strokeWidth="1.8" fill="none"/>
      <path d="M7 12.5l3 3 7-7" stroke={C.success} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  parentCheck: (s = 34) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill={C.success}/>
      <path d="M7 12.5l3 3 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  parentCheckMini: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" fill={C.success}/>
      <path d="M7 12.5l3 3 7-7" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  heart: (filled: boolean, s = 19, c = C.primary) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={filled ? c : "none"} stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  feather: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>),
  book: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>),
  chat: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>),
  hands: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 11l-4.5 4.5a2.12 2.12 0 1 0 3 3L10 14"/><path d="M17 11l4.5 4.5a2.12 2.12 0 1 1-3 3L14 14"/><path d="M12 2v6"/><path d="M8.5 4.5L12 8l3.5-3.5"/></svg>),
  chev: (s = 14, c = C.textMuted) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>),
  lock: (s = 14) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.textMuted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>),
  users: (s = 16) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
  whatsapp: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>),
  back: (s = 22) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>),
  close: (s = 22, c = C.primary) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>),
  share: (s = 18) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>),
  textSz: (s = 16) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>),
  note: (s = 16) => (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={C.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>),
};

// ─── DOTS PROGRESS ───────────────────────────────────────────────
function Dots({ n, total = 10, s = 16 }: { n: number; total?: number; s?: number }) {
  return (
    <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: s, height: s, borderRadius: "50%",
          background: i < n ? `linear-gradient(135deg, ${C.accent}, ${C.accentLight})` : "transparent",
          border: i < n ? "none" : `2px solid ${C.border}`,
          transition: "all 0.3s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {i < n && (
            <svg width={s * 0.5} height={s * 0.5} viewBox="0 0 24 24" fill="none">
              <path d="M7 12.5l3 3 7-7" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── CSS ANIMATIONS ──────────────────────────────────────────────
const animationStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Source+Sans+3:wght@300;400;500;600;700&display=swap');
  
  @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes scaleIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
  .fu{animation:fadeUp .45s ease-out forwards}.fi{animation:fadeIn .35s ease-out forwards}.si{animation:scaleIn .3s ease-out forwards}
  .d1{animation-delay:.08s;opacity:0}.d2{animation-delay:.16s;opacity:0}.d3{animation-delay:.24s;opacity:0}
  .d4{animation-delay:.32s;opacity:0}.d5{animation-delay:.4s;opacity:0}.d6{animation-delay:.48s;opacity:0}
`;

// ─── WEEK DAYS ───────────────────────────────────────────────────
const WEEK_LABELS = ["S", "T", "Q", "Q", "S", "S", "D"];

function getWeekDayIndex(): number {
  const d = new Date().getDay(); // 0=Sun, 1=Mon...
  return d === 0 ? 6 : d - 1; // convert to Mon=0...Sun=6
}

// ─── CITATION FULLSCREEN ─────────────────────────────────────────
function CitationScreen({
  data,
  liked,
  onToggleLike,
  onShare,
  onStart,
}: {
  data: FullDevotional;
  liked: boolean;
  onToggleLike: () => void;
  onShare: () => void;
  onStart: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: `linear-gradient(170deg, ${C.primary} 0%, #2C3E6B 40%, #1A2744 100%)` }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.03, background: "repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,0.5) 35px, rgba(255,255,255,0.5) 36px)" }} />
      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-8 max-w-sm mx-auto">
        <div className="fu mb-14">
          <span className="text-white tracking-[3px] uppercase" style={{ fontFamily: sf, fontSize: 28, fontWeight: 600 }}>Agapefy</span>
        </div>
        <div className="fu d1 text-center max-w-[300px]">
          <div className="mx-auto mb-7" style={{ width: 40, height: 1, background: C.accent }} />
          <p className="text-white m-0 italic" style={{ fontFamily: sf, fontSize: 24, fontWeight: 400, lineHeight: 1.5 }}>{data.citation_text}</p>
          <div className="mx-auto mt-7 mb-[18px]" style={{ width: 40, height: 1, background: C.accent }} />
          <p className="m-0 uppercase tracking-[2px]" style={{ fontFamily: ss, fontSize: 13, fontWeight: 500, color: C.accentLight }}>{data.citation_reference}</p>
        </div>
        <div className="fu d3 mt-9">
          <button onClick={onToggleLike} className="bg-transparent border-none cursor-pointer p-2 transition-transform active:scale-90">
            <svg width={26} height={26} viewBox="0 0 24 24" fill={liked ? "#E8B4B8" : "none"} stroke={liked ? "#E8B4B8" : "rgba(255,255,255,0.5)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
      </div>
      <div className="fu d4 relative z-10 w-full px-8 pb-12 max-w-sm mx-auto">
        <button onClick={onShare} className="w-full py-[15px] rounded-xl text-white cursor-pointer mb-[10px] uppercase tracking-[1.5px] transition-all active:scale-[0.98]"
          style={{ fontFamily: ss, fontSize: 13, fontWeight: 600, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", backdropFilter: "blur(10px)" }}>
          Compartilhar
        </button>
        <button onClick={onStart} className="w-full py-[15px] rounded-xl text-white border-none cursor-pointer uppercase tracking-[1.5px] transition-all active:scale-[0.98]"
          style={{ fontFamily: ss, fontSize: 13, fontWeight: 600, background: C.accent }}>
          Começar Devocional
        </button>
      </div>
    </div>
  );
}

// ─── HOME DO DEVOCIONAL ──────────────────────────────────────────
function DevotionalHome({
  data,
  done,
  streaks,
  fav,
  setFav,
  onBlockClick,
}: {
  data: FullDevotional;
  done: Set<string>;
  streaks: UserStreaks;
  fav: boolean;
  setFav: (v: boolean) => void;
  onBlockClick: (blockId: string) => void;
}) {
  const allDone = done.size === TOTAL_BLOCKS;
  const todayIdx = getWeekDayIndex();

  const dateStr = new Date().toLocaleDateString("pt-BR", {
    day: "numeric", month: "long", year: "numeric",
  });

  const blocks = [
    { id: "citation", label: "Palavra do Dia", icon: Icons.feather, time: null },
    { id: "verse", label: "Versículo", icon: Icons.book, time: "1 min" },
    { id: "reflection", label: "Reflexão", icon: Icons.chat, time: "5 min" },
    { id: "prayer", label: "Oração", icon: Icons.hands, time: "2 min" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, paddingBottom: 100 }}>
      {/* Week strip */}
      <div className="fu" style={{ padding: "14px 20px 12px", display: "flex", gap: 6, justifyContent: "space-between" }}>
        {WEEK_LABELS.map((label, i) => {
          const past = i < todayIdx;
          const today = i === todayIdx;
          const dayDone = today && allDone;
          return (
            <div key={i} style={{ flex: 1, display: "flex", justifyContent: "center" }}>
              {dayDone ? (
                <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {Icons.parentCheck(36)}
                </div>
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: today ? C.primary : "transparent",
                  border: !today ? `1.5px solid ${C.border}` : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {past ? Icons.lock(13) : (
                    <span style={{ fontFamily: ss, fontSize: 13, fontWeight: 600, color: today ? "white" : C.textMuted }}>{label}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CARD 1: Devocional de Hoje */}
      <div className="fu d1" style={{ margin: "0 16px 12px", background: C.card, borderRadius: 16, padding: "20px 18px", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <p style={{ fontFamily: ss, fontSize: 11, fontWeight: 500, color: C.textMuted, letterSpacing: 1, textTransform: "uppercase", margin: "0 0 4px" }}>{dateStr}</p>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 2 }}>
          <h1 style={{ fontFamily: sf, fontSize: 22, fontWeight: 600, color: C.primary, margin: 0, lineHeight: 1.3, flex: 1, paddingRight: 8 }}>{data.title}</h1>
          <button onClick={() => setFav(!fav)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, marginTop: 2 }}>
            {Icons.heart(fav, 19, fav ? C.danger : C.textMuted)}
          </button>
        </div>
        <p style={{ fontFamily: ss, fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 16px" }}>Devocional de Hoje</p>
        <div style={{ height: 3, background: C.border, borderRadius: 2, marginBottom: 16, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${(done.size / TOTAL_BLOCKS) * 100}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.accentLight})`, borderRadius: 2, transition: "width 0.5s ease" }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {blocks.map((b, i) => {
            const isDone = done.has(b.id);
            return (
              <button key={b.id} onClick={() => onBlockClick(b.id)} className={`fu d${i + 1}`} style={{
                display: "flex", alignItems: "center", padding: "13px 14px",
                background: isDone ? C.successLight : C.warm,
                border: "none", borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left" as const, transition: "all 0.2s",
              }}>
                <div style={{ marginRight: 12, opacity: isDone ? 0.5 : 0.8 }}>{b.icon(18)}</div>
                <span style={{ flex: 1, fontFamily: ss, fontSize: 14, fontWeight: 600, color: C.primary }}>{b.label}</span>
                {b.time && !isDone && <span style={{ fontFamily: ss, fontSize: 11, color: C.textMuted, marginRight: 6 }}>{b.time}</span>}
                {isDone ? Icons.childCheck(20) : Icons.chev(14)}
              </button>
            );
          })}
        </div>
        {allDone && (
          <div className="si" style={{ marginTop: 16, padding: 14, background: `linear-gradient(135deg, ${C.primary}, #2C3E6B)`, borderRadius: 10, textAlign: "center" }}>
            <p style={{ fontFamily: sf, fontSize: 17, fontWeight: 500, color: "white", margin: "0 0 3px" }}>Devocional Completo!</p>
            <p style={{ fontFamily: ss, fontSize: 12, color: "rgba(255,255,255,0.6)", margin: 0 }}>Seu momento com Deus hoje está feito.</p>
          </div>
        )}
      </div>

      {/* CARD 2: Sua Caminhada */}
      <div className="fu d3" style={{ margin: "0 16px 12px", background: C.card, borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ fontFamily: ss, fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>Sua Caminhada</p>
          <button style={{ background: "none", border: "none", cursor: "pointer", fontFamily: ss, fontSize: 11, fontWeight: 600, color: C.accent, padding: 0 }}>Ver tudo →</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <div style={{ flex: 1, background: C.warm, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 3 }}>
              {Icons.parentCheckMini(17)}
              <span style={{ fontFamily: ss, fontSize: 18, fontWeight: 700, color: C.primary }}>{streaks.current_streak}</span>
            </div>
            <p style={{ fontFamily: ss, fontSize: 10, color: C.textMuted, margin: 0, fontWeight: 500 }}>Sequência</p>
          </div>
          <div style={{ flex: 1, background: C.warm, borderRadius: 10, padding: "12px 8px", textAlign: "center" }}>
            <span style={{ fontFamily: ss, fontSize: 18, fontWeight: 700, color: C.accent, display: "block", marginBottom: 3 }}>{streaks.longest_streak}</span>
            <p style={{ fontFamily: ss, fontSize: 10, color: C.textMuted, margin: 0, fontWeight: 500 }}>Maior Sequência</p>
          </div>
          <div style={{ flex: 1, background: C.warm, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
            <span style={{ fontSize: 26, display: "block", marginBottom: 2 }}>🙏</span>
            <span style={{ fontFamily: ss, fontSize: 14, fontWeight: 700, color: C.primary, display: "block" }}>{streaks.total_days_with_god}</span>
            <p style={{ fontFamily: ss, fontSize: 10, color: C.textMuted, margin: "2px 0 0", fontWeight: 500 }}>Dias com Deus</p>
          </div>
        </div>
        <Dots n={streaks.total_days_with_god} total={10} s={16} />
        <p style={{ fontFamily: ss, fontSize: 11, color: C.textMuted, textAlign: "center", margin: "8px 0 0" }}>
          Complete 10 dias para ganhar um 🏆 · Troféus: {streaks.trophies}
        </p>
      </div>

      {/* CARD 3: Mais para Você */}
      <div className="fu d5" style={{ margin: "0 16px 12px", background: C.card, borderRadius: 16, padding: 18, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
        <p style={{ fontFamily: ss, fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: 2, textTransform: "uppercase", margin: "0 0 12px" }}>Mais para Você</p>
        <button style={{ display: "flex", alignItems: "center", padding: "12px 14px", background: C.warm, border: "none", borderRadius: 10, cursor: "pointer", width: "100%", marginBottom: 8, textAlign: "left" as const }}>
          {Icons.whatsapp(18)}
          <span style={{ flex: 1, fontFamily: ss, fontSize: 13, fontWeight: 600, color: C.primary, marginLeft: 12 }}>Devocional no WhatsApp</span>
          {Icons.chev(14)}
        </button>
        <button style={{ display: "flex", alignItems: "center", padding: "12px 14px", background: C.warm, border: "none", borderRadius: 10, cursor: "pointer", width: "100%", textAlign: "left" as const }}>
          {Icons.users(16)}
          <span style={{ flex: 1, fontFamily: ss, fontSize: 13, fontWeight: 600, color: C.primary, marginLeft: 12 }}>Leve a Palavra a um Amigo</span>
          {Icons.chev(14)}
        </button>
        <button style={{ display: "flex", alignItems: "center", padding: "12px 14px", background: C.warm, border: "none", borderRadius: 10, cursor: "pointer", width: "100%", marginTop: 8, textAlign: "left" as const }}>
          <span style={{ fontSize: 16 }}>⭐</span>
          <span style={{ flex: 1, fontFamily: ss, fontSize: 13, fontWeight: 600, color: C.primary, marginLeft: 12 }}>A Agapefy te abençoou? Conte pra gente</span>
          {Icons.chev(14)}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────
export default function HojePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [devotional, setDevotional] = useState<FullDevotional>(FALLBACK_DEVOTIONAL);
  const [loading, setLoading] = useState(true);
  const [showCitation, setShowCitation] = useState(true);
  const [liked, setLiked] = useState(false);
  const [fav, setFav] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [streaks, setStreaks] = useState<UserStreaks>({
    current_streak: 0, longest_streak: 0, total_days_with_god: 0, trophies: 0,
  });
  const [screen, setScreen] = useState<string>("home");

  // Fetch today's devotional + user progress + streaks
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const today = new Date().toISOString().split("T")[0];

        // 1. Fetch devotional
        const { data: dev } = await supabase
          .from("devotionals")
          .select("*")
          .eq("date", today)
          .single();

        if (dev) {
          setDevotional({
            ...dev,
            passage_verses: typeof dev.passage_verses === "string"
              ? JSON.parse(dev.passage_verses)
              : dev.passage_verses || [],
          });
        }

        // 2. Fetch user progress (if logged in)
        if (user && dev) {
          const { data: progress } = await supabase
            .from("user_devotional_progress")
            .select("block_type")
            .eq("user_id", user.id)
            .eq("devotional_id", dev.id);

          if (progress) {
            setDone(new Set(progress.map((p: { block_type: string }) => p.block_type)));
          }
        }

        // 3. Fetch streaks (if logged in)
        if (user) {
          const { data: streakData } = await supabase
            .from("user_streaks")
            .select("*")
            .eq("user_id", user.id)
            .single();

          if (streakData) {
            setStreaks(streakData);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar dados:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [user]);

  // Check if citation was already seen today
  useEffect(() => {
    if (typeof window !== "undefined") {
      const today = new Date().toISOString().split("T")[0];
      const seen = localStorage.getItem(`agapefy_citation_seen_${today}`);
      if (seen === "true") setShowCitation(false);
    }
  }, []);

  const handleStartDevotional = useCallback(() => {
    if (typeof window !== "undefined") {
      const today = new Date().toISOString().split("T")[0];
      localStorage.setItem(`agapefy_citation_seen_${today}`, "true");
    }
    setShowCitation(false);
  }, []);

  const handleShare = useCallback(() => {
    if (!user) { router.push("/login"); return; }
    if (navigator.share) {
      navigator.share({
        title: "Agapefy - Palavra do Dia",
        text: `"${devotional.citation_text}" — ${devotional.citation_reference}\n\nAgapefy - Seu devocional diário`,
        url: "https://www.agapefy.com",
      }).catch(() => {});
    }
  }, [user, router, devotional]);

  const handleToggleLike = useCallback(() => {
    if (!user) { router.push("/login"); return; }
    setLiked(!liked);
  }, [user, router, liked]);

  const handleBlockClick = useCallback((blockId: string) => {
    if (!user) { router.push("/login"); return; }
    // Fase 4: navigate to block detail screens
    // For now, mark as complete (temporary behavior)
    setDone(prev => new Set([...prev, blockId]));
  }, [user, router]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: C.primary }}>
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // Citation fullscreen
  if (showCitation) {
    return (
      <>
        <style>{animationStyles}</style>
        <CitationScreen data={devotional} liked={liked} onToggleLike={handleToggleLike} onShare={handleShare} onStart={handleStartDevotional} />
      </>
    );
  }

  // Devotional Home
  return (
    <>
      <style>{animationStyles}</style>
      <DevotionalHome data={devotional} done={done} streaks={streaks} fav={fav} setFav={setFav} onBlockClick={handleBlockClick} />
    </>
  );
}
