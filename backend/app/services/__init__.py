"""비즈니스 로직.

- 계산 서비스(inventory, supply, cash, approval_route, campaign_case):
  공식 계산식(00_common/calculation_definitions.md)을 코드로 옮긴다.
  AI 가 아니라 코드가 계산하고, AI 는 계산 결과를 근거로 판단한다.
- judgment_service: 계산 결과를 근거로 Claude 판단을 받는다.
- workflow_service: 접수 → 확인 → 판단 → 상신 → 회신 → 후속 처리 업무 흐름.
"""
