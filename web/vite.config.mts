import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // outDir is outside web/'s own root, so Vite won't empty it unless told
  // to. Without this, every rebuild leaves the previous run's hashed
  // bundle behind — and since the build output is committed to git and
  // shipped on every deploy, those would accumulate forever.
  build: { outDir: "../files/public", emptyOutDir: true },
  server: {
    // In development, data and pages come from the existing Express server.
    proxy: {
      "/api": "http://localhost:3000",
      "/p": "http://localhost:3000",
      "/ylitykset": "http://localhost:3000",
      "/kuitti": "http://localhost:3000"
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"]
  }
} as Parameters<typeof defineConfig>[0]);
