# Agapefy

Aplicativo de oracoes guiadas e crescimento espiritual, com Next.js (App Router), Supabase e integracao com WhatsApp.

## Docs principais
- `AGENTS.md` (entrada rapida para IA/Devs)
- `DEV_RULES.md` (processo nao negociavel)
- `AI_RULES.md` (stack e padroes)
- `docs/LLM_GUIDE.md` (fluxo seguro para LLMs)
- `docs/ARCHITECTURE.md` (mapa do sistema)
- `docs/features.md` (features mapeadas)
- `WHATSAPP_SETUP.md` (setup e fluxos WhatsApp)
- `WEBHOOK_ASSINATURAS.md` (assinaturas)
- `Funcionalidades desativadas.md` (flags e features off)
- `docs/post-mvp/PENDENCIAS.md` (backlog pos-MVP)

## Stack
- Next.js (App Router), React, TypeScript
- Tailwind + Shadcn/UI
- Supabase (Auth, DB, Storage, Edge Functions)
- react-hook-form + zod, lucide-react, sonner, recharts

## Ambiente local
1. Copie `env.template` para `.env.local`
2. Preencha as variaveis necessarias
3. `npm install`
4. `npm run dev`

### Variaveis de ambiente (core)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Variaveis por feature
- IA/audio: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`
- WhatsApp: `ZAPI_INSTANCE_NAME`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`
- Cron e webhooks: `CRON_SECRET`, `DMG_API_TOKEN` (se usar)
- Demais: ver `env.template`

## Estrutura do projeto
- `src/app`: rotas (App Router) e APIs
- `src/components`: UI e features
- `src/contexts`: Auth, Player, Routine
- `src/lib`: supabase clients, services e utilitarios
- `supabase/functions`: Edge Functions
- `supabase/sql`: migracoes
- `tests`: testes e2e

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run type-check`
- `npm run test`
- `npm run test:jest`
- `npm run test:e2e`
