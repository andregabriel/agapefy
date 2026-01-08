# LLM Guide (Agapefy)

Objetivo: contexto rapido para LLMs e devs. Se houver conflito, `DEV_RULES.md` e `AI_RULES.md` ou o codigo sao a fonte da verdade.

## Ordem de leitura recomendada
1. `AGENTS.md`
2. `DEV_RULES.md`
3. `AI_RULES.md`
4. `docs/ARCHITECTURE.md`
5. `docs/DB_SCHEMA_QUICK_MAP.md`
6. `docs/ROUTES_INDEX.md`
7. `docs/features.md`
8. `WHATSAPP_SETUP.md` (se tocar WhatsApp)
9. `Funcionalidades desativadas.md` (flags)
10. `IMPLEMENTATION_SUMMARY.md` e `MIGRATION_INSTRUCTIONS.md` (mudancas recentes)

## Fluxos sensiveis (nao alterar sem aprovacao)
- Onboarding: `src/app/AppShell.tsx`, `src/app/onboarding`, `src/app/api/onboarding/*`
- Auth/Admin: `src/contexts/AuthContext.tsx`, `middleware.ts`, `src/app/admin/*`
- Player de audio: `src/contexts/PlayerContext.tsx`, `src/app/player/*`, `src/components/player/*`
- WhatsApp: `src/app/whatsapp`, `src/app/api/whatsapp/*`, `supabase/functions/whatsapp-webhook`, `WHATSAPP_SETUP.md`
- Paywall/assinaturas: `src/components/modals/PaywallModal.tsx`, `src/lib/subscription/*`, `src/app/admin/paywall/page.tsx`, `WEBHOOK_ASSINATURAS.md`

## Onde encontrar coisas
- Contextos e estado global: `src/contexts`
- Integracoes Supabase: `src/lib/supabase.ts`, `src/lib/supabase-admin.ts`, `src/lib/supabase-queries.ts`
- API Routes (server): `src/app/api/*`
- Edge Functions: `supabase/functions/*`
- Migrations SQL: `supabase/sql/*`
- UI base: `src/components/ui/*`

## Checklist rapido para mudancas
- Identificar o fluxo impactado e os arquivos envolvidos
- Seguir `DEV_RULES.md` (planejamento, aprovacao, nao mexer em UX/UI sem OK)
- Se tocar onboarding/admin/player/whatsapp, testar o fluxo completo
- Atualizar docs e/ou `AGENTS.md` se mudar fluxo critico, estrutura, scripts ou integracoes
