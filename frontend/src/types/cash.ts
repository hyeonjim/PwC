// 백엔드(/api/v1) 응답 형식 — 현금 전망·약정.

export type BreachWindow = { start: string; end: string; min_closing_krw: number; open_ended?: boolean };

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
