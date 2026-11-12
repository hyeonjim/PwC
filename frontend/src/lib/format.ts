// 숫자·날짜를 화면 글자로 바꾸는 도우미.

export const formatQuantity = (value: number | null | undefined) => (value == null ? "-" : value.toLocaleString("ko-KR"));

/** 원 단위 금액을 "12.3억원" 처럼 억 단위로 보여 준다. */
export const formatHundredMillionWon = (value: number | null | undefined) => {
  if (value == null) return "-";
  const hundredMillion = value / 100_000_000;
  return `${hundredMillion.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억원`;
};

export const formatWon = (value: number | null | undefined) => (value == null ? "-" : `${value.toLocaleString("ko-KR")}원`);

/** ISO 시각을 "2026-07-01 09:30" 으로 보여 준다. */
export const formatDateTime = (isoText: string) => isoText.replace("T", " ").slice(0, 16);

/** 두 날짜를 "시작 ~ 끝" 으로 보여 준다. */
export const formatPeriod = (start: string | undefined, end: string | undefined) => `${start ?? "-"} ~ ${end ?? "-"}`;
