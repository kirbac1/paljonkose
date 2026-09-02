/**
 * app.js — Passenger's startup file (CommonJS).
 * Plesk: Application Startup File = app.js
 * package.json must NOT get "type": "module" — that would break require().
 */
import("./server.mjs").catch(err => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
