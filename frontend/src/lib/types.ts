// 백엔드(/api) 응답 형식. backend/app/api/ops.py 와 맞춘다.

export type TaskBase<P> = {
  id: number;
  kind: string;
  title: string;
  status: string;
  payload: P;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: number;
  task_id: number | null;
  actor: string;
  action: string;
  note: string;
  detail: Record<string, unknown>;
  created_at: string;
};

export type Route = { approver: string; rule: string; source: string; source_type: string };

export type PoLine = {
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

export type Option = {
  key: "proceed" | "extra_po" | "shift" | "cap" | "swap";
  title: string;
  applicable: boolean;
  feasible: boolean;
  summary: string;
  route: Route;
  affected_depts: { dept: string; impact: string }[];
  details: {
    lines?: PoLine[];
    total_amount_krw?: number;
    payment_due_date?: string;
    residual_shortage_in_campaign_qty?: number;
    cash_min_before_krw?: number;
    cash_min_after_krw?: number;
    payment_in_breach_window?: boolean;
    new_start_date?: string;
    new_end_date?: string;
    caps?: { sku_id: string; requested_uplift_pct: number; max_uplift_pct: number }[];
    candidates?: { sku_id: string; sku_name: string; category: string; cover_weeks_now: number; min_cover_weeks_in_campaign: number }[];
  };
};

export type Inbound = { ref: string; qty: number; eta: string | null; basis: string; origin: string };

export type WeekRow = {
  week: string;
  opening_qty: number;
  inbound_qty: number;
  inbound_refs: string[];
  baseline_qty: number;
  campaign_qty: number;
  closing_qty: number;
  shortage_qty: number;
  cover_weeks: number | null;
  flag: "ok" | "below_safety" | "stockout";
};

export type CheckSku = {
  sku_id: string;
  sku_name: string;
  category: string;
  uplift_pct: number;
  on_hand_qty: number;
  in_transit_qty: number;
  avg_weekly_demand_4w: number;
  moq: number;
  lead_time_weeks: number;
  inbound: Inbound[];
  baseline_first_stockout_week: string | null;
  campaign_first_stockout_week: string | null;
  shortage_in_campaign_qty: number;
  rows: WeekRow[];
};

export type BreachWindow = { start: string; end: string; min_closing_krw: number; open_ended?: boolean };

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
  info_gaps: { key: string; sku_id: string; material: boolean; message: string; next_action: string }[];
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
export type ApprovalTask = TaskBase<{ case_id: number; option_key: string; option: Option; approver: string; rule: string; requester: string; note: string }>;
export type WorkTask = TaskBase<{ case_id: number; dept: string; type: string; sku_id?: string; po_id?: number }>;
export type PoTask = TaskBase<{ case_id: number; sku_id: string; qty: number; amount_krw: number; order_date: string; eta: string; payment_due_date: string; eta_confirmed: boolean }>;

export type CaseDetail = { case: CaseTask; approvals: ApprovalTask[]; work_items: WorkTask[]; pos: PoTask[]; events: EventRow[] };

export type SkuStatus = {
  sku_id: string;
  sku_name: string;
  category: string;
  on_hand_qty: number;
  in_transit_qty: number;
  in_transit_eta: string | null;
  avg_weekly_demand_4w: number;
  cover_weeks: number | null;
  safety_stock_weeks_min: number;
  safety_stock_weeks_max: number;
  moq: number;
  lead_time_weeks: number;
  below_safety_min: boolean;
  above_safety_max: boolean;
  first_stockout_week: string | null;
  inbound: Inbound[];
  committed_campaigns: { case_id: number; start_date: string; end_date: string; uplift_pct: number }[];
};

export type SourcePo = { po_id: string; sku_id: string; order_date: string; qty: number; eta: string; amount_krw: number; payment_due_date: string };
export type Supply = { as_of: string; skus: SkuStatus[]; source_pos: SourcePo[]; system_pos: PoTask[] };
export type Projection = { sku_id: string; rows: WeekRow[]; inbound: Inbound[]; first_stockout_week: string | null };

export type CashRow = {
  date: string;
  inflow_krw: number;
  outflow_krw: number;
  closing_krw: number;
  below_covenant: boolean;
  items: { ref: string; label: string; amount_krw: number; kind: string }[];
};

export type Cash = {
  as_of: string;
  horizon_end: string;
  opening_krw: number;
  opening_source: string;
  covenant_min_krw: number;
  rows: CashRow[];
  breach_windows: BreachWindow[];
  min_closing_krw: number;
  min_date: string;
  excluded: { ref: string; label: string; original_date: string; amount_krw: number; reason: string }[];
  official_forecast: { week: string; official_closing_krw: number; simulated_closing_krw: number | null; gap_krw: number | null }[];
};

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

export type Assumption = { id: string; kind: string; applies_from: string; source_ref: string; statement: string; reason: string; used_in: string };
