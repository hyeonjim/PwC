"""AI 판단 결과 형식. Claude 응답을 이 형식으로 검증한다."""

from typing import Literal

from pydantic import BaseModel, Field

Decision = Literal["approve", "approve_with_conditions", "reject", "hold", "escalate"]
SourceType = Literal["fact", "claim", "assumption", "calculation"]


class Evidence(BaseModel):
    statement: str = Field(description="근거 한 문장")
    source_type: SourceType = Field(
        description="fact=원본 기록, claim=부서 주장·전망, assumption=참가자 가정, calculation=계산 결과"
    )
    source_ref: str = Field(description="근거 출처. 파일명·행 ID·계산 이름 등")


class Alternative(BaseModel):
    option: str
    tradeoff: str = Field(description="이 대안을 택하면 생기는 영향과 다른 부서에 주는 영향")


class Recommendation(BaseModel):
    decision: Decision
    summary: str = Field(description="결론 한두 문장")
    recommended_option: str = Field(
        description="근거 자료의 대안 중 권고하는 것의 key. 고를 수 없으면 빈 문자열"
    )
    evidence: list[Evidence]
    alternatives: list[Alternative]
    missing_info: list[str] = Field(description="판단에 필요하지만 확인되지 않은 정보")
    required_approver: str = Field(description="승인 권한 규정상 이 결정을 내려야 하는 사람·기구")
    confidence: Literal["low", "medium", "high"]


class JudgmentResult(BaseModel):
    """AI 판단 또는 규칙 기반 예비 판단 결과와 그 출처."""

    source: Literal["ai", "rule"]
    model: str | None = None
    recommendation: Recommendation
    error: str | None = None
