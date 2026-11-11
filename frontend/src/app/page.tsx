"use client";

import Link from "next/link";

import { Empty, Facts, Loading, PageTitle, Section, Src, Status } from "@/components/ops/basic";
import { ApprovalBox, EventList, WorkList } from "@/components/ops/parts";
import type { Health } from "@/lib/api";
import { CASE_STATUS, krw, qty, won } from "@/lib/format";
import type { Overview } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const ORDER = ["recheck_needed", "info_needed", "pending_approval", "rejected", "conditional", "checked", "judged", "executing", "done"];

export default function Home() {
  const { data, error, reload } = useApi<Overview>("/overview");
  const health = useApi<Health>("/health");

  return (
    <>
      <PageTitle
        title="오늘 할 일"
        description="캠페인으로 늘어날 주문을 재고·입고 일정·현금 약정과 맞춰 보고, 승인과 후속 처리까지 잇는 화면입니다."
      />
      {!data && <Loading error={error} />}
      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Section title="검토 건 현황" description="상태별 건수">
              {Object.keys(data.cases_by_status).length === 0 ? (
                <Empty>
                  아직 접수된 검토 건이 없습니다.{" "}
                  <Link className="underline" href="/cases/">
                    캠페인 검토 접수하기
                  </Link>
                </Empty>
              ) : (
                <ul className="flex flex-col gap-1 text-sm">
                  {ORDER.filter((s) => data.cases_by_status[s]).map((s) => (
                    <li key={s}>
                      {CASE_STATUS[s]} {data.cases_by_status[s]}건
                    </li>
                  ))}
                </ul>
              )}
              <Link className="text-sm underline" href="/cases/">
                검토 건 목록으로
              </Link>
            </Section>

            <Section
              title="현금 약정(일말 잔액 30억)"
              description={
                <>
                  회수·지급·발주대금 예정을 합산한 전망 <Src type="calculation" />
                </>
              }
            >
              <Facts
                rows={[
                  ["기준일 잔액", won(data.cash.opening_krw)],
                  ["전망 최저 잔액", `${krw(data.cash.min_closing_krw)} (${data.cash.min_date})`],
                  [
                    "30억 하회 예상 구간",
                    data.cash.breach_windows.length === 0 ? (
                      "없음"
                    ) : (
                      <span className="flex flex-wrap items-center gap-2">
                        {data.cash.breach_windows.map((w) => `${w.start} ~ ${w.end}`).join(", ")}
                        <Status tone="warn">신규 약정은 그룹 CEO 승인</Status>
                      </span>
                    ),
                  ],
                ]}
              />
              <Link className="text-sm underline" href="/cash/">
                현금 전망 자세히
              </Link>
            </Section>
          </div>

          <Section title={`승인 대기 ${data.pending_approvals.length}건`} description="승인권자의 회신을 기다리는 상신">
            {data.pending_approvals.length === 0 && <Empty>대기 중인 승인이 없습니다.</Empty>}
            {data.pending_approvals.map((a) => (
              <ApprovalBox key={a.id} approval={a} onDone={reload} showCase />
            ))}
          </Section>

          <Section title={`열린 작업 ${data.open_work_items.length}건`} description="승인·확인 결과로 생긴 부서별 작업">
            <WorkList items={data.open_work_items} onDone={reload} showCase />
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section
              title={`안전재고 미달 SKU ${data.skus_below_safety.length}개`}
              description={
                <>
                  현재고 ÷ 최근 4주 평균 판매 &lt; 최소 안전재고(주) <Src type="fact" />
                </>
              }
            >
              <ul className="flex flex-col gap-1 text-sm">
                {data.skus_below_safety.map((s) => (
                  <li key={s.sku_id}>
                    {s.sku_id} {s.sku_name} — 커버 {s.cover_weeks}주, 리드타임 {s.lead_time_weeks}주, 품절 예상 {s.first_stockout_week ?? "없음"}
                  </li>
                ))}
              </ul>
              <Link className="text-sm underline" href="/supply/">
                SKU 수요·공급 보기
              </Link>
            </Section>

            <Section title={`재고 여유 SKU ${data.skus_above_safety.length}개`} description="안전재고 상한(주)을 넘는 SKU — 캠페인 대체 후보">
              <ul className="flex flex-col gap-1 text-sm">
                {data.skus_above_safety.map((s) => (
                  <li key={s.sku_id}>
                    {s.sku_id} {s.sku_name} — 커버 {s.cover_weeks}주, 현재고 {qty(s.on_hand_qty)}개
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <Section
            title="계약 확정기한이 가까운 캠페인 기안"
            description={
              <>
                기한이 지나면 자동 확정되어 철회할 수 없습니다 <Src type="fact" />
              </>
            }
          >
            <ul className="flex flex-col gap-1 text-sm">
              {data.plans_due_soon.map((p) => (
                <li key={p.plan_id}>
                  {p.plan_id} {p.campaign_name} ({p.product_line}) — 확정기한 {p.contract_deadline} (D-{p.days_to_deadline}), 집행 예정 {p.settlement_date}, 요청 {won(p.requested_budget_krw)}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="최근 처리 이력">
            <EventList events={data.recent_events} showCase />
          </Section>
        </>
      )}

      <Section title="시스템 연결 상태">
        {!health.data && <Loading error={health.error} />}
        {health.data && (
          <Facts
            rows={[
              ["백엔드", health.data.status],
              ["DB", `${health.data.db} (${health.data.db_engine})`],
              ["원본 데이터", `CSV ${health.data.raw_tables}개`],
              ["AI", health.data.ai_configured ? `연결됨 · ${health.data.ai_model}` : "키 미설정 (예비 판단 모드)"],
            ]}
          />
        )}
      </Section>
    </>
  );
}
