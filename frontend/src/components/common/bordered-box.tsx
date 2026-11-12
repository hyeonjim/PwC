import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const borderedBoxClassName = "rounded-lg border border-border p-3 text-base";

/** 테두리가 있는 상자. 목록 안의 카드 한 장에 쓴다. */
export function BorderedBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(borderedBoxClassName, className)}>{children}</div>;
}
