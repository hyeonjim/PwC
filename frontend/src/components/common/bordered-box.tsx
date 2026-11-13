import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 카드 안의 한 묶음(승인 한 건, 가정 한 건). 외곽선 대신 옅은 배경으로 구분한다. */
export function BorderedBox({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("inner-box", className)}>{children}</div>;
}
