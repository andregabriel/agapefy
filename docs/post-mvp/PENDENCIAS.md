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
