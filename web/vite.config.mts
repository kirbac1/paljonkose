import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: { outDir: "../public", emptyOutDir: false },
  server: {
    // Kehityksessä data ja sivut tulevat olemassa olevalta Express-palvelimelta.
    proxy: {
      "/api": "http://localhost:3000",
      "/p": "http://localhost:3000",
      "/ylitykset": "http://localhost:3000",
      "/kuitti": "http://localhost:3000",
      "/nostot": "http://localhost:3000"
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"]
  }
} as Parameters<typeof defineConfig>[0]);
