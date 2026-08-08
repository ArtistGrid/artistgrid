import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8"));

function findFiles(dir: string, ext: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findFiles(full, ext));
    else if (entry.name.endsWith(ext)) results.push(full);
  }
  return results;
}

async function minifyJs(dir: string) {
  const swc = await import("@swc/core");
  const { minify: oxcMinify } = await import("oxc-minify");
  const terserMod = await import("terser");
  const uglify = await import("uglify-js");

  const files = findFiles(dir, ".js");
  let saved = 0;
  for (const file of files) {
    let code = readFileSync(file, "utf-8");
    const original = code;

    // 1. swc — 5 passes
    const swcOut = await swc.minify(code, {
      compress: {
        passes: 5,
        toplevel: true,
        unsafe: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        drop_console: false,
        pure_getters: true,
        hoist_funs: true,
        hoist_vars: true,
        reduce_vars: true,
        collapse_vars: true,
        join_vars: true,
        booleans_as_integers: true,
      },
      mangle: { toplevel: true },
      format: { comments: false },
      module: true,
      toplevel: true,
    });
    code = swcOut.code;

    // 2. oxc
    try {
      const oxcOut = oxcMinify(file, code, { compress: true, mangle: true });
      if (oxcOut.code) code = oxcOut.code;
    } catch {}

    // 3. terser
    try {
      const terserOut = await terserMod.default.minify(code, {
        ecma: 2020,
        module: true,
        toplevel: true,
        compress: {
          passes: 3,
          toplevel: true,
          unsafe: true,
          unsafe_math: true,
          arguments: true,
          hoist_funs: true,
          hoist_vars: true,
          reduce_vars: true,
          collapse_vars: true,
          join_vars: true,
          booleans_as_integers: true,
          drop_console: false,
          pure_getters: true,
        },
        mangle: { toplevel: true },
        output: { comments: false, wrap_func_args: false },
      });
      if (terserOut.code) code = terserOut.code;
    } catch {}

    // 4. uglify-js
    try {
      const uglifyOut = uglify.minify(code, {
        compress: {
          passes: 5,
          toplevel: true,
          unsafe: true,
          arguments: true,
          hoist_funs: true,
          hoist_vars: true,
          reduce_vars: true,
          collapse_vars: true,
          join_vars: true,
          booleans_as_integers: true,
          pure_getters: true,
          unsafe_math: true,
        },
        mangle: { toplevel: true },
        output: { comments: false, wrap_func_args: false },
        module: true,
      });
      if (uglifyOut.code) code = uglifyOut.code;
    } catch {}

    saved += original.length - code.length;
    writeFileSync(file, code);
  }
  return saved;
}

async function minifyCss(dir: string) {
  const { minify: cssoMinify } = await import("csso");
  const postcssMod = await import("postcss");
  const cssnanoMod = await import("cssnano");
  const CleanCSSMod = await import("clean-css");
  const esbuildMod = await import("esbuild");
  const postcss = postcssMod.default;
  const cssnano = cssnanoMod.default;
  const CleanCSS = CleanCSSMod.default;

  const files = findFiles(dir, ".css");
  let saved = 0;
  for (const file of files) {
    let code = readFileSync(file, "utf-8");
    const original = code;

    // 1. csso — max restructure
    try {
      const cssoOut = cssoMinify(code, { restructure: true, forceMediaMerge: true });
      if (cssoOut.css) code = cssoOut.css;
    } catch {}

    // 2. cssnano — advanced
    try {
      code = await postcss([
        cssnano({
          preset: [
            "advanced",
            {
              discardComments: { removeAll: true },
              discardDuplicates: true,
              discardEmpty: true,
              mergeRules: true,
              mergeLonghand: true,
              mergeShorthands: true,
              cssDeclarationSorter: { order: "concentric" },
              convertValues: { length: false },
              discardOverridden: true,
              normalizeUrl: true,
              normalizeWhitespace: true,
              colormin: true,
              minifyFontValues: true,
              minifyGradients: true,
              svgo: false,
            },
          ],
        }),
      ])
        .process(code, { from: undefined })
        .then((r) => r.css);
    } catch {}

    // 3. clean-css — level 2 max
    try {
      const ccOut = new CleanCSS({
        level: 2,
        compatibility: "*",
        inline: false,
        returnPromise: false,
      }).minify(code);
      if (ccOut.styles) code = ccOut.styles;
    } catch {}

    // 4. esbuild CSS
    try {
      const esOut = await esbuildMod.transform(code, { loader: "css", minify: true });
      if (esOut.code) code = esOut.code;
    } catch {}

    saved += original.length - code.length;
    writeFileSync(file, code);
  }
  return saved;
}

function customMinifyPlugin(dir: string) {
  return {
    name: "custom-minify",
    enforce: "post",
    async writeBundle() {
      const jsSaved = await minifyJs(dir);
      const cssSaved = await minifyCss(dir);
      console.log(`  custom-minify: JS -${(jsSaved / 1024).toFixed(1)} KB, CSS -${(cssSaved / 1024).toFixed(1)} KB`);
    },
  };
}

export default defineConfig(({ command }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
        globPatterns: ["**/*.{ico,png,jpg,jpeg,webp,avif,gif,svg}"],
        globIgnores: [],
        navigateFallback: null,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/trackerapi\.artistgrid\.cx\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "tracker-api",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 10,
              },
            },
          },
          {
            urlPattern: /^https:\/\/artists\.artistgrid\.cx\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "artists-csv",
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 10,
              },
            },
          },
          {
            urlPattern: /^https:\/\/assets\.artistgrid\.cx\//,
            handler: "CacheFirst",
            options: {
              cacheName: "artist-images",
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
    customMinifyPlugin(path.resolve(__dirname, "dist")),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    sourcemap: false,
    target: "es2020",
    minify: false,
    cssMinify: false,
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
