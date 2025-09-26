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

  const emptyDraft: Partial<BWCommand> = useMemo(
    () => ({ command: "", description: "", behavior_type: "reply_text", behavior_payload: { text: "" }, is_active: true }),
    []
  );
  const [draft, setDraft] = useState<Partial<BWCommand>>(emptyDraft);

  useEffect(() => {
    loadCommands();
  }, []);

  useEffect(() => {
    setWelcome(settings.whatsapp_welcome_message || "");
  }, [settings.whatsapp_welcome_message]);

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
          <CardTitle>Novo comando</CardTitle>
          <CardDescription>Crie ou edite um comando que o BW processará.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Comando</Label>
              <Input
                value={draft.command || ""}
                onChange={(e) => setDraft((d) => ({ ...d, command: e.target.value }))}
                placeholder="Ex.: /conversa, /versículos, /oração"
              />
              <p className="text-xs text-muted-foreground">Inclua a barra inicial. O BW fará match exato por prefixo.</p>
            </div>
            <div className="space-y-2">
              <Label>Tipo de comportamento</Label>
              <Select
                value={draft.behavior_type as string}
                onValueChange={(v) => setDraft((d) => ({ ...d, behavior_type: v as BehaviorType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reply_text">Responder com texto fixo</SelectItem>
                  <SelectItem value="reply_bible_answer">Responder com resposta bíblica (IA)</SelectItem>
                  <SelectItem value="reply_prayer">Responder com oração personalizada (IA)</SelectItem>
                  <SelectItem value="toggle_daily_verse">Ativar/Desativar versículo diário</SelectItem>
                  <SelectItem value="toggle_prayer_reminders">Ativar/Desativar lembretes de oração</SelectItem>
                  <SelectItem value="custom">Customizado (payload JSON)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={draft.description || ""}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="Descrição breve do propósito do comando"
            />
          </div>

          {behaviorFields()}

          <div className="flex items-center gap-3">
            <Button onClick={saveCommand} disabled={saving}>
              <Save className="h-4 w-4 mr-2" /> {editing ? "Salvar alterações" : "Criar comando"}
            </Button>
            {editing && (
              <Button variant="secondary" onClick={resetForm}>
                <XCircle className="h-4 w-4 mr-2" /> Cancelar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comandos cadastrados</CardTitle>
          <CardDescription>Gerencie comandos existentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {loading && <div className="text-sm text-muted-foreground">Carregando...</div>}
            {!loading && commands.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhum comando cadastrado ainda.</div>
            )}
            {!loading && commands.map((cmd) => (
              <div key={cmd.id} className="flex items-start justify-between gap-4 border rounded-md p-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{cmd.command}</Badge>
                    {cmd.is_active ? (
                      <span className="inline-flex items-center text-xs text-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Ativo</span>
                    ) : (
                      <span className="inline-flex items-center text-xs text-rose-500"><XCircle className="h-3 w-3 mr-1" /> Inativo</span>
                    )}
                  </div>
                  <div className="text-sm font-medium">{cmd.description || "Sem descrição"}</div>
                  <div className="text-xs text-muted-foreground">Tipo: {cmd.behavior_type}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => editCommand(cmd)}>
                    <Pencil className="h-4 w-4 mr-1" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => deleteCommand(cmd.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remover
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


