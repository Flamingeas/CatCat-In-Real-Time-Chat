import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. On retire la clé "experimental" qui causait l'erreur
  // 2. On ajoute une config Turbopack vide pour dire "Je ne l'utilise pas"
  // Cela force le fallback vers Webpack pour supporter le plugin PWA
  turbopack: {}, 
};

export default withPWA(nextConfig);