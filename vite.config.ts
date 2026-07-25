import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    {
      name: "non-blocking-main-css",
      transformIndexHtml(html) {
        if (command !== "build") return html;
        return html.replace(
          /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/,
          `<link rel="preload" as="style" crossorigin href="$1" onload="this.rel='stylesheet'">\n    <noscript><link rel="stylesheet" crossorigin href="$1"></noscript>`
        );
      },
    },
    {
      name: "priority-vendor-preload",
      transformIndexHtml(html) {
        if (command !== "build") return html;
        return html.replace(
          /<link rel="modulepreload" crossorigin href="(\/assets\/react-vendor-[^"]+\.js)">/,
          `<link rel="modulepreload" crossorigin fetchpriority="high" href="$1">`
        );
      },
    },
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: {
        name: "ArtistGrid",
        short_name: "ArtistGrid",
        description: "Discover and track unreleased music from your favorite artists.",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        globIgnores: ["coverage/**"],
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/trackerapi\.artistgrid\.cx\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "tracker-api",
              expiration: { maxEntries: 100 },
            },
          },
          {
            urlPattern: /^https:\/\/artists\.artistgrid\.cx\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "artists-csv",
              expiration: { maxEntries: 5 },
            },
          },
          {
            urlPattern: /^https:\/\/assets\.artistgrid\.cx\//,
            handler: "CacheFirst",
            options: {
              cacheName: "artist-images",
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request, url }) =>
              request.mode === "navigate" && !url.pathname.startsWith("/coverage"),
            handler: "NetworkFirst",
            options: {
              cacheName: "app-shell",
              expiration: { maxEntries: 10 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    sourcemap: command === "build",
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-dom/client", "react-router-dom"],
          "radix-vendor": [
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-progress",
            "@radix-ui/react-slot",
            "@radix-ui/react-toast",
          ],
          "motion-vendor": ["framer-motion"],
        },
      },
    },
  },
}));
