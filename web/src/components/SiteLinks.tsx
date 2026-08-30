import type { Lang } from "../types";

/**
 * Linkit palvelimen renderöimille sivuille.
 *
 * Nämä eivät ole React-reittejä: ylitysrekisteri ja verokuitti
 * renderöidään palvelimella, koska ne ovat jaettavia ja hakukoneiden
 * luettavia sivuja. Tässä tarvitaan siis vain linkit — mutta osoitteet
 * ovat kielikohtaisia, joten ne kuuluvat komponenttiin eivätkä HTML:ään.
 *
 * Ei linkkiä /nostot/-sivulle — sillä ei ole vastaavaa reittiä
 * server.mjs:ssä (eikä vanhassa vanilla-versiossakaan), joten linkki
 * olisi pelkkä 404.
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
