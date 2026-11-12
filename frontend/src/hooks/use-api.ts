"use client";

import { useCallback, useEffect, useState } from "react";

import { getErrorMessage, requestApi } from "@/lib/api-client";

/** GET 한 번 + 다시 불러오기. path 가 null 이면 부르지 않는다. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!path) return;
    let isActive = true;
    requestApi<T>(path)
      .then((result) => {
        if (!isActive) return;
        setData(result);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (isActive) setError(getErrorMessage(caught));
      });
    return () => {
      isActive = false;
    };
  }, [path, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);
  return { data, error, reload };
}
