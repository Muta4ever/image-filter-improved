import { defineConfig } from "vitest/config";
import path from "path";

// Standalone test config so the app's Vite plugins (React, Tailwind) don't run
// during unit tests — the image-processing algorithms are pure and need no DOM.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  test: {
    environment: "node",
    include: ["client/src/**/*.test.ts"],
  },
});
