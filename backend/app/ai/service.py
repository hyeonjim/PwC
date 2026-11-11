"""AI 판단 입구.

계산 엔진이 만든 근거(context)를 받아 Claude 에게 판단을 요청하고,
Recommendation 형식으로 검증된 결과를 돌려준다.
"""

import json
from pathlib import Path
from typing import Any

import anthropic

from app.ai.client import get_client
from app.ai.fallback import rule_based_judgment
from app.ai.schemas import JudgmentResult, Recommendation
from app.config import get_settings

PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8")


def judge(task: str, context: dict[str, Any], prompt_name: str = "judge_base") -> JudgmentResult:
    """업무 하나에 대한 AI 판단.

    task    : 무엇을 판단하는지 (예: "SPO-0008 발주 대금 지급 승인 여부")
    context : 계산 결과·원본 근거·승인 규정 등. JSON 으로 직렬화할 수 있어야 한다.
    """
    settings = get_settings()
    client = get_client()
    if client is None:
        return rule_based_judgment("ANTHROPIC_API_KEY 가 설정되지 않았습니다.")

    user_content = (
        f"## 판단할 일\n{task}\n\n"
        f"## 근거 자료 (JSON)\n```json\n{json.dumps(context, ensure_ascii=False, default=str, indent=2)}\n```"
    )

    try:
        response = client.beta.messages.parse(
            model=settings.anthropic_model,
            max_tokens=16000,
            system=load_prompt(prompt_name),
            messages=[{"role": "user", "content": user_content}],
            output_format=Recommendation,
            output_config={"effort": settings.ai_effort},
            # 안전 분류기가 거절하면 서버가 대체 모델로 다시 시도한다.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.RateLimitError:
        return rule_based_judgment("AI 사용량 한도에 걸렸습니다. 잠시 뒤 다시 시도해 주세요.")
    except anthropic.APIStatusError as exc:
        return rule_based_judgment(f"AI 호출 오류 ({exc.status_code})")
    except anthropic.APIConnectionError:
        return rule_based_judgment("AI 서버에 연결하지 못했습니다.")

    if response.stop_reason == "refusal":
        return rule_based_judgment("AI 가 이 요청에 대한 판단을 거절했습니다.")
    if response.parsed_output is None:
        return rule_based_judgment(f"AI 응답을 해석하지 못했습니다 (stop_reason={response.stop_reason}).")

    return JudgmentResult(source="ai", model=response.model, recommendation=response.parsed_output)
