"""캠페인 검토 건 하나에 대한 확인과 대안 계산.

입력: 마케팅팀이 낸 캠페인 계획(기간, 대상 SKU, 수요 증가율) + 시스템에 쌓인 공급 상태
출력: SKU 별 품절 전망, 정보 공백, 현금 약정 구간, 대안 5가지와 각 대안의 승인권자·타 부서 영향

대안
  proceed  계획대로 진행
  extra_po 추가 발주
  shift    캠페인 시작 연기
  cap      캠페인 물량 상한
  swap     상품 구성 변경(재고 여유 SKU 로)
"""

import math
from copy import deepcopy
from datetime import date, timedelta

import pandas as pd

from app.config import get_settings
from app.data.loader import read_table
from app.engine import approval, cash
from app.engine.bizcal import week_start
from app.engine.supply import (
    DEFAULT_WEEKS,
    SupplyState,
    project,
    shortage_between,
    sku_table,
    source_pos,
)

CAMPAIGNS = "02_masil/master/m_campaign_ms.csv"
BUDGET_PLANS = "02_masil/marketing/mkt_budget_plan_ms.csv"

PAYMENT_TERM_DAYS = 28  # ASM-007 추가 발주 대금 지급일 = 발주일 + 28일


def _d(value) -> date:
    return pd.to_datetime(value).date()


def plans() -> list[dict]:
    """캠페인 확대 기안 목록. 대상 SKU 후보는 상품군 이름으로 묶은 것이다(MAP-001, 원본 키 아님)."""
    as_of = get_settings().as_of_date
    sku = sku_table()
    campaigns = read_table(CAMPAIGNS).set_index("campaign_id")
    out = []
    for row in read_table(BUDGET_PLANS).to_dict("records"):
        c = campaigns.loc[row["campaign_id"]]
        candidates = sku[sku["category"] == c["product_line"]]
        deadline = _d(row["contract_deadline"])
        out.append(
            {
                "plan_id": row["plan_id"],
                "campaign_id": row["campaign_id"],
                "campaign_name": c["campaign_name"],
                "product_line": c["product_line"],
                "sales_channel": c["sales_channel"],
                "country": c["country"],
                "requested_budget_krw": int(row["requested_budget_krw"]),
                "expected_gmv_krw": int(row["expected_gmv_krw"]),
                "settlement_date": _d(row["settlement_date"]).isoformat(),
                "contract_deadline": deadline.isoformat(),
                "days_to_deadline": (deadline - as_of).days,
                "candidate_skus": [
                    {"sku_id": s["sku_id"], "sku_name": s["sku_name"]} for s in candidates.to_dict("records")
                ],
            }
        )
    return out


def total_plan_budget() -> int:
    return int(read_table(BUDGET_PLANS)["requested_budget_krw"].sum())


def _extra_outflows(state: SupplyState) -> list[dict]:
    return [
        {"date": po["payment_due_date"], "amount_krw": po["amount_krw"], "label": f"추가 발주대금 {po['sku_id']}", "ref": po["ref"]}
        for po in state.extra_pos
    ]


def evaluate(spec: dict, state: SupplyState | None = None) -> dict:
    """캠페인 계획 하나를 현재 상태에 비춰 확인한다."""
    state = state or SupplyState()
    as_of = get_settings().as_of_date
    start, end = _d(spec["start_date"]), _d(spec["end_date"])
    plan = next((p for p in plans() if p["plan_id"] == spec.get("plan_id")), None)
    master = sku_table().set_index("sku_id")

    sim = cash.simulate(_extra_outflows(state))
    windows = sim["breach_windows"]

    # ── SKU 별 확인 ─────────────────────────────────────────────
    skus, info_gaps = [], []
    for line in spec["skus"]:
        sku_id = line["sku_id"]
        m = master.loc[sku_id]
        campaign = [{"start_date": start, "end_date": end, "uplift_pct": line["uplift_pct"]}]
        base = project(sku_id, None, state)
        with_c = project(sku_id, campaign, state)
        skus.append(
            {
                "sku_id": sku_id,
                "sku_name": m["sku_name"],
                "category": m["category"],
                "uplift_pct": line["uplift_pct"],
                "on_hand_qty": int(m["on_hand_qty"]),
                "in_transit_qty": int(m["in_transit_qty"]),
                "avg_weekly_demand_4w": round(float(m["avg_weekly_demand_4w"])),
                "moq": int(m["moq"]),
                "lead_time_weeks": int(m["lead_time_weeks"]),
                "inbound": with_c["inbound"],
                "baseline_first_stockout_week": base["first_stockout_week"],
                "baseline_shortage_qty": base["total_shortage_qty"],
                "campaign_first_stockout_week": with_c["first_stockout_week"],
                "campaign_shortage_qty": with_c["total_shortage_qty"],
                "shortage_in_campaign_qty": shortage_between(with_c, start, end),
                "rows": with_c["rows"],
            }
        )
        if int(m["in_transit_qty"]) > 0 and sku_id not in state.in_transit_eta:
            # 가장 유리한 경우(지금 바로 입고)에도 결론이 같으면 판단에 영향이 없는 공백이다(ASM-011).
            best_state = deepcopy(state)
            best_state.in_transit_eta[sku_id] = as_of
            best = shortage_between(project(sku_id, campaign, best_state), start, end)
            worst = skus[-1]["shortage_in_campaign_qty"]
            info_gaps.append(
                {
                    "key": f"in_transit_eta:{sku_id}",
                    "sku_id": sku_id,
                    "material": best != worst,
                    "shortage_if_arrives_now_qty": best,
                    "shortage_if_excluded_qty": worst,
                    "message": f"{sku_id} 이동중 {int(m['in_transit_qty']):,}개의 입고예정일이 원본에 없습니다. 전망에서 제외했습니다."
                    + (
                        f" 바로 입고되면 캠페인 기간 부족이 {worst:,}개 → {best:,}개로 달라집니다."
                        if best != worst
                        else " 바로 입고돼도 결론은 같습니다."
                    ),
                    "next_action": "공급자(Corevia)에 입고예정일 확인 요청" if best != worst else "확인 없이 진행 가능",
                }
            )

    short_skus = [s for s in skus if s["shortage_in_campaign_qty"] > 0]
    proceed_ok = all(s["shortage_in_campaign_qty"] == 0 for s in skus)

    campaign_route = (
        approval.campaign_approver(plan["requested_budget_krw"], total_plan_budget(), plan["settlement_date"], windows)
        if plan
        else approval.plan_change_approver()
    )

    options = [
        _opt_proceed(skus, proceed_ok, campaign_route),
        _opt_extra_po(spec, state, short_skus, sim, as_of, start, end),
        _opt_shift(spec, state, start, end, proceed_ok, plan),
        _opt_cap(spec, state, start, end, proceed_ok),
        _opt_swap(spec, state, start, end, proceed_ok),
    ]

    return {
        "as_of": as_of.isoformat(),
        "horizon_weeks": DEFAULT_WEEKS,
        "plan": plan,
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "skus": skus,
        "info_gaps": info_gaps,
        "cash": {
            "breach_windows": windows,
            "min_closing_krw": sim["min_closing_krw"],
            "min_date": sim["min_date"],
            "covenant_min_krw": sim["covenant_min_krw"],
        },
        "options": options,
        "conclusion": "ok" if proceed_ok else "shortage",
    }


# ── 대안 ────────────────────────────────────────────────────────


def _opt_proceed(skus: list[dict], ok: bool, route: dict) -> dict:
    short = [s for s in skus if s["shortage_in_campaign_qty"] > 0]
    return {
        "key": "proceed",
        "title": "계획대로 진행",
        "applicable": True,
        "feasible": ok,
        "summary": "캠페인 기간에 품절이 예상되지 않습니다."
        if ok
        else "캠페인 기간 품절 예상: "
        + ", ".join(f"{s['sku_id']} {s['shortage_in_campaign_qty']:,}개" for s in short),
        "details": {},
        "route": route,
        "affected_depts": [
            {"dept": "SCM", "impact": "캠페인 기간 재고를 주 단위로 확인해야 합니다."},
        ]
        + (
            []
            if ok
            else [{"dept": "고객지원·물류", "impact": "품절 시 긴급배송·반품·문의가 늘어납니다(회의록의 과거 사례)."}]
        ),
    }


def _opt_extra_po(spec, state, short_skus, sim, as_of, start, end) -> dict:
    if not short_skus:
        return {
            "key": "extra_po",
            "title": "추가 발주",
            "applicable": False,
            "feasible": False,
            "summary": "캠페인 기간에 부족 수량이 없어 추가 발주가 필요하지 않습니다.",
            "details": {},
            "route": approval.po_approver(as_of, []),
            "affected_depts": [],
        }

    unit_cost = {po["sku_id"]: po["unit_cost_krw"] for po in source_pos()}
    payment_due = as_of + timedelta(days=PAYMENT_TERM_DAYS)
    trial = deepcopy(state)
    lines = []
    for s in short_skus:
        qty = math.ceil(s["shortage_in_campaign_qty"] / s["moq"]) * s["moq"]
        eta = as_of + timedelta(weeks=s["lead_time_weeks"])
        line = {
            "ref": f"신규-{s['sku_id']}",
            "sku_id": s["sku_id"],
            "qty": qty,
            "moq": s["moq"],
            "order_date": as_of.isoformat(),
            "eta": eta.isoformat(),
            "amount_krw": qty * unit_cost[s["sku_id"]],
            "unit_cost_krw": unit_cost[s["sku_id"]],
            "payment_due_date": payment_due.isoformat(),
            "arrives_before_stockout": s["campaign_first_stockout_week"] is None
            or week_start(eta) <= _d(s["campaign_first_stockout_week"]),
        }
        lines.append(line)
        trial.extra_pos.append(line)

    residual = 0
    for s in short_skus:
        campaign = [{"start_date": start, "end_date": end, "uplift_pct": s["uplift_pct"]}]
        residual += shortage_between(project(s["sku_id"], campaign, trial), start, end)

    total = sum(l["amount_krw"] for l in lines)
    after = cash.simulate(
        [
            {"date": po["payment_due_date"], "amount_krw": po["amount_krw"], "label": f"추가 발주대금 {po['sku_id']}", "ref": po["ref"]}
            for po in trial.extra_pos
        ]
    )
    route = approval.po_approver(payment_due, after["breach_windows"])
    late = [l for l in lines if not l["arrives_before_stockout"]]
    summary = f"{len(lines)}개 SKU 총 {sum(l['qty'] for l in lines):,}개, {total:,}원 발주."
    if residual > 0:
        summary += f" 리드타임 때문에 입고가 늦어 캠페인 기간 부족 {residual:,}개는 남습니다."
    return {
        "key": "extra_po",
        "title": "추가 발주",
        "applicable": True,
        "feasible": residual == 0,
        "summary": summary,
        "details": {
            "lines": lines,
            "total_amount_krw": total,
            "payment_due_date": payment_due.isoformat(),
            "residual_shortage_in_campaign_qty": residual,
            "late_skus": [l["sku_id"] for l in late],
            "cash_min_before_krw": sim["min_closing_krw"],
            "cash_min_after_krw": after["min_closing_krw"],
            "payment_in_breach_window": cash.in_breach_window(payment_due, after["breach_windows"]),
        },
        "route": route,
        "affected_depts": [
            {
                "dept": "재무",
                "impact": f"전망 최저 잔액이 {sim['min_closing_krw']:,}원 → {after['min_closing_krw']:,}원으로 내려갑니다. "
                + ("지급일이 30억 하회 예상 구간 안입니다." if route["approver"] == approval.GROUP_CEO else "지급일은 하회 예상 구간 밖입니다."),
            },
            {"dept": "Corevia 생산", "impact": "리드타임 안에 생산 여력이 있는지는 확인되지 않았습니다(정보 공백)."},
        ],
    }


def _in_campaign_shortage(spec, state, start, end, scale: float = 1.0) -> int:
    total = 0
    for line in spec["skus"]:
        campaign = [{"start_date": start, "end_date": end, "uplift_pct": line["uplift_pct"] * scale}]
        total += shortage_between(project(line["sku_id"], campaign, state), start, end)
    return total


def _opt_shift(spec, state, start, end, proceed_ok, plan) -> dict:
    base = {
        "key": "shift",
        "title": "캠페인 시작 연기",
        "route": approval.plan_change_approver(),
    }
    if proceed_ok:
        return {**base, "applicable": False, "feasible": False, "summary": "품절이 없어 연기할 필요가 없습니다.", "details": {}, "affected_depts": []}

    duration = end - start
    horizon_end = week_start(get_settings().as_of_date) + timedelta(weeks=DEFAULT_WEEKS) - timedelta(days=1)
    candidate = week_start(start) + timedelta(weeks=1)
    found = None
    while candidate + duration <= horizon_end:
        if _in_campaign_shortage(spec, state, candidate, candidate + duration) == 0:
            found = candidate
            break
        candidate += timedelta(weeks=1)

    depts = [
        {
            "dept": "마케팅",
            "impact": "인플루언서·채널 일정을 다시 잡아야 합니다."
            + (f" 계약 확정기한 {plan['contract_deadline']} 전에 결정해야 합니다." if plan else ""),
        },
        {"dept": "재무", "impact": "캠페인 집행 예정일이 바뀌면 현금 유출 시점과 승인권자를 다시 확인해야 합니다."},
    ]
    if found is None:
        return {
            **base,
            "applicable": True,
            "feasible": False,
            "summary": f"전망 기간({DEFAULT_WEEKS}주) 안에는 품절 없이 진행할 수 있는 시작일이 없습니다.",
            "details": {},
            "affected_depts": depts,
        }
    return {
        **base,
        "applicable": True,
        "feasible": True,
        "summary": f"시작일을 {found.isoformat()} 로 {(found - start).days // 7 or 1}주가량 미루면 품절 없이 진행할 수 있습니다.",
        "details": {
            "new_start_date": found.isoformat(),
            "new_end_date": (found + duration).isoformat(),
            "delay_days": (found - start).days,
        },
        "affected_depts": depts,
    }


def _opt_cap(spec, state, start, end, proceed_ok) -> dict:
    base = {"key": "cap", "title": "캠페인 물량 상한", "route": approval.plan_change_approver()}
    if proceed_ok:
        return {**base, "applicable": False, "feasible": False, "summary": "품절이 없어 물량을 줄일 필요가 없습니다.", "details": {}, "affected_depts": []}

    caps = []
    for line in spec["skus"]:
        best = 0.0
        for pct in range(100, -1, -5):
            single = {"skus": [line]}
            if _in_campaign_shortage(single, state, start, end, pct / 100) == 0:
                best = pct / 100
                break
        caps.append(
            {
                "sku_id": line["sku_id"],
                "requested_uplift_pct": line["uplift_pct"],
                "max_uplift_pct": round(line["uplift_pct"] * best, 1),
            }
        )
    # 증가율 0% 에서도 품절이면(평시 수요만으로 부족) 상한으로는 풀 수 없다.
    unsolvable = [c for c in caps if c["max_uplift_pct"] == 0 and _in_campaign_shortage({"skus": [{"sku_id": c["sku_id"], "uplift_pct": 0}]}, state, start, end) > 0]
    feasible = not unsolvable and any(c["max_uplift_pct"] > 0 for c in caps)
    return {
        **base,
        "applicable": True,
        "feasible": feasible,
        "summary": "SKU 별 수용 가능한 증가율: " + ", ".join(f"{c['sku_id']} {c['max_uplift_pct']}%" for c in caps)
        + (" — 평시 수요만으로도 부족해 상한으로는 해결되지 않습니다." if unsolvable else ""),
        "details": {"caps": caps, "baseline_short_skus": [c["sku_id"] for c in unsolvable]},
        "affected_depts": [
            {"dept": "마케팅", "impact": "기안의 예상 GMV(부서 주장)보다 판매 목표가 줄어듭니다."},
        ],
    }


def _opt_swap(spec, state, start, end, proceed_ok) -> dict:
    base = {"key": "swap", "title": "상품 구성 변경", "route": approval.plan_change_approver()}
    if proceed_ok:
        return {**base, "applicable": False, "feasible": False, "summary": "품절이 없어 상품을 바꿀 필요가 없습니다.", "details": {}, "affected_depts": []}

    uplift = sum(l["uplift_pct"] for l in spec["skus"]) / len(spec["skus"])
    used = {l["sku_id"] for l in spec["skus"]}
    candidates = []
    for row in sku_table().to_dict("records"):
        if row["sku_id"] in used:
            continue
        proj = project(row["sku_id"], [{"start_date": start, "end_date": end, "uplift_pct": uplift}], state)
        in_campaign = [r for r in proj["rows"] if _d(r["week"]) <= end and _d(r["week"]) + timedelta(days=6) >= start]
        if in_campaign and all(r["flag"] == "ok" for r in in_campaign):
            candidates.append(
                {
                    "sku_id": row["sku_id"],
                    "sku_name": row["sku_name"],
                    "category": row["category"],
                    "cover_weeks_now": round(float(row["on_hand_qty"]) / float(row["avg_weekly_demand_4w"]), 1),
                    "min_cover_weeks_in_campaign": min(r["cover_weeks"] for r in in_campaign),
                }
            )
    candidates.sort(key=lambda c: -c["cover_weeks_now"])
    candidates = candidates[:3]
    return {
        **base,
        "applicable": True,
        "feasible": bool(candidates),
        "summary": "같은 증가율을 받아도 안전재고를 지키는 SKU: " + ", ".join(f"{c['sku_id']} {c['sku_name']}(현재 {c['cover_weeks_now']}주)" for c in candidates)
        if candidates
        else "같은 증가율을 감당할 재고 여유 SKU 가 없습니다.",
        "details": {"candidates": candidates, "uplift_pct_tested": round(uplift, 1)},
        "affected_depts": [
            {"dept": "마케팅", "impact": "상품군이 달라져 인플루언서 콘텐츠·기안을 다시 써야 합니다. 대체 상품의 판매 효과는 확인되지 않았습니다."},
            {"dept": "SCM", "impact": "재고 여유(안전재고 상한 초과) SKU 의 재고를 줄일 수 있습니다."},
        ],
    }
