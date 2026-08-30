import type { Lang } from "../types";

/**
 * Links to server-rendered pages.
 *
 * These aren't React routes: the overrun register and the tax receipt
 * are rendered by the server, because they're shareable, search-engine
 * readable pages. So all that's needed here is the links — but the
 * addresses are language-specific, so they belong in the component,
 * not the HTML.
 *
 * No link to a /nostot/ page — it has no matching route in server.mjs
 * (nor did the old vanilla version), so the link would just be a 404.
 */
const LINKS = {
  fi: [
    { href: "/ylitykset/", text: "Arvio vs. toteutunut" },
    { href: "/kuitti/",    text: "Verokuitti" }
  ],
  en: [
    { href: "/en/overruns/",    text: "Estimate vs. actual" },
    { href: "/en/tax-receipt/", text: "Tax receipt" }
  ]
} as const satisfies Record<Lang, readonly { href: string; text: string }[]>;

export function SiteLinks({ lang }: { lang: Lang }) {
  return (
    <nav className="links" aria-label={lang === "en" ? "More pages" : "Muut sivut"}>
      {LINKS[lang].map(l => (
        <a key={l.href} href={l.href}>{l.text} →</a>
      ))}
    </nav>
  );
}
