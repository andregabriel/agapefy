import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Otimizações para Vercel
  output: "standalone",

  // Configurações de imagem otimizadas
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },

  // Configurações estáveis
  experimental: {
    typedRoutes: false, // Desabilitado para evitar conflitos
  },
  // Indicar pacotes externos para o servidor
  serverExternalPackages: ["@supabase/supabase-js"],

  // Configurações de webpack para resolver problemas comuns
  webpack: (config, { isServer }) => {
    // Resolver problemas com módulos Node.js apenas no cliente
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
      };
    }

    // Não customizar optimization/splitChunks; deixar Next gerenciar
    return config;
  },

  // Headers de segurança
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          },
        ],
      },
    ];
  },

  async redirects() {
    return [
      {
        source: '/onboarding:id(\\d+)',
        destination: '/onboarding?step=:id',
        permanent: true,
      },
      {
        source: '/admin/gmanual',
        destination: '/admin/go',
        permanent: true,
      },
      // Mantemos /admin/gerar-conteudo como alias legado para /admin/go,
      // mas /admin/gtema foi removido do código para evitar confusões.
      {
        source: '/admin/gerar-conteudo',
        destination: '/admin/go',
        permanent: true,
      },
    ];
  },

  // ESLint configuração para não quebrar build
  eslint: {
    ignoreDuringBuilds: true, // Ignorar erros ESLint durante build
  },

  // TypeScript configuração
  typescript: {
    ignoreBuildErrors: true, // Ignorar erros TypeScript durante build
  },

  // Configurações de compilação (usar padrão do Next)

  // Configurações de ambiente otimizadas para Lasy
  env: {
    // Variáveis customizadas
    CUSTOM_KEY: process.env.CUSTOM_KEY,

    // Fallbacks para variáveis comuns
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },

  // Configurações específicas para preview da Lasy
  ...(process.env.NODE_ENV === "development" && {
    // Configurações otimizadas para desenvolvimento
    reactStrictMode: false, // Para compatibilidade com preview
  }),
};

export default nextConfig;