# Configurar Variável de Ambiente na Vercel

## Passo a passo:

1. Acesse [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecione seu projeto **agapefy**
3. Vá em **Settings** (engrenagem no topo)
4. No menu lateral, clique em **Environment Variables**
5. Adicione a variável:
   - **Key:** `DMG_API_TOKEN`
   - **Value:** `a05987d5-8231-4dff-9e86-8ba830cce51c|z3HTsyksaKtdDAZcoaTbJcymHZUMCilmFXhcuHHK5aa92b70`
   - **Environments:** Marque `Production`, `Preview` e `Development`
6. Clique em **Save**
7. **Importante:** Faça um redeploy do projeto para aplicar a variável:
   - Vá em **Deployments**
   - Clique nos 3 pontinhos do último deploy
   - Clique em **Redeploy**
   - Marque **Use existing Build Cache** (mais rápido)
   - Clique em **Redeploy**

Pronto! A variável estará disponível em produção.

