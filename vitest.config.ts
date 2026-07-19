import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost:3000",
      },
    },
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "lib/**/*.{test,spec}.{ts,tsx}", "hooks/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json", "lcov"],
      include: ["src/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.d.ts",
        "src/__tests__/**",
        "**/*.test.{ts,tsx}",
        "**/*.config.*",
        "src/main.tsx",
        "src/polyfills.ts",
        "src/providers.tsx",
      ],
      thresholds: {
        lines: 60,
        functions: 55,
        branches: 45,
        statements: 58,
      },
    },
  },
});
