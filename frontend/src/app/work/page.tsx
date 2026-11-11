"use client";

import { Empty, Loading, PageTitle, Section } from "@/components/ops/basic";
import { ApprovalBox, ChangeForm, EventList, WorkList } from "@/components/ops/parts";
import type { ApprovalTask, EventRow, Supply, WorkTask } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function WorkPage() {
  const approvals = useApi<ApprovalTask[]>("/approvals");
  const work = useApi<WorkTask[]>("/work");
  const events = useApi<EventRow[]>("/events?limit=50");
  const supply = useApi<Supply>("/supply");

  const reload = () => {
    approvals.reload();
    work.reload();
    events.reload();
    supply.reload();
  };

  const pending = approvals.data?.filter((a) => a.status === "pending") ?? [];
  const closed = approvals.data?.filter((a) => a.status !== "pending") ?? [];
  const open = work.data?.filter((w) => w.status !== "done") ?? [];
  const done = work.data?.filter((w) => w.status === "done") ?? [];

  return (
    <>
      <PageTitle title="승인·작업함" description="승인권자와 각 부서가 자기 할 일을 처리하는 곳입니다. 외부 결재·발주는 보내지 않고 모의 회신으로 처리합니다." />

      <Section title={`승인 대기 ${pending.length}건`}>
        {!approvals.data && <Loading error={approvals.error} />}
        {approvals.data && pending.length === 0 && <Empty>대기 중인 승인이 없습니다.</Empty>}
        {pending.map((a) => (
          <ApprovalBox key={a.id} approval={a} onDone={reload} showCase />
        ))}
      </Section>

      <Section title={`열린 작업 ${open.length}건`} description="부서별 후속 작업">
        {!work.data ? <Loading error={work.error} /> : <WorkList items={open} onDone={reload} showCase />}
      </Section>

      <Section title="조건 변경 입력" description="공급자 회신처럼 밖에서 들어오는 새 사건을 넣습니다. 끝나지 않은 검토 건이 모두 다시 확인됩니다.">
        {!supply.data ? (
          <Loading error={supply.error} />
        ) : (
          <ChangeForm
            onDone={reload}
            skuIds={supply.data.skus.filter((s) => s.in_transit_qty > 0).map((s) => s.sku_id)}
            poRefs={[...supply.data.source_pos.map((p) => p.po_id), ...supply.data.system_pos.map((p) => `PO-${p.id}`)]}
          />
        )}
      </Section>

      <Section title={`끝난 승인 ${closed.length}건`}>
        {closed.length === 0 && <Empty>없음</Empty>}
        {closed.map((a) => (
          <ApprovalBox key={a.id} approval={a} onDone={reload} showCase />
        ))}
      </Section>

      <Section title={`끝난 작업 ${done.length}건`}>
        <WorkList items={done} onDone={reload} showCase />
      </Section>

      <Section title="전체 처리 이력 (최근 50건)">{events.data ? <EventList events={events.data} showCase /> : <Loading error={events.error} />}</Section>
    </>
  );
}
