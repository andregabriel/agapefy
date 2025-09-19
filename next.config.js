/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuração para funcionar no ambiente Lasy
  assetPrefix: "",
  basePath: "",
  // Desabilitar strict mode para compatibilidade
  reactStrictMode: false,

  // Configurações para melhor compatibilidade de deploy (baseado na v0)
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
