import type { Lang } from "../types";

/**
 * Linkit palvelimen renderöimille sivuille.
 *
 * Nämä eivät ole React-reittejä: ylitysrekisteri, verokuitti ja nostot
 * renderöidään palvelimella, koska ne ovat jaettavia ja hakukoneiden
 * luettavia sivuja. Tässä tarvitaan siis vain linkit — mutta osoitteet
 * ovat kielikohtaisia, joten ne kuuluvat komponenttiin eivätkä HTML:ään.
 */
const LINKS = {
  fi: [
    { href: "/nostot/",    text: "Nostot uutisista" },
    { href: "/ylitykset/", text: "Arvio vs. toteutunut" },
    { href: "/kuitti/",    text: "Verokuitti" }
  ],
  en: [
    { href: "/en/highlights/",  text: "From the news" },
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
