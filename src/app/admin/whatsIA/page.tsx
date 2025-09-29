"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { Plus, Pencil, Trash2, CheckCircle2, XCircle, Save, Wand2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useAppSettings } from "@/hooks/useAppSettings";

type BehaviorType =
  | "reply_text"
  | "reply_bible_answer"
  | "reply_prayer"
  | "toggle_daily_verse"
  | "toggle_prayer_reminders"
  | "custom";

interface BWCommand {
  id: string;
  command: string; // e.g. /conversa, /versículos
  description: string | null;
  behavior_type: BehaviorType;
  behavior_payload: any | null; // JSON payload depending on type
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function WhatsAppIAPage() {
  const { settings, loading: settingsLoading, updateSetting } = useAppSettings();
  const [commands, setCommands] = useState<BWCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<BWCommand | null>(null);
  const [welcome, setWelcome] = useState("");
  const [intentsConfig, setIntentsConfig] = useState<Record<string, { enabled: boolean; prompt?: string }>>({});
  const [shortCommands, setShortCommands] = useState<Record<string, string[]>>({});
  const [newIntentName, setNewIntentName] = useState("");

  const emptyDraft: Partial<BWCommand> = useMemo(
    () => ({ command: "", description: "", behavior_type: "reply_text", behavior_payload: { text: "" }, is_active: true }),
    []
  );
  const [draft, setDraft] = useState<Partial<BWCommand>>(emptyDraft);

  function getDefaultPromptForIntent(key: string): string {
    const prompts: Record<string, string> = {
      greeting: `Você é Agape, um assistente espiritual cristão carinhoso. O usuário está cumprimentando você. Responda de forma calorosa e acolhedora, perguntando como ele está.`,
      prayer_request: `Você é Agape, um assistente espiritual cristão. O usuário precisa de oração. Crie uma oração personalizada e reconfortante para a situação dele. Use linguagem acolhedora.`,
      bible_question: `Você é Agape, especialista da Bíblia. Responda perguntas bíblicas com conhecimento teológico e referências bíblicas. Seja didático e acessível.`,
      spiritual_guidance: `Você é Agape, conselheiro espiritual cristão. Ofereça orientação baseada nos ensinamentos bíblicos com empatia e sabedoria.`,
      general_conversation: `Você é Agape, companheiro espiritual cristão inteligente e carinhoso. Responda naturalmente com empatia e sabedoria cristã.`,
      daily_verse: ''
    };
    return prompts[key] ?? prompts.general_conversation;
  }

  useEffect(() => {
    loadCommands();
  }, []);

  useEffect(() => {
    setWelcome(settings.whatsapp_welcome_message || "");
    // Parse intents config
    try {
      const parsed = settings.bw_intents_config ? JSON.parse(settings.bw_intents_config) : {};
      setIntentsConfig(parsed || {});
    } catch {
      setIntentsConfig({});
    }
    try {
      const scParsed = settings.bw_short_commands ? JSON.parse(settings.bw_short_commands) : {};
      setShortCommands(scParsed || {});
    } catch {
      setShortCommands({});
    }
  }, [settings.whatsapp_welcome_message, settings.bw_intents_config, settings.bw_short_commands]);

  async function saveWelcome() {
    try {
      const value = welcome?.trim() || "";
      const res = await updateSetting("whatsapp_welcome_message", value);
      if (res.success) {
        toast.success("Mensagem inicial atualizada");
      } else {
        toast.error(res.error || "Falha ao salvar mensagem inicial");
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e);
      toast.error("Erro ao salvar mensagem inicial");
    }
  }

  async function saveIntents() {
    try {
      const value = JSON.stringify(intentsConfig ?? {});
      const res = await updateSetting("bw_intents_config", value);
      if (res.success) {
        toast.success("Comportamentos por intenção atualizados");
      } else {
        toast.error(res.error || "Falha ao salvar comportamentos");
      }
    } catch (e) {
      console.warn(e);
      toast.error("Erro ao salvar comportamentos");
    }
  }

  async function saveShortCommands() {
    try {
      const value = JSON.stringify(shortCommands ?? {});
      const res = await updateSetting("bw_short_commands", value);
      if (res.success) {
        toast.success("Comandos curtos atualizados");
      } else {
        toast.error(res.error || "Falha ao salvar comandos curtos");
      }
    } catch (e) {
      console.warn(e);
      toast.error("Erro ao salvar comandos curtos");
    }
  }

  function normalizeIntentName(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  function handleAddIntent() {
    const key = normalizeIntentName(newIntentName);
    if (!key) {
      toast.error("Informe um nome válido para a intenção");
      return;
    }
    if (intentsConfig[key]) {
      toast.error("Esta intenção já existe");
      return;
    }
    setIntentsConfig((prev) => ({ ...prev, [key]: { enabled: true } }));
    setShortCommands((prev) => ({ ...prev, [key]: [] }));
    setNewIntentName("");
  }

  function handleRemoveIntent(key: string) {
    if (!confirm("Tem certeza que deseja remover esta intenção?")) return;
    setIntentsConfig((prev) => {
      const { [key]: _omit, ...rest } = prev as any;
      return rest as typeof prev;
    });
    setShortCommands((prev) => {
      const { [key]: _omit, ...rest } = prev as any;
      return rest as typeof prev;
    });
  }

  async function loadCommands() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_ai_commands")
        .select("id, command, description, behavior_type, behavior_payload, is_active, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCommands((data as BWCommand[]) || []);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e);
      toast.error("Erro ao carregar comandos da IA");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditing(null);
    setDraft(emptyDraft);
  }

  async function saveCommand() {
    if (!draft.command || !draft.behavior_type) {
      toast.error("Preencha comando e tipo de comportamento");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        command: draft.command?.trim(),
        description: (draft.description || "").trim(),
        behavior_type: draft.behavior_type,
        behavior_payload: draft.behavior_payload ?? null,
        is_active: draft.is_active ?? true,
        updated_at: new Date().toISOString()
      } as any;

      if (editing) {
        const { error } = await supabase
          .from("whatsapp_ai_commands")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Comando atualizado");
      } else {
        const { error } = await supabase
          .from("whatsapp_ai_commands")
          .insert([{ ...payload, created_at: new Date().toISOString() }]);
        if (error) throw error;
        toast.success("Comando criado");
      }

      await loadCommands();
      resetForm();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e);
      toast.error("Não foi possível salvar");
    } finally {
      setSaving(false);
    }
  }

  async function editCommand(cmd: BWCommand) {
    setEditing(cmd);
    setDraft({ ...cmd });
  }

  async function deleteCommand(id: string) {
    if (!confirm("Tem certeza que deseja remover este comando?")) return;
    try {
      const { error } = await supabase.from("whatsapp_ai_commands").delete().eq("id", id);
      if (error) throw error;
      toast.success("Comando removido");
      await loadCommands();
      if (editing?.id === id) resetForm();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(e);
      toast.error("Não foi possível remover");
    }
  }

  function behaviorFields() {
    const type = draft.behavior_type as BehaviorType;
    if (type === "reply_text") {
      return (
        <div className="space-y-2">
          <Label>Texto da resposta</Label>
          <Textarea
            value={draft.behavior_payload?.text || ""}
            onChange={(e) => setDraft((d) => ({ ...d, behavior_payload: { ...(d.behavior_payload || {}), text: e.target.value } }))}
            placeholder="Mensagem de resposta que o BW enviará ao receber este comando"
          />
        </div>
      );
    }
    if (type === "reply_bible_answer") {
      return (
        <div className="space-y-2">
          <Label>Instruções para resposta bíblica (opcional)</Label>
          <Textarea
            value={draft.behavior_payload?.instructions || ""}
            onChange={(e) => setDraft((d) => ({ ...d, behavior_payload: { ...(d.behavior_payload || {}), instructions: e.target.value } }))}
            placeholder="Ex.: Foque em conforto, inclua referência bíblica e aplicação prática"
          />
        </div>
      );
    }
    if (type === "reply_prayer") {
      return (
        <div className="space-y-2">
          <Label>Instruções para oração (opcional)</Label>
          <Textarea
            value={draft.behavior_payload?.instructions || ""}
            onChange={(e) => setDraft((d) => ({ ...d, behavior_payload: { ...(d.behavior_payload || {}), instructions: e.target.value } }))}
            placeholder="Ex.: Oração breve, tom acolhedor, inclua um versículo"
          />
        </div>
      );
    }
    if (type === "toggle_daily_verse") {
      return (
        <div className="space-y-2">
          <Label>Ação</Label>
          <Select
            value={draft.behavior_payload?.action || "enable"}
            onValueChange={(v) => setDraft((d) => ({ ...d, behavior_payload: { action: v } }))}
          >
            <SelectTrigger><SelectValue placeholder="Escolha ação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="enable">Ativar versículo diário</SelectItem>
              <SelectItem value="disable">Desativar versículo diário</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (type === "toggle_prayer_reminders") {
      return (
        <div className="space-y-2">
          <Label>Ação</Label>
          <Select
            value={draft.behavior_payload?.action || "enable"}
            onValueChange={(v) => setDraft((d) => ({ ...d, behavior_payload: { action: v } }))}
          >
            <SelectTrigger><SelectValue placeholder="Escolha ação" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="enable">Ativar lembretes de oração</SelectItem>
              <SelectItem value="disable">Desativar lembretes de oração</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }
    if (type === "custom") {
      return (
        <div className="space-y-2">
          <Label>Payload JSON</Label>
          <Textarea
            value={JSON.stringify(draft.behavior_payload ?? {}, null, 2)}
            onChange={(e) => {
              try {
                const val = JSON.parse(e.target.value || "{}");
                setDraft((d) => ({ ...d, behavior_payload: val }));
              } catch {
                // ignore invalid JSON typing
              }
            }}
            placeholder='{"foo":"bar"}'
          />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>🤖</span>
        <div>
          <h1 className="text-xl font-semibold">Biblicus WhatsApp (BW) — Comandos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os comandos que o BW entende e o comportamento para cada um.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mensagem inicial (boas-vindas)</CardTitle>
          <CardDescription>Texto enviado ao usuário quando ele inicia a conversa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            placeholder="Escreva a mensagem inicial enviada pelo BW"
            className="min-h-[180px]"
          />
          <div className="flex items-center gap-3">
            <Button onClick={saveWelcome} disabled={settingsLoading}>
              <Save className="h-4 w-4 mr-2" /> Salvar mensagem
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comportamento por intenção</CardTitle>
          <CardDescription>Ative/desative intenções, personalize prompts e defina atalhos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(intentsConfig).length === 0 && (
            <div className="text-sm text-muted-foreground">Nenhuma configuração encontrada. Usando padrões do sistema.</div>
          )}
          <div className="flex items-center gap-2">
            <Input
              placeholder="Nova intenção (ex.: gratitude)"
              value={newIntentName}
              onChange={(e) => setNewIntentName(e.target.value)}
            />
            <Button variant="secondary" onClick={handleAddIntent} disabled={!newIntentName.trim()}>
              <Plus className="h-4 w-4 mr-2" /> Adicionar intenção
            </Button>
          </div>
          <div className="space-y-3">
            {Object.entries(intentsConfig).map(([key, cfg]) => (
              <div key={key} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{key}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Ativo</span>
                    <Switch
                      checked={!!cfg.enabled}
                      onCheckedChange={(v) => setIntentsConfig((prev) => ({ ...prev, [key]: { ...prev[key], enabled: !!v } }))}
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveIntent(key)} title="Remover intenção">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Prompt (opcional)</Label>
                  <Textarea
                    value={cfg.prompt || ""}
                    onChange={(e) => setIntentsConfig((prev) => ({ ...prev, [key]: { ...prev[key], prompt: e.target.value } }))}
                    placeholder="Substitui o prompt padrão desta intenção"
                  />
                  <p className="text-xs text-muted-foreground">Deixe em branco para usar o prompt padrão.</p>
                </div>
                <div className="space-y-2">
                  <Label>Comandos curtos (atalhos)</Label>
                  <Input
                    value={(shortCommands[key] || []).join(', ')}
                    onChange={(e) => {
                      const items = e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      setShortCommands((prev) => ({ ...prev, [key]: items }));
                    }}
                    placeholder="Ex.: /versiculo, versículo do dia"
                  />
                  <p className="text-xs text-muted-foreground">Para persistir, use "Salvar comandos curtos" abaixo.</p>
                </div>
                <div className="space-y-2">
                  <Label>Prompt padrão vigente (somente leitura)</Label>
                  <Textarea
                    value={getDefaultPromptForIntent(key)}
                    readOnly
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={saveIntents} disabled={settingsLoading}>
              <Save className="h-4 w-4 mr-2" /> Salvar comportamentos
            </Button>
            <Button onClick={saveShortCommands} variant="outline" disabled={settingsLoading}>
              <Save className="h-4 w-4 mr-2" /> Salvar comandos curtos
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}


