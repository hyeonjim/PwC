import type { ReactNode } from "react";

/** default: 중립 / warn: 주의·검토 필요 / muted: 끝났거나 해당 없음 / success: 승인·가능 / danger: 거절 / accent: AI 권고 */
export type StatusTone = "default" | "warn" | "muted" | "success" | "danger" | "accent";

const CLASS_BY_TONE: Record<StatusTone, string> = {
  default: "badge-neutral",
  warn: "badge-warning",
  muted: "badge-muted",
  success: "badge-success",
  danger: "badge-danger",
  accent: "badge-accent",
};

export function StatusBadge({ children, tone = "default" }: { children: ReactNode; tone?: StatusTone }) {
  return <span className={`badge ${CLASS_BY_TONE[tone]}`}>{children}</span>;
}
