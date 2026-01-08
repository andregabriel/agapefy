## Checklist: Cron do Desafio WhatsApp (produção)

Este checklist garante que o envio automático do **Desafio de Oração** pelo WhatsApp continue funcionando no ar.

### 1) O que precisa existir no banco (Supabase)

- **Tabela `whatsapp_user_challenges`** com a coluna **`send_time`**
  - É o horário (HH:MM) em que o desafio deve ser enviado.
- **Tabela `whatsapp_challenge_log`**
  - É o registro que confirma que a cron executou e tentou enviar o “Dia X”.
- **Relacionamento entre `whatsapp_user_challenges` e `whatsapp_users`**
  - Necessário para o sistema conseguir “cruzar” os dados do usuário com o desafio.

Se algo disso faltar, aplique a migration:
- `supabase/sql/2026-01-08_fix_whatsapp_challenge_cron_schema.sql`

### 2) Pré-requisitos para um usuário receber

Para um número receber o desafio, no banco precisa:

- **`whatsapp_users`**
  - `is_active = true`
  - `receives_daily_prayer = true`
  - `has_sent_first_message = true`
- **`whatsapp_user_challenges`**
  - Uma linha com `phone_number` + `playlist_id`
  - `send_time` preenchido
- **A playlist do desafio precisa ter áudios**
  - Tabela `playlist_audios` com itens para aquele `playlist_id`

### 3) Como validar rápido (sem “programar”)

**Opção A (recomendada): olhar o log no Supabase**

- Abra o Supabase → Table Editor → `whatsapp_challenge_log`
- Se aparecer uma linha nova no dia, a cron executou.

**Opção B: validar o endpoint no navegador**

- Acesse: `/api/cron-challenge?test=true&limit=5`
  - Se aparecer `totalCandidates: 1` (ou mais), existe pelo menos um envio elegível naquele momento.

### 4) Como testar “de verdade” (envio real)

- Ajuste o `send_time` de um usuário para o **horário atual** (São Paulo).
- Aguarde até **5 minutos** (cron é `*/5`).
- Confirme:
  - Chegou mensagem no WhatsApp
  - Surgiu linha em `whatsapp_challenge_log`

### 5) Se parar de enviar

Os motivos mais comuns são:

- Migração não aplicada em produção (falta `send_time`, `whatsapp_challenge_log` ou o relacionamento)
- Flags do usuário não estão elegíveis
- Playlist do desafio sem áudios
- Z-API sem credenciais válidas (env vars) ou instância indisponível


