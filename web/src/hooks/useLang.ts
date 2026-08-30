import { useCallback, useEffect, useState } from "react";
import type { Lang } from "../types";

const read = (): Lang => {
  if (typeof window === "undefined") return "fi";
  if (window.location.pathname.startsWith("/en")) return "en";
  return new URLSearchParams(window.location.search).get("lang") === "en" ? "en" : "fi";
};

/**
 * Language is read from the path (/en/) or a query parameter (?lang=en).
 *
 * Switching doesn't reload the page. An earlier version navigated
 * straight to /en/, which only worked on the server — on a static host
 * the reader landed on a 404 and the toggle appeared to vanish.
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
        // updating the address is cosmetic — switching languages still works without it
      }
      return next;
    });
  }, []);

  return [lang, toggle];
}
