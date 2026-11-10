import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

const frontendPort = Number(process.env.FRONTEND_PORT || 5000);
const apiPort = Number(process.env.API_PORT || 3001);

export default defineConfig(() => ({
  server: {
    host: "0.0.0.0",
    port: frontendPort,
    strictPort: true,
    allowedHosts: true as const,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: `http://localhost:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png"],
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,jpg,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: "PUB ASPEKINDO — Pengembangan Usaha Berkelanjutan",
        short_name: "PUB ASPEKINDO",
        description: "Ekosistem kompetensi digital untuk Personil Manajerial BUJK bidang konstruksi",
        theme_color: "#0a1628",
        background_color: "#0a1628",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/dashboard",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "html2pdf.js": path.resolve(__dirname, "./src/lib/stubs/html2pdf.ts"),
      "xlsx": path.resolve(__dirname, "./src/lib/stubs/xlsx.ts"),
    },
  },
}));
