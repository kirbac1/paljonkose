import { useEffect, useState } from "react";
import type { Dataset } from "../types";
import { FALLBACK } from "../data/fallback";

type State =
  | { status: "loading"; data: Dataset }
  | { status: "ready";   data: Dataset }
  | { status: "stale";   data: Dataset; error: string };

/**
 * Datan haku. Sivu ei koskaan jää tyhjäksi: jos rajapinta ei vastaa,
 * käytetään sivulle käännettyjä varalukuja ja kerrotaan siitä lukijalle.
 * Hiljainen epäonnistuminen olisi pahempi kuin vanhentunut luku.
 */
export function useData(url = "/api/data"): State {
  const [state, setState] = useState<State>({ status: "loading", data: FALLBACK });

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    fetch(url, { signal: ac.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Dataset>;
      })
      .then(data => { if (!cancelled) setState({ status: "ready", data }); })
      .catch((err: unknown) => {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) return;
        setState({
          status: "stale",
          data: FALLBACK,
          error: err instanceof Error ? err.message : String(err)
        });
      });

    return () => { cancelled = true; ac.abort(); };
  }, [url]);

  return state;
}
