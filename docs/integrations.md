# Integracoes externas

Objetivo: documentar toda integracao externa (tags, webhooks, SDKs, APIs, analytics, pagamentos, mensageria).
Se houver conflito com codigo, DEV_RULES.md ou AI_RULES.md, eles sao fonte da verdade.

## Quando atualizar
- Nova integracao ou webhook
- Mudanca de credencial/endpoint/eventos
- Mudanca de fluxo sensivel (onboarding, auth/admin, player, WhatsApp)

## Checklist rapido
- Nome, tipo e fornecedor
- Fluxo/feature impactada
- Dados enviados/recebidos (PII?)
- Eventos, webhooks e payloads (com exemplos)
- Variaveis de ambiente
- Rotas/arquivos relevantes
- Dono/responsavel e links de setup
- Como testar e rollback

## Registro (ativo)
| Nome | Tipo | Fluxo/uso | Rotas/arquivos | Env vars | Docs |
| --- | --- | --- | --- | --- | --- |
| Supabase | Auth/DB/Storage/Edge | backend core | `src/lib/supabase.ts`, `src/lib/supabase-admin.ts`, `supabase/functions/*` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | supabase.com/docs |
| Z-API WhatsApp | API + Webhooks | WhatsApp + cron | `src/app/api/whatsapp/*`, `src/app/api/webhook/whatsapp/*`, `supabase/functions/*` | `ZAPI_INSTANCE_NAME`, `ZAPI_TOKEN`, `ZAPI_CLIENT_TOKEN` | `WHATSAPP_SETUP.md` |
| Hotjar | Tag/Analytics | comportamento/heatmaps | `src/components/TrackingScripts.tsx` | `NEXT_PUBLIC_HOTJAR_ID`, `NEXT_PUBLIC_TRACKING_ENABLED` | hotjar.com/help |
| OpenAI | API | IA (texto, intents, geracao) | `src/app/api/*`, `supabase/functions/*` | `OPENAI_API_KEY` | `GUIA_TESTE_ASSISTENTES.md` |
| ElevenLabs | API | geracao de audio | `src/app/api/generate-audio/route.ts`, `supabase/functions/generate-audio.ts` | `ELEVENLABS_API_KEY` | `README.md` |
| DMG (Digital Manager Guru) | Webhook inbound | assinaturas | `src/app/api/webhook/subscription/route.ts` | `DMG_API_TOKEN` | `WEBHOOK_ASSINATURAS.md` |

## Planejadas / opt-in
- Outras vars do `env.template`: `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `UPLOADTHING_SECRET`, `NEXT_PUBLIC_VERCEL_ANALYTICS_ID` (incluir aqui quando ativar).

## Template de entrada
Nome:
Tipo:
Fornecedor:
Fluxo/feature:
Dados:
Eventos/Webhooks:
Rotas/arquivos:
Env vars:
Docs:
Teste/monitoramento:
Rollback:
