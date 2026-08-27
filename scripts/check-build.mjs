#!/usr/bin/env node
//
// check-build.mjs — post-build sanity checks for the built site.
//
//   node scripts/check-build.mjs [distDir]
//
// Run in CI after `npm run build`, and optionally locally before pushing.
// Exits non-zero on any error, which fails the workflow.
//
// What it checks, and why each one is here rather than being a generic
// linter rule:
//
//   1. dist/ exists and contains HTML at all.
//   2. index.html is present.
//   3. og:url / og:image are ABSOLUTE. This is the one that matters for
//      this site: every entry is meant to be shared, and a relative
//      og:image silently produces a blank preview card. Nothing errors,
//      no page looks broken — the share just looks dead. It is also
//      exactly what breaks when SITE_URL is wrong or stale after a
//      domain change.
//   4. No leftover localhost/example URLs in the built output.
//   5. Every page has a <title> and a meta description.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const DIST = process.argv[2] || "dist";

const errors = [];
const warnings = [];

const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

// ------------------------------------------------------------- walk ---

function htmlFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (extname(entry).toLowerCase() === ".html") out.push(full);
    }
  };
  walk(dir);
  return out;
}

if (!existsSync(DIST)) {
  console.error(`✗ ${DIST}/ does not exist — did the build run?`);
  process.exit(1);
}

const pages = htmlFiles(DIST);

if (pages.length === 0) {
  console.error(`✗ No HTML files found under ${DIST}/`);
  process.exit(1);
}

if (!existsSync(join(DIST, "index.html"))) {
  err(DIST, "no index.html at the root of the build");
}

// ------------------------------------------------------------ checks ---

// Absolute means it has a scheme. Protocol-relative (//host/path) counts
// as absolute for og: purposes but is bad practice in a meta tag, so it
// gets flagged separately.
const ABSOLUTE = /^https?:\/\//i;
const PROTOCOL_RELATIVE = /^\/\//;

const metaContent = (html, prop) => {
  // Match both property= and name=, either attribute order, single or
  // double quotes. Deliberately permissive — this is a safety net, not a
  // parser, and a false negative here is worse than a loose regex.
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return null;
};

for (const file of pages) {
  const rel = relative(DIST, file);
  const html = readFileSync(file, "utf8");

  // --- shareability: the og: tags ---
  for (const prop of ["og:url", "og:image"]) {
    const value = metaContent(html, prop);

    if (value === null) {
      warn(rel, `missing ${prop} — this page will share without a preview`);
      continue;
    }

    if (value.trim() === "") {
      err(rel, `${prop} is empty`);
      continue;
    }

    if (PROTOCOL_RELATIVE.test(value)) {
      err(rel, `${prop} is protocol-relative ("${value}") — use a full https:// URL`);
      continue;
    }

    if (!ABSOLUTE.test(value)) {
      err(
        rel,
        `${prop} is relative ("${value}") — social scrapers do not resolve ` +
          `these, so the preview will be blank. Check SITE_URL.`,
      );
    }
  }

  // --- stale placeholder URLs ---
  for (const bad of ["localhost", "127.0.0.1", "example.com", "YOURDOMAIN"]) {
    if (html.includes(bad)) {
      err(rel, `built output still contains "${bad}" — SITE_URL is not set correctly`);
      break;
    }
  }

  // --- basic SEO floor ---
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (!title || !title[1].trim()) {
    err(rel, "no <title>");
  }

  if (!metaContent(html, "description")) {
    warn(rel, "no meta description");
  }

  // --- language, since this is a Finnish-language site ---
  if (!/<html[^>]+lang=/i.test(html)) {
    warn(rel, 'no lang attribute on <html> (expected lang="fi")');
  }
}

// ------------------------------------------------------------ report ---

console.log(`Checked ${pages.length} page(s) in ${DIST}/\n`);

if (warnings.length) {
  console.log(`⚠ ${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ${w}`);
  console.log();
}

if (errors.length) {
  console.error(`✗ ${errors.length} error(s):`);
  for (const e of errors) console.error(`  ${e}`);
  console.error("\nBuild rejected.");
  process.exit(1);
}

console.log("✓ Build looks publishable.");
