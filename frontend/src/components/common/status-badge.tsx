import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

export type StatusTone = "default" | "warn" | "muted";

const VARIANT_BY_TONE = { default: "default", warn: "destructive", muted: "secondary" } as const;

export function StatusBadge({ children, tone = "default" }: { children: ReactNode; tone?: StatusTone }) {
  return <Badge variant={VARIANT_BY_TONE[tone]}>{children}</Badge>;
}
