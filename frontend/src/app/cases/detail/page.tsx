"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CheckResultSection } from "@/app/cases/detail/_components/check-result-section";
import { JudgmentSection } from "@/app/cases/detail/_components/judgment-section";
import { OptionCard } from "@/app/cases/detail/_components/option-card";
import { ApprovalCard } from "@/components/approval/approval-card";
import { FactList } from "@/components/common/fact-list";
import { LoadingMessage } from "@/components/common/loading-message";
import { MutedText } from "@/components/common/muted-text";
import { PageTitle } from "@/components/common/page-title";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { TableHeaderRow } from "@/components/common/table-header-row";
import { TextLink } from "@/components/common/text-link";
import { ConditionChangeForm } from "@/components/condition-change/condition-change-form";
import { EventList } from "@/components/event/event-list";
import { WorkItemList } from "@/components/work/work-item-list";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { formatPeriod, formatQuantity, formatWon } from "@/lib/format";
import { CASE_NEXT_STEP, CASE_STATUS_LABEL, CASE_STATUS_TONE, PURCHASE_ORDER_STATUS_LABEL } from "@/lib/labels";
import type { CaseDetail } from "@/types/case";

/** 승인을 올릴 수 있는 검토 건 상태 */
const REQUESTABLE_STATUSES = ["received", "info_needed", "checked", "judged", "rejected", "conditional", "recheck_needed"];
const PURCHASE_ORDER_COLUMNS = ["발주", "SKU", "수량", "금액", "입고예정", "대금 지급일", "상태"];

export default function CaseDetailPage() {
  // 정적 내보내기에서는 주소의 ?id= 를 읽는 부분을 Suspense 로 감싸야 한다.
  return (
    <Suspense fallback={<LoadingMessage error={null} />}>
      <CaseDetailView />
    </Suspense>
  );
}

function CaseDetailView() {
  const caseId = useSearchParams().get("id");
  const { data, error, reload } = useApi<CaseDetail>(caseId ? `/cases/${caseId}` : null);

  if (!caseId) return <MutedText>주소에 검토 건 번호(?id=)가 없습니다.</MutedText>;
  if (!data) return <LoadingMessage error={error} />;

  const caseTask = data.case;
  const payload = caseTask.payload;
  const check = payload.check;
  const plan = check?.plan;
  const canRequest = REQUESTABLE_STATUSES.includes(caseTask.status);
  const pendingApproval = data.approvals.find((approval) => approval.status === "pending");

  return (
    <>
      <div className="flex flex-col gap-4">
        <TextLink className="w-fit text-muted-foreground" href="/cases/">
          ← 검토 건 목록
        </TextLink>
        <PageTitle title={`#${caseTask.id} ${caseTask.title}`} />
        <div className="case-status">
          <StatusBadge tone={CASE_STATUS_TONE[caseTask.status]}>{CASE_STATUS_LABEL[caseTask.status] ?? caseTask.status}</StatusBadge>
          <p>{CASE_NEXT_STEP[caseTask.status]}</p>
        </div>
      </div>

      <Section title="접수 내용" description="마케팅팀이 낸 캠페인 계획과 수요 가정" sourceType="claim">
        <FactList
          rows={[
            ["기안", plan ? `${plan.plan_id} · ${plan.campaign_name} (${plan.product_line})` : "-"],
            ["캠페인 기간", formatPeriod(payload.start_date, payload.end_date)],
            ...(payload.previous_schedule
              ? ([["변경 전 기간", formatPeriod(payload.previous_schedule.start_date, payload.previous_schedule.end_date)]] as [string, string][])
              : []),
            ["대상 SKU·증가율", payload.skus.map((sku) => `${sku.sku_id} +${sku.uplift_pct}%`).join(", ")],
            ["작성자 / 기준시점", `${payload.author} / ${payload.demand_as_of}`],
            ["요청 예산", plan ? formatWon(plan.requested_budget_krw) : "-"],
            ["집행 예정일", plan?.settlement_date ?? "-"],
            ["계약 확정기한", plan ? `${plan.contract_deadline} (D-${plan.days_to_deadline}) — 지나면 자동 확정` : "-"],
            ["메모", payload.note || "-"],
          ]}
        />
      </Section>

      {check && <CheckResultSection check={check} caseId={caseTask.id} onDone={reload} />}

      <JudgmentSection judgment={payload.judgment} caseId={caseTask.id} canJudge={canRequest} onDone={reload} options={check?.options ?? []} />

      {check && (
        <Section title="대안과 승인 상신" description="담당자가 대안을 골라 승인권자에게 올립니다. 승인권자는 규정에 따라 시스템이 정합니다.">
          {payload.rejected_options.length > 0 && (
            <p>
              이전에 거절된 대안: {payload.rejected_options.map((rejected) => `${rejected.title}${rejected.note ? ` (${rejected.note})` : ""}`).join(", ")}
            </p>
          )}
          {payload.conditions.length > 0 && <p>승인권자가 붙인 조건: {payload.conditions.map((condition) => condition.note).join(" / ")}</p>}
          {check.options.map((option) => (
            <OptionCard
              key={option.key}
              option={option}
              caseId={caseTask.id}
              canRequest={canRequest}
              recommended={payload.judgment?.recommendation.recommended_option === option.key}
              selected={payload.selected_option === option.key}
              onDone={reload}
            />
          ))}
        </Section>
      )}

      <Section title="승인 회신" description="외부 결재 시스템 대신, 승인권자 역할로 회신을 넣습니다.">
        {data.approvals.length === 0 && <MutedText>아직 상신한 건이 없습니다.</MutedText>}
        {pendingApproval && <ApprovalCard approval={pendingApproval} onDone={reload} />}
        {data.approvals
          .filter((approval) => approval.status !== "pending")
          .map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} onDone={reload} />
          ))}
      </Section>

      <Section title="후속 처리" description="승인·거절·정보 공백에 따라 생긴 부서별 작업과 발주. 작업이 모두 끝나면 검토 건이 완료됩니다.">
        <WorkItemList items={[...data.work_items].reverse()} onDone={reload} />
        {data.pos.length > 0 && (
          <Table>
            <TableHeaderRow columns={PURCHASE_ORDER_COLUMNS} numericColumns={[2, 3]} />
            <TableBody>
              {data.pos.map((purchaseOrder) => (
                <TableRow key={purchaseOrder.id}>
                  <TableCell>PO-{purchaseOrder.id}</TableCell>
                  <TableCell>{purchaseOrder.payload.sku_id}</TableCell>
                  <TableCell className="table-number">{formatQuantity(purchaseOrder.payload.qty)}</TableCell>
                  <TableCell className="table-number">{formatWon(purchaseOrder.payload.amount_krw)}</TableCell>
                  <TableCell>
                    {purchaseOrder.payload.eta} {purchaseOrder.payload.eta_confirmed ? "(회신 확정)" : "(가정)"}
                  </TableCell>
                  <TableCell>{purchaseOrder.payload.payment_due_date}</TableCell>
                  <TableCell>{PURCHASE_ORDER_STATUS_LABEL[purchaseOrder.status] ?? purchaseOrder.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      {check && (
        <Section title="조건 변경 입력" description="공급 지연, 입고예정 회신, 수요 정정 같은 새 사건을 넣어 기존 판단을 다시 검증합니다.">
          <ConditionChangeForm
            onDone={reload}
            caseId={caseTask.id}
            skuIds={check.skus.map((sku) => sku.sku_id)}
            productLines={check.options.find((option) => option.key === "extra_po")?.details.capacity?.lines ?? []}
            purchaseOrderRefs={[...new Set(check.skus.flatMap((sku) => sku.inbound.filter((inbound) => !inbound.ref.startsWith("이동중")).map((inbound) => inbound.ref)))]}
          />
        </Section>
      )}

      <Section title="처리 이력" description="누가 언제 무엇을 했는지">
        <EventList events={data.events} />
      </Section>
    </>
  );
}
