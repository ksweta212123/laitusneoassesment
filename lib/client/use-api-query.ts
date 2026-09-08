"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type QueryState<T> = {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  /** true when `data` is from an earlier successful load and the latest load failed. */
  stale: boolean;
  loadedAt: number | undefined;
};

type Internal<T> = QueryState<T> & { forPath: string | null };

function initial<T>(path: string | null): Internal<T> {
  return { forPath: path, data: undefined, error: undefined, loading: path !== null, stale: false, loadedAt: undefined };
}

/**
 * Loads a GET endpoint and keeps it fresh: it reloads when the tab regains
 * focus or becomes visible again, so a console left open overnight does not
 * show yesterday's merchant status. When a reload fails the previous data is
 * kept and marked stale rather than blanked, so the operator sees something
 * true (old, and labelled as such) instead of nothing.
 */
export function useApiQuery<T>(path: string | null): QueryState<T> & { reload: () => void } {
  const [state, setState] = useState<Internal<T>>(() => initial<T>(path));

  // A new path means new data: reset during render so the previous merchant's
  // details are never shown under the next merchant's URL, not even for a frame.
  if (state.forPath !== path) setState(initial<T>(path));

  // Responses are only applied if the hook is still on the path they were for.
  const fetchInto = useCallback(() => {
    if (path === null) return;
    api<T>(path).then(
      (data) =>
        setState((s) =>
          s.forPath !== path ? s : { forPath: path, data, error: undefined, loading: false, stale: false, loadedAt: Date.now() },
        ),
      (error: Error) =>
        setState((s) => (s.forPath !== path ? s : { ...s, loading: false, error, stale: s.data !== undefined })),
    );
  }, [path]);

  const reload = useCallback(() => {
    if (path === null) return;
    setState((s) => ({ ...s, loading: true }));
    fetchInto();
  }, [path, fetchInto]);

  useEffect(() => {
    fetchInto();
  }, [fetchInto]);

  useEffect(() => {
    const onFocus = () => reload();
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  return { data: state.data, error: state.error, loading: state.loading, stale: state.stale, loadedAt: state.loadedAt, reload };
}
