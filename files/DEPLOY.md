# Installing on Plesk (Passenger)

Application root: `.../paljonkose/current/files`

## Plesk settings

- **Application Root**: `.../paljonkose/current/files`
- **Application Startup File**: `app.js`
- **Application Mode**: production
- **Node.js**: 20 or newer

## Environment variables

| Variable | Value | Required |
|---|---|---|
| `SITE_URL` | `https://paljonkose.fi` | **Yes** |
| `PORT` | — | No, Passenger provides it |
| `RELOAD_TOKEN` | random string | Only for the `/api/reload` route |

## Two rules that break the app if forgotten

**1. Do not add `"type": "module"` to `package.json`.**
Passenger loads the startup file with `require()`. `app.js` is a
CommonJS wrapper that loads the ESM server via a dynamic `import()`
call. `"type": "module"` would turn `app.js` into ESM and `require()`
would crash. The other files are `.mjs`, so they're ES modules without
that setting.

**2. Paths are computed from `server.mjs`'s location, not the working
directory.** Passenger doesn't guarantee a working directory. `data.json`
and `public/` are read as absolute paths via `import.meta.url`. Don't
make them relative — that works in development and silently breaks in
production.

## Diagnosing a 301 loop

If the browser complains about too many redirects, the app isn't the
cause — it never issues a redirect itself. Locate it like this:

```bash
curl -sIL https://paljonkose.fi/ | grep -i "^HTTP\|^location"
```

The most common causes on Plesk:

- **The HTTP→HTTPS redirect is enabled twice** — both Plesk's
  "Permanent SEO-safe 301 redirect" and your own nginx directive
- **www ↔ non-www loops back on itself** — both redirect to each other
- **A hosting-settings redirect points at itself**

Check Plesk → Hosting Settings for whether the HTTPS redirect is on,
and Apache & nginx Settings for a second redirect in the additional
directives. Only one should be active.

Always test with `curl`, not a browser: a browser caches a 301
permanently, so the fix won't show up until you clear the cache.

## After installing

```bash
npm install --production
mkdir -p tmp && touch tmp/restart.txt
```

Check these in order:

```
/healthz                    → {"ok":true,...}   the server is alive
/                           → homepage          static files work
/ylitykset/                 → table             routes work
/p/lansirata-pk/og.png      → PNG               the native module works
```

If `/healthz` responds but `og.png` doesn't, `@resvg/resvg-js` wasn't
compiled for the server's architecture. Run `npm rebuild
@resvg/resvg-js` on the server — don't copy `node_modules` from your
machine.

The startup log prints `Root: <path>`. If it isn't
`.../current/files`, the paths are pointing at the wrong place.

## Refreshing the figures

```bash
npm run data
```

Run it once by hand and **read the output** — it's the only place
you'll see whether the figures came from the API or fell back to
placeholder values.
