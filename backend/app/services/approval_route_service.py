"""승인권자 판정 (approval_authority_policy, covenant_terms_ms).

판단 순서(원본 규정)
 ① 재전망으로 30억 하회 예상 구간을 먼저 특정한다.
 ② 약정의 현금 유출일이 그 구간에 들어가는지 대조한다.
 ③ 들어가면 금액·종류와 무관하게 그룹 CEO 승인이다. 평시 전결 권한은 이 구간에서 효력을 잃는다.

시스템은 승인권자를 정해 상신만 한다. 결정은 사람이 한다.
"""

from datetime import date

from app.engine.cash import in_breach_window

GROUP_CEO = "그룹 CEO"
MASIL_CEO = "Masil 대표"
SCM = "SCM"
MARKETING = "마케팅팀"
PLAN_CHANGE = "SCM·마케팅 합의"

CAMPAIGN_TEAM_LIMIT = 10_000_000  # 건별 1천만원 이하 마케팅팀 전결
CAMPAIGN_TOTAL_LIMIT = 100_000_000  # 기안 총액 1억원 초과 시 Masil 대표


def po_approver(payment_date: date | str, windows: list[dict]) -> dict:
    if in_breach_window(payment_date, windows):
        return {
            "approver": GROUP_CEO,
            "rule": "covenant 하회 예상 구간 중 신규 현금 약정 — 금액·종류 불문 그룹 CEO 승인 (평시 SCM 전결 효력 상실)",
            "source": "approval_authority_policy.md / covenant_terms_ms.md",
            "source_type": "fact",
        }
    return {
        "approver": SCM,
        "rule": "재고 발주 승인은 SCM 전결 (현금 유출일이 하회 예상 구간 밖)",
        "source": "approval_authority_policy.md",
        "source_type": "fact",
    }


def campaign_approver(budget_krw: int, total_budget_krw: int, settlement_date: date | str, windows: list[dict]) -> dict:
    if in_breach_window(settlement_date, windows):
        return {
            "approver": GROUP_CEO,
            "rule": "캠페인 집행 예정일이 covenant 하회 예상 구간 — 금액·종류 불문 그룹 CEO 승인",
            "source": "approval_authority_policy.md / covenant_terms_ms.md",
            "source_type": "fact",
        }
    if budget_krw > CAMPAIGN_TEAM_LIMIT or total_budget_krw > CAMPAIGN_TOTAL_LIMIT:
        return {
            "approver": MASIL_CEO,
            "rule": "캠페인 확대안 — 건별 1천만원 초과 또는 기안 총액 1억원 초과: Masil 대표 승인 + 그룹 보고",
            "source": "approval_authority_policy.md",
            "source_type": "fact",
        }
    return {
        "approver": MARKETING,
        "rule": "캠페인 확대안 — 건별 1천만원 이하 마케팅팀 전결",
        "source": "approval_authority_policy.md",
        "source_type": "fact",
    }


def plan_change_approver() -> dict:
    return {
        "approver": PLAN_CHANGE,
        "rule": "현금 유출이 없는 캠페인 일정·물량·상품 조정은 SCM 과 마케팅팀이 합의해 확정 (ASM-008, 원본에 없는 절차)",
        "source": "data/assumptions/assumptions.csv#ASM-008",
        "source_type": "assumption",
    }


_RANK = {MARKETING: 0, PLAN_CHANGE: 1, SCM: 1, MASIL_CEO: 2, GROUP_CEO: 3}


def strictest(*routes: dict) -> dict:
    """여러 규정이 함께 걸리면 가장 높은 승인권자를 따른다."""
    return max(routes, key=lambda r: _RANK.get(r["approver"], 0))
