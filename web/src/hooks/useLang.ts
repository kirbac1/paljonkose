import { useCallback, useEffect, useState } from "react";
import type { Lang } from "../types";

const read = (): Lang => {
  if (typeof window === "undefined") return "fi";
  if (window.location.pathname.startsWith("/en")) return "en";
  return new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "fi";
};

/**
 * Kieli luetaan polusta (/en/) tai kyselyparametrista (?lang=en).
 *
 * Vaihto ei lataa sivua uudelleen. Aiempi versio navigoi suoraan
 * osoitteeseen /en/, mikä toimi vain palvelimella — staattisella
 * isännällä lukija päätyi 404-sivulle ja nappi näytti katoavan.
 */
export function useLang(): [Lang, () => void] {
  const [lang, setLang] = useState<Lang>(read);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const toggle = useCallback(() => {
    setLang(prev => {
      const next: Lang = prev === "en" ? "fi" : "en";
      try {
        const u = new URL(window.location.href);
        if (next === "en") u.searchParams.set("lang", "en");
        else u.searchParams.delete("lang");
        window.history.replaceState(null, "", u);
      } catch {
        // osoitteen päivitys on koriste — kielenvaihto toimii ilmankin
      }
      return next;
    });
  }, []);

  return [lang, toggle];
}
