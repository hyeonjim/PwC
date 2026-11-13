"use client";

// 승인 한 건과 모의 회신(승인·조건부 승인·거절) 입력.
import { useState } from "react";

import { BorderedBox } from "@/components/common/bordered-box";
import { ErrorText } from "@/components/common/error-text";
import { FormField, TextInput } from "@/components/common/form-field";
import { SourceBadge } from "@/components/common/source-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { TextLink } from "@/components/common/text-link";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { postApi } from "@/lib/api-client";
import { APPROVAL_STATUS_LABEL, APPROVAL_STATUS_TONE } from "@/lib/labels";
import type { ApprovalTask } from "@/types/case";

export function ApprovalCard({ approval, onDone, showCase = false }: { approval: ApprovalTask; onDone: () => void; showCase?: boolean }) {
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction(onDone);
  const reply = (decision: string) => run(() => postApi(`/approvals/${approval.id}/reply`, { decision, note }));
  const payload = approval.payload;

  return (
    <BorderedBox className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={APPROVAL_STATUS_TONE[approval.status]}>{APPROVAL_STATUS_LABEL[approval.status] ?? approval.status}</StatusBadge>
        <span className="font-medium">
          승인권자: {payload.approver} · 대안: {payload.option.title}
        </span>
        {showCase && <TextLink href={`/cases/detail/?id=${payload.case_id}`}>검토 건 #{payload.case_id}</TextLink>}
      </div>
      <p className="text-muted-foreground">
        적용 규정: {payload.rule} <SourceBadge type={payload.option.route.source_type} />
      </p>
      <p>{payload.option.summary}</p>
      {payload.note && <p className="text-muted-foreground">상신 메모: {payload.note}</p>}
      {approval.status === "pending" && (
        <>
          <FormField label="회신 메모 (거절 사유·조건)">
            <TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="예: 하회 구간 신규 약정 불가" />
          </FormField>
          <div className="approval-actions">
            <Button disabled={busy} onClick={() => reply("approve")}>
              승인
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => reply("conditional")}>
              조건부 승인
            </Button>
            <Button disabled={busy} variant="destructive" onClick={() => reply("reject")}>
              거절
            </Button>
            <SourceBadge type="mock" />
            <span className="text-muted-foreground">실제 결재가 아니라 승인권자 역할로 넣는 모의 회신입니다.</span>
          </div>
          <ErrorText error={error} />
        </>
      )}
    </BorderedBox>
  );
}
