import { useEffect, useState } from "react";
import type { Dataset } from "../types";
import { FALLBACK } from "../data/fallback";

type State =
  | { status: "loading"; data: Dataset }
  | { status: "ready";   data: Dataset }
  | { status: "stale";   data: Dataset; error: string };

/**
 * Data fetching. The page never ends up empty: if the API doesn't
 * respond, the fallback figures compiled into the page are used, and
 * the reader is told about it. A silent failure would be worse than a
 * stale figure.
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
