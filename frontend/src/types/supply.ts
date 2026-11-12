// 백엔드(/api/v1) 응답 형식 — SKU 수요·공급, 입고, 발주.
import type { TaskBase } from "@/types/task";

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

export type PurchaseOrderTask = TaskBase<{
  case_id: number;
  sku_id: string;
  qty: number;
  amount_krw: number;
  order_date: string;
  eta: string;
  payment_due_date: string;
  eta_confirmed: boolean;
}>;

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

export type SourcePurchaseOrder = {
  po_id: string;
  sku_id: string;
  order_date: string;
  qty: number;
  eta: string;
  amount_krw: number;
  payment_due_date: string;
};

/** Corevia 생산 라인 (strat_capacity_cv) 과 시스템에서 쓴 여력 */
export type ProductionLine = {
  product_id: string;
  product_name: string;
  plant_id: string;
  line_id: string;
  capacity_qty: number;
  utilization_pct: number;
  free_weekly_qty: number;
  snapshot_date: string;
  committed_qty?: number;
  confirmed_qty: number | null;
};

export type Supply = {
  as_of: string;
  skus: SkuStatus[];
  source_pos: SourcePurchaseOrder[];
  system_pos: PurchaseOrderTask[];
  production_lines: ProductionLine[];
};

export type Projection = { sku_id: string; rows: WeekRow[]; inbound: Inbound[]; first_stockout_week: string | null };
