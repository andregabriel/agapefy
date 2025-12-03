# Funcionalidades desativadas

## Checklist de onboarding na home
- Status: desativada via flag `ONBOARDING_CHECKLIST_ENABLED = false`.
- Local desativação (frontend): `src/app/home/_components/OnboardingChecklist.tsx` — o componente é curto-circuitado, não faz fetch e não renderiza o card.
- O que fazia no frontend: buscava `/api/onboarding/checklist` com `x-user-id`, normalizava os oito passos e exibia no topo da home a lista de pendências com botão "Continuar" que levava para `/onboarding?step={n}`.
- O que faz no backend: a rota `src/app/api/onboarding/checklist/route.ts` monta a ordem dos passos a partir de `admin_forms` e `app_settings`, checa respostas em `admin_form_responses`, status do WhatsApp (`whatsapp_users`) e se a playlist "Minha Rotina" tem áudios (`playlists` + `playlist_audios`) para marcar cada passo como concluído ou pendente. A rota continua ativa para futura reativação.

## Versículo diário no WhatsApp
- Status: desativada. O card e o switch foram ocultados em `src/components/whatsapp/WhatsAppSetup.tsx` (flag `WHATSAPP_FEATURES.dailyVerse = false`).
- O que fazia no frontend: permitia ao usuário ligar/desligar o recebimento do versículo via WhatsApp ao atualizar `receives_daily_verse` na tabela `whatsapp_users`.
- O que faz no backend: a cron `/api/cron-send-verse` (e a edge `supabase/functions/daily-verse-sender`) envia o texto para todos com `receives_daily_verse = true`.
- Para reativar: remover o flag, revisar o texto do card e garantir que o cron esteja habilitado (`WHATSAPP_DAILY_VERSE_CRON_ENABLED`).

## Minha Rotina Diária de Orações no WhatsApp
- Status: desativada. Toda a UI (toggle + horários) está escondida com `WHATSAPP_FEATURES.dailyRoutine = false` em `WhatsAppSetup`.
- O que fazia no frontend: salvava `receives_daily_routine` e os campos `prayer_time_*` em `whatsapp_users`, permitindo configurar até quatro horários.
- O que faz no backend: `/api/cron-prayers` lê esses campos e dispara a mensagem correspondente conforme a janela de horário; há também o cron `/api/cron-challenge` que depende de `has_sent_first_message`.
- Para reativar: reexibir os cards, revisar os textos e garantir que os crons estejam agendados.

## Respostas baseadas na Bíblia via WhatsApp
- Status: desativada. O card foi ocultado (flag `WHATSAPP_FEATURES.bibleResponses = false`) e o switch permanece inoperante.
- O que fazia no frontend: habilitava/desabilitava `is_active` em `whatsapp_users`, permitindo respostas automáticas do Biblicus no WhatsApp.
- O que faz no backend: a rota `src/app/api/webhook/whatsapp/receive/route.ts` usa `is_active` para decidir se as mensagens entram no fluxo inteligente antes de consultar os assistentes configurados.
- Para reativar: tornar o card visível novamente e garantir que o webhook/assistentes estejam configurados com as credenciais OPENAI/Z-API.
