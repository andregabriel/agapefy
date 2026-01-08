# AGENTS.md - Guia Rapido para IA/Devs

Objetivo: dar contexto suficiente para programar sem quebrar fluxos. Mantenha curto e aponte para docs detalhados.
Se houver conflito entre este arquivo e o codigo, DEV_RULES.md ou AI_RULES.md, esses sao a fonte da verdade.

## Visao geral
- App Next.js (App Router) com TypeScript, Tailwind e Shadcn/UI.
- Backend principal via Supabase (Auth, DB, Storage, Edge Functions).
- Fluxos sensiveis: onboarding, auth/admin, player de audio e WhatsApp.

## Stack e padroes (resumo)
- UI: componentes em `src/components/ui` (Shadcn) como primeira escolha.
- Estilo: Tailwind. Evitar CSS-in-JS.
- Estado: hooks e Context API em `src/contexts`.
- Forms: react-hook-form + zod.
- Icons: lucide-react.
- Toaster: Sonner.
- Charts: Recharts.

## Estrutura do projeto
- App Router: `src/app`.
- Providers globais e gate de onboarding: `src/app/AppShell.tsx`.
- Middleware de admin: `middleware.ts`.
- Supabase client: `src/lib/supabase.ts`.
- Supabase admin client (service role): `src/lib/supabase-admin.ts`.
- Rotas API: `src/app/api/*`.
- Edge Functions: `supabase/functions/*`.
- Migrations SQL: `supabase/sql/*`.
- Testes e2e: `tests/onboarding-whatsapp.spec.ts`.

## Variaveis de ambiente (principais)
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- IA/Audio (se usar): `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`.
- WhatsApp Z-API: `ZAPI_INSTANCE_NAME`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN`.
- Outras: ver `env.template`.

## Scripts e testes
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- Typecheck: `npm run type-check`
- Unit: `npm run test` (vitest)
- Jest: `npm run test:jest`
- E2E: `npm run test:e2e`

## Regras nao negociaveis
- Leia e siga `DEV_RULES.md` antes de qualquer mudanca de funcionalidade.
- Leia e siga `AI_RULES.md` para padroes de stack e organizacao.

## Docs importantes (fonte de verdade por tema)
- Regras de dev: `DEV_RULES.md`
- Padroes de stack: `AI_RULES.md`
- Guia para LLMs: `docs/LLM_GUIDE.md`
- Arquitetura: `docs/ARCHITECTURE.md`
- DB/schema (quick map): `docs/DB_SCHEMA_QUICK_MAP.md`
- Rotas (index): `docs/ROUTES_INDEX.md`
- Features mapeadas: `docs/features.md`
- Integracoes externas (tags/webhooks): `docs/integrations.md`
- WhatsApp setup: `WHATSAPP_SETUP.md`
- Cron do desafio WhatsApp (checklist): `docs/WHATSAPP_CHALLENGE_CRON_CHECKLIST.md`
- Teste de assistentes: `GUIA_TESTE_ASSISTENTES.md`
- Assinaturas (webhook): `WEBHOOK_ASSINATURAS.md`
- Migracoes/implementacoes recentes: `IMPLEMENTATION_SUMMARY.md` e `MIGRATION_INSTRUCTIONS.md`
- Features desativadas/flags: `Funcionalidades desativadas.md`
- Pendencias pos-MVP: `docs/pendencias-pos-mvp.md`

## Checklist de mudanca (resumo)
- Identificar fluxo impactado e arquivos envolvidos.
- Evitar alterar UX/UI/fluxos existentes sem aprovacao.
- Se tocar onboarding, admin, player ou WhatsApp, testar fluxo completo.

## Manutencao do AGENTS
- Atualizar quando:
  - Mudar fluxo critico (onboarding, auth/admin, player, WhatsApp).
  - Adicionar/remover integracoes externas.
  - Alterar estrutura de pastas, scripts ou regras.
- Em duvida, referenciar o doc maior em vez de duplicar.
