"use client";

import { Loading, PageTitle, Section, Src } from "@/components/ops/basic";
import { ActionError, useAction } from "@/components/ops/parts";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/api";
import type { Assumption } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const SOURCES: [string, string, string][] = [
  ["02_masil/master/m_sku_ms.csv", "SKU 분류·MOQ·리드타임·안전재고(주)", "fact"],
  ["02_masil/inventory/sku_inventory_ms.csv", "현재고·이동중 수량 (2026-06-30 스냅샷)", "fact"],
  ["02_masil/inventory/sku_weekly_sales_ms.csv", "주간 판매량 → 평시 수요(최근 4주 평균)", "fact"],
  ["02_masil/inventory/sc_purchase_orders_ms.csv", "재고 발주·대금 지급일", "fact"],
  ["02_masil/master/m_campaign_ms.csv", "캠페인·상품군·채널", "fact"],
  ["02_masil/marketing/mkt_budget_plan_ms.csv", "캠페인 확대 기안: 요청 예산·집행 예정일·계약 확정기한 / 예상 GMV 는 부서 주장", "fact"],
  ["02_masil/financials/fin_cash_daily_ms.csv", "기준일 현금 잔액·약정 최소 잔액", "fact"],
  ["02_masil/financials/fin_ar_aging_ms.csv", "매출채권 회수 예정", "fact"],
  ["02_masil/financials/fin_ap_aging_ms.csv", "운영 매입채무 지급 예정 (po_id=NONE 만)", "fact"],
  ["02_masil/financials/fin_cash_forecast_ms.csv", "재무팀 공식 현금 전망 — 비교용", "claim"],
  ["00_common/approval_authority_policy.md", "승인 권한 규정", "fact"],
  ["02_masil/financials/covenant_terms_ms.md", "차입 약정: 하회 예상 구간의 신규 약정 제한", "fact"],
  ["00_common/calculation_definitions.md", "재고 커버·현금 시뮬레이션 계산 정의", "fact"],
];

export default function DataPage() {
  const { data, error } = useApi<Assumption[]>("/assumptions");
  const { busy, error: resetError, run } = useAction(() => window.location.reload());

  return (
    <>
      <PageTitle title="원본·가정" description="제공 데이터로 확인한 것과, 원본에 없어 새로 정한 가정을 구분해 둡니다. 원본 파일은 고치지 않습니다." />

      <Section title="꼬리표 읽는 법">
        <ul className="flex flex-col gap-1.5 text-sm">
          <li>
            <Src type="fact" /> 원본 거래·계약·규정 기록
          </li>
          <li>
            <Src type="claim" /> 부서가 쓴 전망·의견 (마케팅 수요 증가율, 예상 GMV, 재무팀 공식 전망)
          </li>
          <li>
            <Src type="assumption" /> 원본에 없어 이 시스템에서 정한 가정·매핑
          </li>
          <li>
            <Src type="calculation" /> 위 값들로 시스템이 계산한 결과
          </li>
          <li>
            <Src type="mock" /> 승인 회신·공급자 회신처럼 시연을 위해 넣는 가상 입력
          </li>
        </ul>
      </Section>

      <Section title="사용한 원본 자료" description="01_참가자_배포용/04_원본데이터 (읽기 전용)">
        <ul className="flex flex-col gap-1.5 text-sm">
          {SOURCES.map(([file, use, type]) => (
            <li key={file}>
              <Src type={type} /> <span className="font-medium">{file}</span> — {use}
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`가정·매핑 ${data?.length ?? ""}건`} description="data/assumptions/assumptions.csv">
        {!data && <Loading error={error} />}
        {data?.map((a) => (
          <div key={a.id} className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">
              {a.id} · {a.statement}
            </p>
            <p className="mt-1 text-muted-foreground">이유: {a.reason}</p>
            <p className="text-muted-foreground">원본 연결: {a.source_ref}</p>
            <p className="text-muted-foreground">쓰이는 곳: {a.used_in}</p>
          </div>
        ))}
      </Section>

      <Section title="구현 범위" description="실제 작동 / 모의 처리 / 아직 설계 단계인 부분">
        <ul className="flex flex-col gap-1.5 text-sm">
          <li>실제 작동: 재고·입고·현금 계산, 대안 생성, 승인권자 판정, 상태 변경, 작업·발주 생성, 조건 변경 시 재확인</li>
          <li>모의 처리: 승인권자 회신, 공급자 입고예정 회신, 발주서 전달 (외부로 실제 전송하지 않음)</li>
          <li>설계 단계: 나만의 확장(미정), 과거 판매 기록으로 수요 증가율 검증, Corevia 생산 여력 확인</li>
        </ul>
      </Section>

      <Section title="시연 초기화" description="시스템이 만든 검토 건·승인·작업·이력을 모두 지웁니다. 원본과 가정 파일은 그대로입니다.">
        <div>
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              if (window.confirm("검토 건·승인·작업·이력을 모두 지울까요? 되돌릴 수 없습니다.")) run(() => post("/reset"));
            }}
          >
            처음 상태로 되돌리기
          </Button>
        </div>
        <ActionError error={resetError} />
      </Section>
    </>
  );
}
