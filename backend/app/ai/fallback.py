"""규칙 기반 예비 판단.

AI 키가 없거나 호출이 실패했을 때 쓴다. 스스로 결론을 내리지 않고
'보류 + 사람 검토'로 돌려서, AI 없이도 업무 흐름이 끊기지 않게만 한다.
"""

from app.ai.schemas import Evidence, JudgmentResult, Recommendation


def rule_based_judgment(reason: str, required_approver: str = "담당 승인권자") -> JudgmentResult:
    return JudgmentResult(
        source="rule",
        recommendation=Recommendation(
            decision="hold",
            summary="AI 판단을 받지 못해 보류합니다. 계산 결과를 보고 담당자가 직접 판단해 주세요.",
            recommended_option="",
            evidence=[
                Evidence(
                    statement=f"AI 판단 불가 사유: {reason}",
                    source_type="fact",
                    source_ref="system",
                )
            ],
            alternatives=[],
            missing_info=["AI 판단 결과"],
            required_approver=required_approver,
            confidence="low",
        ),
        error=reason,
    )
