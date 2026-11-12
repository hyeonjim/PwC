// 백엔드(/api/v1) 응답 형식 — 홈 화면 요약, 가정 목록.
import type { ApprovalTask, Plan, WorkTask } from "@/types/case";
import type { BreachWindow } from "@/types/cash";
import type { SkuStatus } from "@/types/supply";
import type { EventRow } from "@/types/task";

export type Overview = {
  as_of: string;
  cases_by_status: Record<string, number>;
  pending_approvals: ApprovalTask[];
  open_work_items: WorkTask[];
  cash: { opening_krw: number; covenant_min_krw: number; min_closing_krw: number; min_date: string; breach_windows: BreachWindow[] };
  skus_below_safety: SkuStatus[];
  skus_above_safety: SkuStatus[];
  plans_due_soon: Plan[];
  recent_events: EventRow[];
};

export type Assumption = {
  id: string;
  kind: string;
  applies_from: string;
  source_ref: string;
  statement: string;
  reason: string;
  used_in: string;
};
