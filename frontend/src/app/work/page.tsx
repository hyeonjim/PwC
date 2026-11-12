"use client";

import { ApprovalCard } from "@/components/approval/approval-card";
import { LoadingMessage } from "@/components/common/loading-message";
import { MutedText } from "@/components/common/muted-text";
import { PageTitle } from "@/components/common/page-title";
import { Section } from "@/components/common/section";
import { ConditionChangeForm } from "@/components/condition-change/condition-change-form";
import { EventList } from "@/components/event/event-list";
import { WorkItemList } from "@/components/work/work-item-list";
import { useApi } from "@/hooks/use-api";
import type { ApprovalTask, WorkTask } from "@/types/case";
import type { Supply } from "@/types/supply";
import type { EventRow } from "@/types/task";

export default function WorkPage() {
  const approvals = useApi<ApprovalTask[]>("/approvals");
  const work = useApi<WorkTask[]>("/work");
  const events = useApi<EventRow[]>("/events?limit=50");
  const supply = useApi<Supply>("/supply");

  const reloadAll = () => {
    approvals.reload();
    work.reload();
    events.reload();
    supply.reload();
  };

  const pendingApprovals = approvals.data?.filter((approval) => approval.status === "pending") ?? [];
  const closedApprovals = approvals.data?.filter((approval) => approval.status !== "pending") ?? [];
  const openWorkItems = work.data?.filter((item) => item.status !== "done") ?? [];
  const doneWorkItems = work.data?.filter((item) => item.status === "done") ?? [];

  return (
    <>
      <PageTitle title="승인·작업함" description="승인권자와 각 부서가 자기 할 일을 처리하는 곳입니다. 외부 결재·발주는 보내지 않고 모의 회신으로 처리합니다." />

      <Section title={`승인 대기 ${pendingApprovals.length}건`}>
        {!approvals.data && <LoadingMessage error={approvals.error} />}
        {approvals.data && pendingApprovals.length === 0 && <MutedText>대기 중인 승인이 없습니다.</MutedText>}
        {pendingApprovals.map((approval) => (
          <ApprovalCard key={approval.id} approval={approval} onDone={reloadAll} showCase />
        ))}
      </Section>

      <Section title={`열린 작업 ${openWorkItems.length}건`} description="부서별 후속 작업">
        {!work.data ? <LoadingMessage error={work.error} /> : <WorkItemList items={openWorkItems} onDone={reloadAll} showCase />}
      </Section>

      <Section title="조건 변경 입력" description="공급자 회신처럼 밖에서 들어오는 새 사건을 넣습니다. 끝나지 않은 검토 건이 모두 다시 확인됩니다.">
        {!supply.data ? (
          <LoadingMessage error={supply.error} />
        ) : (
          <ConditionChangeForm
            onDone={reloadAll}
            skuIds={supply.data.skus.filter((sku) => sku.in_transit_qty > 0).map((sku) => sku.sku_id)}
            productLines={supply.data.production_lines}
            purchaseOrderRefs={[...supply.data.source_pos.map((order) => order.po_id), ...supply.data.system_pos.map((order) => `PO-${order.id}`)]}
          />
        )}
      </Section>

      <Section title={`끝난 승인 ${closedApprovals.length}건`}>
        {closedApprovals.length === 0 && <MutedText>없음</MutedText>}
        {closedApprovals.map((approval) => (
          <ApprovalCard key={approval.id} approval={approval} onDone={reloadAll} showCase />
        ))}
      </Section>

      <Section title={`끝난 작업 ${doneWorkItems.length}건`}>
        <WorkItemList items={doneWorkItems} onDone={reloadAll} showCase />
      </Section>

      <Section title="전체 처리 이력 (최근 50건)">{events.data ? <EventList events={events.data} showCase /> : <LoadingMessage error={events.error} />}</Section>
    </>
  );
}
