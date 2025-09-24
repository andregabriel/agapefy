import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

type Role = "user" | "assistant";
type HistoryItem = { role: Role; content: string };

export async function POST(req: NextRequest) {
  try {
    const { message, threadId } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json({ ok: false, error: "Mensagem vazia" }, { status: 400 });
    }

    const assistantId = process.env.BIBLICUS_ASSISTANT_ID;
    if (!assistantId) {
      return NextResponse.json({ ok: false, error: "BIBLICUS_ASSISTANT_ID ausente no ambiente" }, { status: 500 });
    }

    const thread = threadId ? { id: threadId as string } : await client.beta.threads.create();

    await client.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    const run = await client.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
      temperature: 0.2,
      top_p: 1.0,
      response_format: { type: "text" },
    });

    const started = Date.now();
    /* eslint no-constant-condition: 0 */
    while (true) {
      const r = await client.beta.threads.runs.retrieve(thread.id, run.id);
      if (r.status === "completed") break;
      if (r.status === "failed" || r.status === "expired" || r.status === "cancelled") {
        throw new Error("Run failed");
      }
      // mantém o intervalo atual de polling sem alterar UX
      await new Promise((res) => setTimeout(res, 800));
    }

    // Buscar apenas a última mensagem do assistente para reduzir latência e payload
    const list = await client.beta.threads.messages.list(thread.id, { order: "desc", limit: 1 });
    const last = list.data[0];
    const reply = last && Array.isArray(last.content) && last.content[0]?.type === "text"
      ? (last.content[0] as any).text.value
      : "";

    return NextResponse.json({ ok: true, threadId: thread.id, reply });
  } catch (e: any) {
    const message = typeof e?.message === "string" ? e.message : "Erro inesperado";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}


