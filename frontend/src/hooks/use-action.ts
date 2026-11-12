"use client";

import { useState } from "react";

import { getErrorMessage } from "@/lib/api-client";

/** 버튼을 누르면 API 를 부르고, 끝나면 onDone 으로 화면을 다시 불러온다. */
export function useAction(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, run };
}
