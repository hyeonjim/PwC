import type { ReactNode } from "react";

/** KPI 한 칸: 라벨(작게) → 숫자(크게) → 보충(작게) */
export function KpiCard({ label, value, unit, note }: { label: string; value: ReactNode; unit?: string; note?: ReactNode }) {
  return (
    <div className="kpi-card">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">
        {value}
        {unit && <span className="kpi-unit">{unit}</span>}
      </span>
      {note && <span className="kpi-note">{note}</span>}
    </div>
  );
}
