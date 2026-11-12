// 백엔드(/api/v1) 응답 형식 — 캠페인 검토 건, 대안, AI 판단, 승인, 작업.
import type { BreachWindow } from "@/types/cash";
import type { CheckSku, ProductionLine, PurchaseOrderTask } from "@/types/supply";
import type { EventRow, TaskBase } from "@/types/task";

export type Route = { approver: string; rule: string; source: string; source_type: string };

export type PurchaseOrderLine = {
  ref: string;
  sku_id: string;
  qty: number;
  moq: number;
  order_date: string;
  eta: string;
  amount_krw: number;
  payment_due_date: string;
  arrives_before_stockout: boolean;
};

/** 추가 발주 물량을 Corevia 생산 라인 여력과 맞춰 본 결과 (전문성 확장) */
export type CapacityCheckLine = ProductionLine & {
  sku_ids: string[];
  window_weeks: number;
  estimated_qty: number;
  basis: "estimate" | "corevia_reply";
  already_committed_qty: number;
  remaining_qty: number;
  required_qty: number;
  ok: boolean;
  competing_demand: string | null;
};

export type CapacityCheck = { status: "ok" | "needs_confirmation" | "short"; lines: CapacityCheckLine[] };

export type InfoGap = {
  key: string;
  type: "in_transit_eta" | "production_capacity";
  sku_id: string | null;
  product_id?: string;
  product_name?: string;
  material: boolean;
  message: string;
  next_action: string;
};

export type Option = {
  key: "proceed" | "extra_po" | "shift" | "cap" | "swap";
  title: string;
  applicable: boolean;
  feasible: boolean;
  summary: string;
  route: Route;
  affected_depts: { dept: string; impact: string }[];
  details: {
    lines?: PurchaseOrderLine[];
    total_amount_krw?: number;
    payment_due_date?: string;
    residual_shortage_in_campaign_qty?: number;
    cash_min_before_krw?: number;
    cash_min_after_krw?: number;
    payment_in_breach_window?: boolean;
    capacity?: CapacityCheck;
    without_capacity_check?: { feasible: boolean; qty: number; residual_shortage_in_campaign_qty: number };
    new_start_date?: string;
    new_end_date?: string;
    caps?: { sku_id: string; requested_uplift_pct: number; max_uplift_pct: number }[];
    candidates?: { sku_id: string; sku_name: string; category: string; cover_weeks_now: number; min_cover_weeks_in_campaign: number }[];
  };
};

export type Plan = {
  plan_id: string;
  campaign_id: string;
  campaign_name: string;
  product_line: string;
  sales_channel: string;
  country: string;
  requested_budget_krw: number;
  expected_gmv_krw: number;
  settlement_date: string;
  contract_deadline: string;
  days_to_deadline: number;
  candidate_skus: { sku_id: string; sku_name: string }[];
};

export type Check = {
  as_of: string;
  horizon_weeks: number;
  plan: Plan | null;
  start_date: string;
  end_date: string;
  skus: CheckSku[];
  info_gaps: InfoGap[];
  cash: { breach_windows: BreachWindow[]; min_closing_krw: number; min_date: string; covenant_min_krw: number };
  options: Option[];
  conclusion: "ok" | "shortage";
};

export type Judgment = {
  source: "ai" | "rule";
  model: string | null;
  error: string | null;
  recommendation: {
    decision: string;
    summary: string;
    recommended_option: string;
    evidence: { statement: string; source_type: string; source_ref: string }[];
    alternatives: { option: string; tradeoff: string }[];
    missing_info: string[];
    required_approver: string;
    confidence: string;
  };
};

export type CasePayload = {
  plan_id: string | null;
  campaign_id: string | null;
  start_date: string;
  end_date: string;
  skus: { sku_id: string; uplift_pct: number }[];
  author: string;
  demand_as_of: string;
  note: string;
  check?: Check;
  judgment?: Judgment;
  selected_option?: string;
  approval_id?: number;
  rejected_options: { key: string; title: string; note: string }[];
  conditions: { option_key: string; note: string }[];
  previous_schedule?: { start_date: string; end_date: string };
  shortage_in_campaign_qty?: number;
  info_gap_count?: number;
};

export type CaseTask = TaskBase<CasePayload>;

export type ApprovalTask = TaskBase<{
  case_id: number;
  option_key: string;
  option: Option;
  approver: string;
  rule: string;
  requester: string;
  note: string;
}>;

export type WorkTask = TaskBase<{ case_id: number; dept: string; type: string; sku_id?: string; po_id?: number }>;

export type CaseDetail = {
  case: CaseTask;
  approvals: ApprovalTask[];
  work_items: WorkTask[];
  pos: PurchaseOrderTask[];
  events: EventRow[];
};
