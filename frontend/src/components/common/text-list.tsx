import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 세로로 쌓이는 글자 목록 (ul) */
export function TextList({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn("flex flex-col gap-1 text-base", className)}>{children}</ul>;
}
