"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { translateErrorMessage } from "@/lib/utils";

type Role = "user" | "assistant";
type Msg = { role: Role; content: string; ts: number };

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 5) return "agora";
  if (sec < 60) return `há ${sec} s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}

function parseVerses(content: string) {
  const lines = content.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.trim().toLowerCase() === "versículos citados:".toLowerCase());
  if (idx === -1) {
    const none = content.includes("Nenhum versículo citado, pois a Bíblia não trata diretamente deste tema.");
    return { body: content, verses: null as string[] | null, none };
  }
  const before = lines.slice(0, idx).join("\n").trim();
  const after = lines.slice(idx + 1);
  const collected: string[] = [];
  for (const line of after) {
    if (!line.trim()) break;
    collected.push(line.trim());
  }
  const none = collected.some((l) => l.includes("Nenhum versículo citado, pois a Bíblia não trata diretamente deste tema."));
  return { body: before, verses: collected.length ? collected : null, none };
}

export default function Page() {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // CSS vars for predictable heights
  // Assumptions: --composer-h ~72px, --tabbar-h ~64px (see BottomNavigation)
  const cssVars = useMemo(
    () => ({ ["--composer-h" as any]: "72px", ["--tabbar-h" as any]: "64px" }) as CSSProperties,
    []
  );

  useEffect(() => {
    const t = localStorage.getItem("biblicus:threadId");
    if (t) setThreadId(t);
  }, []);

  useEffect(() => {
    viewRef.current?.scrollTo({ top: 999999, behavior: "smooth" });
  }, [messages, loading]);

  const suggestions = useMemo(
    () => [
      "Como interpretar a Bíblia corretamente?",
      "O que fazer quando estou com ansiedade?",
      "Como entender o livro de Apocalipse?",
      "Como perdoar alguém que me feriu?",
    ],
    []
  );

  const send = useCallback(
    async (msg: string) => {
      if (!msg.trim() || loading) return;
      setError(null);
      setLoading(true);
      const now = Date.now();
      setMessages((prev) => [...prev, { role: "user", content: msg, ts: now }]);
      setInput("");
      try {
        const res = await fetch("/api/biblicus/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, threadId }),
        });
        const data = await res.json();
        if (data?.ok) {
          if (!threadId && data.threadId) {
            setThreadId(data.threadId);
            localStorage.setItem("biblicus:threadId", data.threadId);
          }
          const reply: string = data?.reply ?? "";
          setMessages((prev) => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
        } else {
          const rawError = data?.error || "Erro ao comunicar com o Biblicus";
          const errMsg = translateErrorMessage(rawError);
          setMessages((prev) => [...prev, { role: "assistant", content: `[Erro] ${errMsg}`, ts: Date.now() }]);
          setError(errMsg);
        }
      } catch (e: any) {
        const rawError = e?.message || "Falha de rede";
        const errMsg = translateErrorMessage(rawError);
        setMessages((prev) => [...prev, { role: "assistant", content: `[Erro] ${errMsg}`, ts: Date.now() }]);
        setError(errMsg);
      } finally {
        setLoading(false);
        // re-foco no input
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [threadId, loading]
  );

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div
      className="max-w-screen-sm mx-auto min-h-[100dvh] flex flex-col bg-white text-zinc-900"
      style={cssVars}
    >
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
        <span className="text-2xl" aria-hidden>📖</span>
        <h1 className="text-lg font-semibold">Respostas baseadas na Bíblia</h1>
        <div className="ml-auto">
          <button
            className="text-sm text-zinc-500 hover:text-zinc-700"
            aria-haspopup="dialog"
            aria-label="Sobre"
            onClick={() => setShowRules(true)}
          >
            (i)
          </button>
        </div>
      </header>

      {/* Toast simples */}
      {error && (
        <div className="pointer-events-none fixed left-1/2 -translate-x-1/2 top-16 z-20 bg-red-500 text-white text-sm px-3 py-1.5 rounded">
          {error}
        </div>
      )}

      {/* Lista de mensagens */}
      <div
        ref={viewRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-[160px] scroll-smooth"
        style={{ paddingBottom: "calc(var(--composer-h,72px) + var(--tabbar-h,64px) + env(safe-area-inset-bottom))" }}
        aria-live="polite"
      >
        {messages.length === 0 && (
          <div className="text-center text-sm text-zinc-500 py-10 space-y-3">
            <p>O que você deseja perguntar?</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((q) => (
                <button
                  key={q}
                  className="px-3 py-1.5 rounded-full bg-zinc-100 hover:bg-zinc-200"
                  onClick={() => send(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const parsed = !isUser ? parseVerses(m.content) : null;
          return (
            <div key={i} className={`max-w-[85%] ${isUser ? "ml-auto text-white bg-zinc-800" : "mr-auto bg-zinc-100 text-zinc-900"} rounded-2xl px-4 py-2 whitespace-pre-wrap shadow-sm`}>
              <div>{isUser ? m.content : parsed?.body ?? m.content}</div>
              <div className="mt-1 text-[11px] opacity-60">{formatRelativeTime(m.ts)}</div>
              {!isUser && parsed?.verses && (
                <div className="mt-2">
                  <div className="text-sm">Versículos citados</div>
                  <div className="mt-1 text-sm space-y-1">
                    {parsed.verses.map((v, idx) => (
                      <div key={idx}>{v}</div>
                    ))}
                  </div>
                </div>
              )}
              {!isUser && parsed?.none && (
                <div className="mt-1 text-xs text-zinc-500">
                  Nenhum versículo citado, pois a Bíblia não trata diretamente deste tema.
                </div>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="mr-auto bg-zinc-100 text-zinc-900 rounded-2xl px-4 py-2">
            <div className="flex items-center gap-2">
              <span>Buscando a resposta na Bíblia, aguarde alguns segundos…</span>
              <span className="inline-flex items-center gap-1" aria-hidden>
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400/90 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400/90 animate-bounce" style={{ animationDelay: ".15s" }} />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400/90 animate-bounce" style={{ animationDelay: ".3s" }} />
              </span>
            </div>
          </div>
        )}
        {/* Spacer anti-sobreposição para não esconder conteúdo atrás do composer/bottom-nav */}
        <div
          aria-hidden
          className="pointer-events-none"
          style={{ height: "calc(var(--composer-h,72px) + var(--tabbar-h,64px) + env(safe-area-inset-bottom))" }}
        />
      </div>

      {/* Composer */}
      <form
        className="fixed left-1/2 -translate-x-1/2 w-full max-w-screen-sm z-50 bg-white border-t shadow-md p-3 flex gap-2 pb-[env(safe-area-inset-bottom)]"
        style={{ height: "var(--composer-h,72px)", bottom: "calc(var(--tabbar-h,64px))" }}
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="biblicus-input" className="sr-only">Pergunta</label>
        <textarea
          ref={inputRef}
          id="biblicus-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Digite sua pergunta…"
          className="flex-1 resize-none rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-300 h-10"
          aria-label="Digite sua pergunta"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-zinc-900 text-white disabled:opacity-50 min-w-20 flex items-center justify-center"
          aria-busy={loading}
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin" aria-hidden />
              Pensando...
            </span>
          ) : (
            "Enviar"
          )}
        </button>
      </form>

      {/* Dialog Regras */}
      {showRules && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
          onClick={() => setShowRules(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="relative z-10 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-lg p-4 mx-2 max-h-[85dvh] sm:max-h-[80vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📖</span>
              <h2 className="font-semibold">Sobre</h2>
            </div>
            <div className="text-sm text-zinc-700 space-y-2">
              <p>• As respostas são baseadas exclusivamente na Bíblia.</p>
              <p>• Os versículos que fundamentam cada resposta são sempre informados.</p>
              <p>• As respostas não substituem sua leitura pessoal nem a orientação de seu pastor.</p>
              <p>• As respostas podem cometer erros. Por isso, considere confirmar as informações apresentadas.</p>
              <p>
                • Caso identifique algo incorreto ou queira enviar sugestões, deixe seu feedback
                <a className="underline ml-1" href="mailto:feedback@agapefy.com">aqui</a>.
              </p>
            </div>
            <div className="mt-4 flex justify-end">
              <button className="px-3 py-1.5 rounded bg-zinc-900 text-white" onClick={() => setShowRules(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
