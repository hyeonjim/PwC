import { StatusBadge } from "@/components/common/status-badge";
import { formatHundredMillionWon, formatPeriod } from "@/lib/format";
import type { BreachWindow } from "@/types/cash";

/** 일말 잔액이 약정 최소 잔액 아래로 내려가는 구간 목록. 없으면 "없음". */
export function BreachWindowText({ windows, badge, showMinimum = false }: { windows: BreachWindow[]; badge?: string; showMinimum?: boolean }) {
  if (windows.length === 0) return <>없음</>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {windows
        .map((window) => `${formatPeriod(window.start, window.end)}${showMinimum ? ` (최저 ${formatHundredMillionWon(window.min_closing_krw)})` : ""}`)
        .join(", ")}
      {badge && <StatusBadge tone="warn">{badge}</StatusBadge>}
    </span>
  );
}
