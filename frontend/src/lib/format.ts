// 숫자·상태를 화면 글자로 바꾸는 도우미.

export const qty = (n: number | null | undefined) => (n == null ? "-" : n.toLocaleString("ko-KR"));

export const krw = (n: number | null | undefined) => {
  if (n == null) return "-";
  const eok = n / 100_000_000;
  return `${eok.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`;
};

export const won = (n: number | null | undefined) => (n == null ? "-" : `${n.toLocaleString("ko-KR")}원`);

export const time = (iso: string) => iso.replace("T", " ").slice(0, 16);

export const CASE_STATUS: Record<string, string> = {
  received: "접수",
  info_needed: "정보 확인 중",
  checked: "확인 완료",
  judged: "판단 완료",
  pending_approval: "승인 대기",
  rejected: "승인 거절",
  conditional: "조건부 승인",
  executing: "후속 처리 중",
  recheck_needed: "재검토 필요",
  done: "완료",
};

export const NEXT_STEP: Record<string, string> = {
  received: "시스템이 재고·입고·현금을 확인하는 중입니다.",
  info_needed: "판단에 영향을 주는 정보가 비어 있습니다. 공급자 회신을 입력하거나, 미확인 상태 그대로 판단을 진행할 수 있습니다.",
  checked: "확인이 끝났습니다. AI 판단을 받거나 대안을 골라 승인을 올리세요.",
  judged: "AI 판단을 참고해 대안을 고르고 승인을 올리세요.",
  pending_approval: "승인권자의 회신을 기다리고 있습니다. (모의 회신을 입력하세요)",
  rejected: "승인이 거절됐습니다. 다른 대안을 골라 다시 올리세요.",
  conditional: "조건부 승인입니다. 조건을 반영해 다시 올리세요.",
  executing: "승인된 내용대로 부서별 작업이 진행 중입니다. 작업이 모두 끝나면 완료됩니다.",
  recheck_needed: "조건이 바뀌어 기존 판단이 맞지 않습니다. 확인 결과를 보고 다시 판단·상신하세요.",
  done: "모든 후속 작업이 끝났습니다.",
};

export const WORK_STATUS: Record<string, string> = { open: "대기", in_progress: "진행 중", done: "완료" };

export const APPROVAL_STATUS: Record<string, string> = {
  pending: "회신 대기",
  approved: "승인",
  rejected: "거절",
  conditional: "조건부 승인",
  withdrawn: "철회(조건 변경)",
};

export const PO_STATUS: Record<string, string> = {
  draft: "발주서 작성 중",
  ordered: "발주 전달(회신 대기)",
  confirmed: "입고예정 확정",
  cancelled: "취소",
};

export const FLAG: Record<string, string> = { ok: "정상", below_safety: "안전재고 미달", stockout: "품절" };

export const SOURCE_TYPE: Record<string, string> = {
  fact: "원본",
  claim: "부서 주장",
  assumption: "가정",
  calculation: "계산",
  mock: "모의",
};

export const DECISION: Record<string, string> = {
  approve: "승인 권고",
  approve_with_conditions: "조건부 승인 권고",
  reject: "반려 권고",
  hold: "보류",
  escalate: "상위 상신",
};
