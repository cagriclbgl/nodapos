import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone build (.next/standalone/server.js) Electron paketinin içinde
  // child process olarak ayağa kaldırılır; vendor node_modules'lar otomatik
  // tracing ile dahil edilir. Vercel'de de zarar vermez (Vercel zaten kendi
  // serverless çıktısını üretir, output flag'ı standalone mode'a düşer ve
  // çalışır).
  output: "standalone",
};

export default nextConfig;
