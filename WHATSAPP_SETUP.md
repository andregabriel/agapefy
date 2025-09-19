# WhatsApp Agape - Guia de Configuração

## Visão Geral

O **Agape** é um agente inteligente para WhatsApp que oferece:

1. **Versículo do Dia** - Envio automático diário
2. **Irmão da Igreja** - Chat empático e acolhedor
3. **Oração Personalizada** - Geração de orações baseadas em situações
4. **Especialista da Bíblia** - Respostas a dúvidas bíblicas

## Configuração Inicial

### 1. Variáveis de Ambiente

Configure as seguintes variáveis no seu `.env.local`:

```env
# OpenAI (obrigatório)
OPENAI_API_KEY=sua_chave_openai_aqui

# ElevenLabs (opcional - para áudio)
ELEVENLABS_API_KEY=sua_chave_elev enlabs_aqui

# Supabase Service Role (obrigatório)
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
```

### 2. Configuração do Webhook Z-API

1. Acesse `/admin/whatsapp` no seu painel admin
2. Na aba "Configurações", configure o webhook:
   - URL: `https://vvgqqlrujmyxzzygsizc.supabase.co/functions/v1/whatsapp-webhook`
3. Clique em "Configurar Webhook"

### 3. Teste de Funcionamento

1. Na aba "Testes", envie uma mensagem de teste
2. Verifique se a mensagem foi entregue
3. Teste os comandos básicos

## Comandos Disponíveis

### Para Usuários no WhatsApp:

- `/versículo` - Receber versículo do dia
- `/oração [situação]` - Gerar oração personalizada
- `/especialista [pergunta]` - Fazer pergunta bíblica
- `/ajuda` - Ver lista de comandos
- **Conversa livre** - Chat com irmão da igreja

### Exemplos:
```
/oração estou passando por dificuldades financeiras
/especialista qual o significado da parábola do semeador?
Oi, estou me sentindo triste hoje
```

## Funcionalidades Automáticas

### Versículo Diário
- **Horário**: Configurável via CRON
- **Público**: Usuários com `receives_daily_verse = true`
- **Envio Manual**: Disponível no painel admin

### Registro Automático
- Usuários são registrados automaticamente ao enviar primeira mensagem
- Dados salvos: telefone, nome (se disponível), preferências

## Monitoramento

### Painel Admin (`/admin/whatsapp`)

**Visão Geral:**
- Total de usuários registrados
- Usuários ativos
- Conversas do dia
- Inscritos no versículo diário

**Usuários:**
- Lista completa de usuários
- Status (ativo/inativo)
- Preferências de versículo diário

**Conversas:**
- Histórico das últimas 50 conversas
- Tipo de conversa (irmão, especialista, oração, etc.)
- Timestamps e conteúdo

## Estrutura do Banco de Dados

### Tabelas Criadas:

1. **whatsapp_users**
   - Usuários registrados
   - Preferências de notificação

2. **whatsapp_conversations**
   - Histórico de todas as conversas
   - Tipos de interação

3. **daily_verse_log**
   - Log de envios de versículo diário
   - Controle de duplicatas

## Edge Functions Criadas

1. **whatsapp-webhook** - Processa mensagens recebidas
2. **generate-prayer-internal** - Gera orações personalizadas
3. **daily-verse-sender** - Envia versículo diário

## Fluxo de Funcionamento

```
Usuário envia mensagem → Z-API → Webhook → Processamento → Resposta → Z-API → Usuário
```

### Processamento de Mensagens:

1. **Validação** - Verifica se é mensagem válida
2. **Registro** - Registra/atualiza usuário
3. **Roteamento** - Identifica tipo de solicitação
4. **Processamento** - Gera resposta apropriada
5. **Histórico** - Salva conversa no banco
6. **Envio** - Retorna resposta via Z-API

## Troubleshooting

### Problemas Comuns:

1. **Webhook não recebe mensagens**
   - Verificar URL configurada no Z-API
   - Verificar se Edge Function está ativa

2. **Erro ao gerar orações/respostas**
   - Verificar OPENAI_API_KEY
   - Verificar créditos da conta OpenAI

3. **Usuários não recebem versículo diário**
   - Verificar se CRON está configurado
   - Verificar logs da função daily-verse-sender

4. **Mensagens não são enviadas**
   - Verificar tokens Z-API
   - Verificar status da instância Z-API

### Logs e Debugging:

- Logs das Edge Functions aparecem no Supabase Dashboard
- Conversas são salvas automaticamente para auditoria
- Use a aba "Testes" para verificar conectividade

## Próximos Passos

1. **Configurar CRON** para versículo diário automático
2. **Personalizar mensagens** conforme necessidade
3. **Adicionar novos comandos** se necessário
4. **Monitorar uso** através do painel admin

## Suporte

Para dúvidas ou problemas:
1. Verificar logs no Supabase Dashboard
2. Testar conectividade via painel admin
3. Verificar configurações de variáveis de ambiente