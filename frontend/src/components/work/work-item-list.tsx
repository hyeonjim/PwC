"use client";

// 부서별 후속 작업 목록과 시작·완료 처리.
import { ErrorText } from "@/components/common/error-text";
import { MutedText } from "@/components/common/muted-text";
import { StatusBadge } from "@/components/common/status-badge";
import { TextLink } from "@/components/common/text-link";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { postApi } from "@/lib/api-client";
import { WORK_STATUS_LABEL } from "@/lib/labels";
import type { WorkTask } from "@/types/case";

export function WorkItemList({ items, onDone, showCase = false }: { items: WorkTask[]; onDone: () => void; showCase?: boolean }) {
  const { busy, error, run } = useAction(onDone);
  const changeStatus = (workId: number, status: string) => run(() => postApi(`/work/${workId}/status`, { status }));

  if (items.length === 0) return <MutedText>작업이 없습니다.</MutedText>;
  return (
    <div className="flex flex-col gap-2">
      {items.map((work) => (
        <div key={work.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-base">
          <StatusBadge tone={work.status === "done" ? "muted" : "default"}>{WORK_STATUS_LABEL[work.status] ?? work.status}</StatusBadge>
          <span className="font-medium">[{work.payload.dept}]</span>
          <span className="flex-1">{work.title}</span>
          {showCase && <TextLink href={`/cases/detail/?id=${work.payload.case_id}`}>#{work.payload.case_id}</TextLink>}
          {work.status === "open" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus(work.id, "in_progress")}>
              시작
            </Button>
          )}
          {work.status !== "done" && (
            <Button size="sm" disabled={busy} onClick={() => changeStatus(work.id, "done")}>
              완료 처리
            </Button>
          )}
        </div>
      ))}
      <ErrorText error={error} />
    </div>
  );
}
