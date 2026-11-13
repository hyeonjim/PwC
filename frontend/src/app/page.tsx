"use client";

import Link from "next/link";

import { BreachWindowText } from "@/components/common/breach-window-text";
import { FactList } from "@/components/common/fact-list";
import { KpiCard } from "@/components/common/kpi-card";
import { LoadingMessage } from "@/components/common/loading-message";
import { MutedText } from "@/components/common/muted-text";
import { PageTitle } from "@/components/common/page-title";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { TextLink } from "@/components/common/text-link";
import { TextList } from "@/components/common/text-list";
import { ApprovalCard } from "@/components/approval/approval-card";
import { EventList } from "@/components/event/event-list";
import { WorkItemList } from "@/components/work/work-item-list";
import { buttonVariants } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { formatHundredMillionWon, formatQuantity, formatWon } from "@/lib/format";
import { CASE_STATUS_LABEL, CASE_STATUS_TONE, CASE_WARNING_STATUSES } from "@/lib/labels";
import type { Overview } from "@/types/overview";

const STATUS_DISPLAY_ORDER = ["recheck_needed", "info_needed", "pending_approval", "rejected", "conditional", "checked", "judged", "executing", "done"];

export default function HomePage() {
  const { data, error, reload } = useApi<Overview>("/overview");

  const caseCounts = Object.entries(data?.cases_by_status ?? {});
  const openCaseCount = caseCounts.filter(([status]) => status !== "done").reduce((sum, [, count]) => sum + count, 0);
  const attentionCaseCount = caseCounts.filter(([status]) => CASE_WARNING_STATUSES.includes(status)).reduce((sum, [, count]) => sum + count, 0);

  return (
    <>
      <PageTitle
        title="오늘 할 일"
        description="캠페인으로 늘어날 주문을 재고·입고 일정·현금 약정과 맞춰 보고, 승인과 후속 처리까지 잇는 화면입니다."
        action={<Link href="/cases/" className={buttonVariants()}>새 검토 접수</Link>}
      />
      {!data && <LoadingMessage error={error} />}
      {data && (
        <>
          <div className="kpi-grid">
            <KpiCard label="진행 중인 검토 건" value={openCaseCount} unit="건" note={attentionCaseCount > 0 ? <StatusBadge tone="warn">확인 필요 {attentionCaseCount}</StatusBadge> : "확인 필요 없음"} />
            <KpiCard label="승인 대기" value={data.pending_approvals.length} unit="건" note="승인권자 회신 대기" />
            <KpiCard label="열린 작업" value={data.open_work_items.length} unit="건" note="부서별 후속 작업" />
            <KpiCard
              label="전망 최저 잔액"
              value={(data.cash.min_closing_krw / 100_000_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}
              unit="억원"
              note={`${data.cash.min_date} · 약정 30억`}
            />
          </div>

          <div className="section-grid">
            <Section title="검토 건 현황" description="상태별 건수">
              {Object.keys(data.cases_by_status).length === 0 ? (
                <MutedText>
                  아직 접수된 검토 건이 없습니다. <TextLink href="/cases/">캠페인 검토 접수하기</TextLink>
                </MutedText>
              ) : (
                <ul className="overview-status-list">
                  {STATUS_DISPLAY_ORDER.filter((status) => data.cases_by_status[status]).map((status) => (
                    <li key={status}>
                      <StatusBadge tone={CASE_STATUS_TONE[status]}>{CASE_STATUS_LABEL[status]}</StatusBadge>
                      <span className="overview-status-count">{data.cases_by_status[status]}건</span>
                    </li>
                  ))}
                </ul>
              )}
              <TextLink href="/cases/">검토 건 목록으로</TextLink>
            </Section>

            <Section title="현금 약정(일말 잔액 30억)" description="회수·지급·발주대금 예정을 합산한 전망" sourceType="calculation">
              <FactList
                rows={[
                  ["기준일 잔액", formatWon(data.cash.opening_krw)],
                  ["전망 최저 잔액", `${formatHundredMillionWon(data.cash.min_closing_krw)} (${data.cash.min_date})`],
                  ["30억 하회 예상 구간", <BreachWindowText key="breach" windows={data.cash.breach_windows} badge="신규 약정은 그룹 CEO 승인" />],
                ]}
              />
              <TextLink href="/cash/">현금 전망 자세히</TextLink>
            </Section>
          </div>

          <Section title={`승인 대기 ${data.pending_approvals.length}건`} description="승인권자의 회신을 기다리는 상신">
            {data.pending_approvals.length === 0 && <MutedText>대기 중인 승인이 없습니다.</MutedText>}
            {data.pending_approvals.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} onDone={reload} showCase />
            ))}
          </Section>

          <Section title={`열린 작업 ${data.open_work_items.length}건`} description="승인·확인 결과로 생긴 부서별 작업">
            <WorkItemList items={data.open_work_items} onDone={reload} showCase />
          </Section>

          <div className="section-grid">
            <Section title={`안전재고 미달 SKU ${data.skus_below_safety.length}개`} description="현재고 ÷ 최근 4주 평균 판매 < 최소 안전재고(주)" sourceType="fact">
              <TextList>
                {data.skus_below_safety.map((sku) => (
                  <li key={sku.sku_id}>
                    {sku.sku_id} {sku.sku_name} — 커버 {sku.cover_weeks}주, 리드타임 {sku.lead_time_weeks}주, 품절 예상 {sku.first_stockout_week ?? "없음"}
                  </li>
                ))}
              </TextList>
              <TextLink href="/supply/">SKU 수요·공급 보기</TextLink>
            </Section>

            <Section title={`재고 여유 SKU ${data.skus_above_safety.length}개`} description="안전재고 상한(주)을 넘는 SKU — 캠페인 대체 후보">
              <TextList>
                {data.skus_above_safety.map((sku) => (
                  <li key={sku.sku_id}>
                    {sku.sku_id} {sku.sku_name} — 커버 {sku.cover_weeks}주, 현재고 {formatQuantity(sku.on_hand_qty)}개
                  </li>
                ))}
              </TextList>
            </Section>
          </div>

          <Section title="계약 확정기한이 가까운 캠페인 기안" description="기한이 지나면 자동 확정되어 철회할 수 없습니다" sourceType="fact">
            <TextList>
              {data.plans_due_soon.map((plan) => (
                <li key={plan.plan_id}>
                  {plan.plan_id} {plan.campaign_name} ({plan.product_line}) — 확정기한 {plan.contract_deadline} (D-{plan.days_to_deadline}), 집행 예정 {plan.settlement_date}, 요청{" "}
                  {formatWon(plan.requested_budget_krw)}
                </li>
              ))}
            </TextList>
          </Section>

          <Section title="최근 처리 이력">
            <EventList events={data.recent_events} showCase />
          </Section>
        </>
      )}
    </>
  );
}
