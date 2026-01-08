# Pendencias lançamento pos-MVP

Objetivo: registrar melhorias que nao bloqueiam o MVP.

## Como usar
- Adicione itens com contexto, impacto e prioridade (P0, P1, P2).
- Marque o status: TODO, DOING, DONE.

## Backlog inicial
- TODO [P2] Revisar uso de localStorage para WhatsApp; preferir Supabase para usuarios logados.
- TODO [P2] Implementar retry/flush para backups locais (pending_feedback, pending_nps, analytics_events).
- TODO [P3] Sincronizar "onboarding_seen" entre dispositivos, se necessario.
- TODO [P3] Persistir threadId do Biblicus no Supabase, se quiser continuidade multi-dispositivo.
- TODO [P1] Rate limiting em rotas sensiveis (/api/*, webhooks) para mitigar abuso e brute-force.
- TODO [P1] Assinaturas HMAC nos webhooks externos (WhatsApp/Z-API) e validacao obrigatoria no backend.
- TODO [P1] Revisar RLS de tabelas criticas (admin_forms, admin_form_responses, whatsapp_users, playlists privadas).
- TODO [P2] Auditar logs de admin/seguranca (acoes administrativas, webhooks falhos, tentativas invalidas).
- TODO [P2] Politica de rotacao de chaves e alertas (cron/webhook/admin API keys).
- TODO [P2] Ajustar search_path das funcoes update_updated_at_column, set_updated_at, update_free_play_limits_updated_at, preserve_cover_url, update_assinaturas_updated_at.
- TODO [P2] Revisar policies permissivas restantes (analytics_events, user_feedback, user_suggestions, notifications, daily_verse_log) e definir regras de escrita/limite.
- TODO [P2] Ativar leaked password protection no Supabase Auth.
- TODO [P2] Reduzir OTP expiry para menos de 1 hora no Supabase Auth.
- TODO [P1] Atualizar Postgres para versao com patches de seguranca.
- TODO [P2] Refatorar `docs/DB_SCHEMA_QUICK_MAP.md` com colunas-chave e FKs reais a partir do schema do Supabase.
- TODO [P3] Adicionar script no `package.json` para gerar `docs/ROUTES_INDEX.md` via `node scripts/generate-routes-index.mjs`.
