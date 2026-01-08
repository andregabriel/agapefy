# Arquitetura do sistema (Agapefy)

Este documento descreve o mapa de alto nivel do sistema. Se houver conflito, `DEV_RULES.md`, `AI_RULES.md` e o codigo sao a fonte da verdade.

## Visao geral
- Next.js App Router (React/TypeScript) com Tailwind + Shadcn/UI.
- Supabase como backend principal: Auth, Postgres, Storage e Edge Functions.
- Integracoes externas: OpenAI, ElevenLabs, Z-API (WhatsApp) e Digital Manager Guru (assinaturas).

## Camadas e limites

### Frontend (App Router)
- Rotas e paginas: `src/app/*`
- Shell e providers globais: `src/app/AppShell.tsx`
- Estado global: `src/contexts/*`
- Componentes: `src/components/*` e `src/components/ui/*`

### Backend (Route Handlers)
- APIs server-side: `src/app/api/*`
- Cron/Jobs HTTP: `src/app/api/cron*`
- Webhooks: `src/app/api/webhook/*`

### Edge Functions
- Funcoes Supabase: `supabase/functions/*` (ex: `whatsapp-webhook`, `daily-verse-sender`)

### Dados
- Supabase Postgres + Storage (bucket `audios`).
- Migrations e ajustes: `supabase/sql/*`

## Fluxos criticos

### Auth/Admin
- `middleware.ts` protege `/admin/*` e `/onboarding/*`.
- `src/contexts/AuthContext.tsx` centraliza sessao e usuario.

### Onboarding
- Gate principal em `src/app/AppShell.tsx`.
- UI e fluxo em `src/app/onboarding/*`.
- Status e passos via `src/app/api/onboarding/*`.

### Player de audio
- Estado e fila em `src/contexts/PlayerContext.tsx`.
- UI de player em `src/app/player/*` e `src/components/player/*`.
- Audios via Supabase Storage (ver `IMPLEMENTATION_SUMMARY.md`).

### WhatsApp
- Setup e operacao: `WHATSAPP_SETUP.md`.
- Webhook principal: `supabase/functions/whatsapp-webhook`.
- Rotas auxiliares e crons: `src/app/api/whatsapp/*`, `src/app/api/cron-*`.

### Assinaturas
- Webhook de assinaturas: `/api/webhook/subscription`.
- Doc de referencia: `WEBHOOK_ASSINATURAS.md`.

## Regras operacionais
- Service role apenas no server (`src/lib/supabase-admin.ts`).
- Debug logs controlados por `DEBUG_LOGS` ou `NEXT_PUBLIC_DEBUG_LOGS`.
- Mudancas em onboarding/admin/player/whatsapp exigem teste completo do fluxo.

## Onde documentar novas mudancas
- Atualizar `AGENTS.md` se mudar fluxo critico, estrutura, scripts ou integracoes.
- Atualizar `docs/features.md` se adicionar/remover features.
- Atualizar `Funcionalidades desativadas.md` se criar/desativar flags.
