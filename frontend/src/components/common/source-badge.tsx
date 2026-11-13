import { SOURCE_TYPE_LABEL } from "@/lib/labels";

/** 이 값이 원본인지, 부서 주장인지, 가정인지, 계산인지, 모의 입력인지 알려 주는 꼬리표. */
export function SourceBadge({ type }: { type: "fact" | "claim" | "assumption" | "calculation" | "mock" | string }) {
  return <span className="badge badge-source">{SOURCE_TYPE_LABEL[type] ?? type}</span>;
}
