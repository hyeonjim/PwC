import type { ReactNode } from "react";

/** 흐린 안내 글자. 빈 목록 안내나 보충 설명에 쓴다. */
export function MutedText({ children }: { children: ReactNode }) {
  return <p className="text-base text-muted-foreground">{children}</p>;
}
