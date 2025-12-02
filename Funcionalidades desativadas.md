# Funcionalidades desativadas

## Checklist de onboarding na home
- Status: desativada via flag `ONBOARDING_CHECKLIST_ENABLED = false`.
- Local desativação (frontend): `src/app/home/_components/OnboardingChecklist.tsx` — o componente é curto-circuitado, não faz fetch e não renderiza o card.
- O que fazia no frontend: buscava `/api/onboarding/checklist` com `x-user-id`, normalizava os oito passos e exibia no topo da home a lista de pendências com botão "Continuar" que levava para `/onboarding?step={n}`.
- O que faz no backend: a rota `src/app/api/onboarding/checklist/route.ts` monta a ordem dos passos a partir de `admin_forms` e `app_settings`, checa respostas em `admin_form_responses`, status do WhatsApp (`whatsapp_users`) e se a playlist "Minha Rotina" tem áudios (`playlists` + `playlist_audios`) para marcar cada passo como concluído ou pendente. A rota continua ativa para futura reativação.
