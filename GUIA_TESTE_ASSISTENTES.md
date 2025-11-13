# 🧪 Guia de Teste - Assistentes WhatsApp

## ✅ Checklist Pré-Teste

Antes de testar, verifique:

- [ ] Assistentes criados em `/admin/whatsapp` → aba "Assistentes"
- [ ] Todos os assistentes têm `assistantId` válido (formato `asst_...`)
- [ ] Assistentes estão habilitados (`enabled: true`)
- [ ] Palavras-chave configuradas para cada assistente
- [ ] Configuração salva (botão "Salvar Configuração de Assistentes")
- [ ] Webhook configurado em `/admin/whatsapp` → aba "Configurações"

## 🎯 Como Testar

### 1. Teste no Painel Admin

1. Acesse `/admin/whatsapp` → aba "Assistentes"
2. Role até "Testar Seleção de Assistente"
3. Digite mensagens de teste e clique em "Testar Seleção"

**Mensagens de Teste Sugeridas:**

#### Para Assistente Bíblico:
- "O que a Bíblia diz sobre fé?"
- "Explique o versículo João 3:16"
- "Qual o significado da parábola do semeador?"
- "Preciso de uma oração"

#### Para Assistente de Suporte/Vendas:
- "Não consigo fazer login"
- "Como usar o aplicativo?"
- "Quanto custa a assinatura?"
- "Preciso de ajuda com minha conta"
- "Quero comprar o plano premium"

#### Para Testar Palavras-chave:
- Use as palavras-chave exatas que você configurou
- Exemplo: Se configurou "bíblia" como palavra-chave, teste "Preciso entender a bíblia"

### 2. Teste Real no WhatsApp

#### Opção A: Via Painel Admin
1. Acesse `/admin/whatsapp` → aba "Testes"
2. Digite um número de telefone (formato: 5511999999999)
3. Digite uma mensagem
4. Clique em "Enviar Mensagem"
5. Verifique o WhatsApp do número informado

#### Opção B: Enviar Mensagem Diretamente
1. Envie uma mensagem do seu WhatsApp para o número configurado
2. Aguarde a resposta
3. Verifique se o assistente correto foi selecionado

### 3. Verificar Logs

Os logs mostram qual assistente foi selecionado:

```
✅ Assistente selecionado por palavras-chave: Mentor Bíblico (palavras: bíblia, versículo)
🤖 Usando assistente: Mentor Bíblico (asst_...)
✅ Resposta do assistente recebida
```

Ou:

```
✅ Assistente de suporte/vendas selecionado por contexto inteligente: Vendas e Suporte
🤖 Usando assistente: Vendas e Suporte (asst_...)
```

## 🔍 Como Verificar se Está Funcionando

### ✅ Sinais de Sucesso:

1. **No Painel Admin:**
   - O teste mostra qual assistente seria selecionado
   - A razão da seleção é clara

2. **No WhatsApp:**
   - Mensagem é respondida corretamente
   - Resposta corresponde ao comportamento do assistente configurado
   - Contexto é mantido em conversas seguintes (thread)

3. **Nos Logs:**
   - Logs mostram seleção de assistente
   - Logs mostram chamada bem-sucedida ao OpenAI
   - Logs mostram thread_id sendo salvo

### ❌ Problemas Comuns:

1. **Assistente não é selecionado:**
   - Verifique se está habilitado (`enabled: true`)
   - Verifique se as palavras-chave estão corretas
   - Verifique se a configuração foi salva

2. **Erro ao chamar assistente:**
   - Verifique se `OPENAI_API_KEY` está configurada
   - Verifique se o `assistantId` está correto
   - Verifique os logs para ver o erro específico

3. **Resposta não corresponde ao assistente:**
   - Verifique se o assistente foi realmente selecionado (logs)
   - Verifique se o comportamento do assistente está configurado corretamente na OpenAI

## 📊 Exemplos de Teste por Tipo

### Teste 1: Palavras-chave Explícitas
**Mensagem:** "Preciso entender a bíblia"
**Esperado:** Assistente Bíblico selecionado
**Motivo:** Palavra-chave "bíblia" encontrada

### Teste 2: Detecção Inteligente - Suporte
**Mensagem:** "Não consigo fazer login na minha conta"
**Esperado:** Assistente de Suporte selecionado
**Motivo:** Padrão de suporte detectado (não consigo + login + conta)

### Teste 3: Detecção Inteligente - Vendas
**Mensagem:** "Quanto custa o plano premium?"
**Esperado:** Assistente de Vendas selecionado
**Motivo:** Padrão de vendas detectado (quanto custa + plano)

### Teste 4: Detecção Inteligente - Bíblico
**Mensagem:** "O que Jesus disse sobre o amor?"
**Esperado:** Assistente Bíblico selecionado
**Motivo:** Padrão bíblico detectado (jesus + sobre)

### Teste 5: Assistente Padrão
**Mensagem:** "Olá, como você está?"
**Esperado:** Assistente padrão selecionado
**Motivo:** Nenhuma palavra-chave ou contexto específico

## 🛠️ Troubleshooting

### Problema: "Configuração de assistentes não encontrada"
**Solução:** Vá em `/admin/whatsapp` → "Assistentes" → "Salvar Configuração de Assistentes"

### Problema: "Nenhum assistente habilitado encontrado"
**Solução:** Habilite pelo menos um assistente (toggle "Assistente habilitado")

### Problema: "Erro ao fazer parse da configuração de assistentes"
**Solução:** Verifique se a configuração está em formato JSON válido

### Problema: Assistente não responde
**Solução:** 
1. Verifique se `OPENAI_API_KEY` está configurada
2. Verifique se o `assistantId` está correto
3. Verifique os logs para erros específicos

## 📝 Notas Importantes

1. **Threads:** O sistema mantém contexto usando threads do OpenAI. Cada usuário tem sua própria thread.

2. **Fallback:** Se o assistente falhar, o sistema usa GPT-4o como fallback.

3. **Prioridade:** A seleção segue esta ordem:
   - Palavras-chave explícitas
   - Detecção inteligente de contexto
   - Análise de estrutura
   - Assistente padrão

4. **Performance:** O timeout do assistente é de 30 segundos. Se demorar mais, usa fallback.

## 🎉 Pronto para Testar!

Agora você pode testar seus assistentes. Se encontrar algum problema, verifique os logs e siga o troubleshooting acima.

