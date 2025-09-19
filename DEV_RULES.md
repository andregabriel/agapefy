# 🚨 Política NON-NEGOTIABLE

## 1. PRÉ-IMPLEMENTAÇÃO

1.1 Esclareça DÚVIDAS NÃO-TÉCNICAS de negócio. Se tiver, pare e pergunte.

1.2 Planeje o fluxo completo: o que o usuário vê ANTES → DURANTE → DEPOIS.

1.3 Simule a UX: "Isso faz sentido para o usuário?"

1.4 Mapeie dependências: quais componentes/contextos serão impactados?

1.5 Defina exatamente quais arquivos/funções serão modificados.

1.6 JAMAIS remova ou altere funcionalidades, UI ou UX ou Design existentes sem aprovação.

## 2. APROVAÇÃO

2.1 Conte e informe quantas FEATURES (funcionalidades) existem hoje.

2.2 Descreva seu PLANO em 3 tópicos separados:

– Adicionar: novas features introduzidas

– Alterar: features existentes modificadas

– Remover: features existentes removidas

2.3 Aguarde meu "OK" antes de tocar no código.

## 3. IMPLEMENTAÇÃO

3.1 Execute apenas o que foi aprovado no plano.

3.2 Não altere nada fora do escopo autorizado.

## 4. PÓS-IMPLEMENTAÇÃO

4.1 Reconte as features:

Antes + Adicionadas – Removidas = Depois

Verifique se bate.

4.2 Teste o fluxo UX completo e confirme que TUDO esperado pelo usuário funciona.

## 5. DEBUG (se surgir erro)

5.1 Entenda problema real: o que deveria acontecer vs. o que acontece

5.2 Verifique BACKEND (edge functions, APIs, banco)

5.3 Verifique FRONTEND (requests, state, UI)

5.4 Verifique INTEGRAÇÃO entre front e back

5.5 Só então observe logs e mensagens de erro

## ÊNFASE:

- 🚫 Nunca remova features sem autorização explícita.
- 🚫 Nunca quebre fluxos de UX existentes.
- 🚫 Sempre valide o fluxo completo antes de considerar a tarefa concluída.

**Você conseguiria fazer sem atrapalhar nenhuma funcionalidade já existente, nem nenhuma UI, nem UX e nem Design já existentes?**

---

## Como usar em prompts:

Basta começar sua solicitação com:

**"⚠️ Política NON-NEGOTIABLE (veja DEV_RULES.md): por favor, siga rigidamente as Dev_Rules antes de planejar e executar qualquer mudança."**

Isso aciona automaticamente todo o processo de revisão de features, plano, aprovação e validação, sem nunca impactar o que já existe.