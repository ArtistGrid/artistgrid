import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
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
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/trackerapi\.artistgrid\.cx\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "tracker-api",
              expiration: { maxEntries: 100, maxAgeSeconds: 3600 },
            },
          },
          {
            urlPattern: /^https:\/\/artists\.artistgrid\.cx\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "artists-csv",
              expiration: { maxEntries: 5, maxAgeSeconds: 3600 },
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
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "radix-vendor": [
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-progress",
            "@radix-ui/react-slot",
            "@radix-ui/react-toast",
          ],
        },
      },
    },
  },
});
