# Next.js Template - Lasy AI

Este é um template [Next.js](https://nextjs.org) otimizado para deploys sem problemas, bootstrapped com [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## 🚀 Melhorias para Deploy na Vercel

Este template inclui otimizações específicas para evitar erros comuns de deploy:

### ✅ **Compatibilidade de Dependências**

- **Next.js 15.1.8** + **React 19** + todas as dependências atualizadas
- **react-day-picker v9** compatível com React 19
- **Configuração `.npmrc`** para resolver conflitos automaticamente

### ✅ **Configurações de Build Otimizadas**

- **TypeScript configurado** para excluir Supabase functions
- **Webpack configurado** para ignorar conflitos Deno/Node.js
- **`.vercelignore`** para otimizar o processo de build

### ✅ **Componentes Atualizados**

- **Calendar component** compatível com react-day-picker v9
- **UI components** do Shadcn/UI nas versões mais recentes

---

## 🛠️ Começando

Execute o servidor de desenvolvimento:

```bash
npm run dev
# ou
yarn dev
# ou
pnpm dev
# ou
bun dev
```

Abra [http://localhost:3000](http://localhost:3000) no seu navegador para ver o resultado.

Você pode começar editando a página modificando `app/page.tsx`. A página atualiza automaticamente conforme você edita o arquivo.

---

## 📚 Stack Tecnológica

- **Framework**: Next.js 15.1.8 com App Router
- **React**: 19.0.0 com suporte total
- **Styling**: Tailwind CSS + Shadcn/UI
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **UI Components**: Radix UI primitives

---

## 🔧 Deploy na Vercel

### **Variáveis de Ambiente**

Se você estiver usando Supabase, configure estas variáveis na Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima
```

### **Deploy Automático**

1. Conecte seu repositório GitHub à Vercel
2. A Vercel detectará automaticamente Next.js
3. O build será executado sem erros graças às otimizações

---

## 📖 Saiba Mais

Para aprender mais sobre Next.js, confira estes recursos:

- [Documentação Next.js](https://nextjs.org/docs) - aprenda sobre recursos e API do Next.js
- [Learn Next.js](https://nextjs.org/learn) - tutorial interativo do Next.js

Você pode conferir [o repositório GitHub do Next.js](https://github.com/vercel/next.js) - seu feedback e contribuições são bem-vindos!

---

## 🎯 Deploy Otimizado

A maneira mais fácil de deployar seu app Next.js é usar a [Plataforma Vercel](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) dos criadores do Next.js.

Confira nossa [documentação de deployment do Next.js](https://nextjs.org/docs/app/building-your-application/deploying) para mais detalhes.

---

_Template otimizado para uso com Lasy AI - builds consistentes e deploys sem problemas!_
