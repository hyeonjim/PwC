"use client";

// 대안 한 장: 내용, Corevia 생산 여력(추가 발주), 승인권자, 영향 부서, 상신 버튼.
import { useState } from "react";

import { ErrorText } from "@/components/common/error-text";
import { FormField, TextInput } from "@/components/common/form-field";
import { SourceBadge } from "@/components/common/source-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { TextList } from "@/components/common/text-list";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { postApi } from "@/lib/api-client";
import { formatHundredMillionWon, formatPeriod, formatQuantity, formatWon } from "@/lib/format";
import type { Option } from "@/types/case";

type OptionCardProps = {
  option: Option;
  caseId: number;
  canRequest: boolean;
  recommended: boolean;
  selected: boolean;
  onDone: () => void;
};

export function OptionCard({ option, caseId, canRequest, recommended, selected, onDone }: OptionCardProps) {
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction(onDone);
  const details = option.details;
  const requestApproval = () => run(() => postApi(`/cases/${caseId}/approval`, { option_key: option.key, note }));
  const capacity = details.capacity;
  const blockedReason =
    capacity?.status === "needs_confirmation"
      ? "Corevia 생산계획팀의 생산 가능 수량 회신을 받은 뒤 상신할 수 있습니다."
      : option.key === "extra_po" && details.lines?.length === 0
        ? "Corevia 회신 수량으로는 낼 수 있는 발주가 없습니다."
        : null;

  return (
    <div className="option-card" data-recommended={recommended}>
      <div className="option-card-header">
        <h3 className="option-card-title">{option.title}</h3>
        {!option.applicable ? (
          <StatusBadge tone="muted">해당 없음</StatusBadge>
        ) : option.feasible ? (
          <StatusBadge tone="success">가능</StatusBadge>
        ) : (
          <StatusBadge tone="warn">한계 있음</StatusBadge>
        )}
        {recommended && <StatusBadge tone="accent">AI 권고</StatusBadge>}
        {selected && <StatusBadge tone="muted">상신한 대안</StatusBadge>}
      </div>
      <p>{option.summary}</p>

      {option.applicable && (
        <>
          {details.lines && (
            <TextList>
              {details.lines.map((line) => (
                <li key={line.sku_id}>
                  {line.sku_id} {formatQuantity(line.qty)}개 (MOQ {formatQuantity(line.moq)}) · {formatWon(line.amount_krw)} · 입고예정 {line.eta}{" "}
                  {line.arrives_before_stockout ? "" : "— 품절 시점보다 늦음"} · 지급일 {line.payment_due_date}
                </li>
              ))}
              <li>
                전망 최저 잔액 {formatHundredMillionWon(details.cash_min_before_krw)} → {formatHundredMillionWon(details.cash_min_after_krw)}
                {details.payment_in_breach_window ? " · 지급일이 30억 하회 예상 구간 안" : ""}
              </li>
            </TextList>
          )}
          {capacity && (
            <div className="flex flex-col gap-2">
              <p className="sub-title">
                Corevia 생산 여력 <SourceBadge type="calculation" />
              </p>
              <TextList>
                {capacity.lines.map((line) => (
                  <li key={line.product_id}>
                    {line.ok ? <StatusBadge tone="success">여력 안</StatusBadge> : <StatusBadge tone="warn">여력 초과</StatusBadge>} {line.product_name} 라인({line.plant_id} {line.line_id}) ·{" "}
                    {line.window_weeks}주 여력 {formatQuantity(line.remaining_qty)}개 / 필요 {formatQuantity(line.required_qty)}개{" "}
                    <span className="text-muted-foreground">
                      ({line.basis === "corevia_reply" ? "Corevia 회신" : `가동률 ${line.utilization_pct}% 기준 추정`}
                      {line.already_committed_qty ? `, 승인된 추가 발주 ${formatQuantity(line.already_committed_qty)}개 차감` : ""})
                    </span>{" "}
                    <SourceBadge type={line.basis === "corevia_reply" ? "mock" : "assumption"} />
                  </li>
                ))}
              </TextList>
              {details.without_capacity_check && (
                <p className="text-muted-foreground">
                  생산 여력을 보지 않았다면: {formatQuantity(details.without_capacity_check.qty)}개 발주로{" "}
                  {details.without_capacity_check.feasible
                    ? "품절을 막을 수 있다고(가능) 판단했을 것입니다."
                    : `캠페인 기간 부족 ${formatQuantity(details.without_capacity_check.residual_shortage_in_campaign_qty)}개가 남는다고 판단했을 것입니다.`}
                </p>
              )}
            </div>
          )}
          {details.new_start_date && <p>변경 기간: {formatPeriod(details.new_start_date, details.new_end_date)}</p>}
          <p className="text-muted-foreground">
            승인권자: <span className="font-medium text-foreground">{option.route.approver}</span> — {option.route.rule} <SourceBadge type={option.route.source_type} />
          </p>
          {option.affected_depts.length > 0 && (
            <TextList className="text-muted-foreground">
              {option.affected_depts.map((affected) => (
                <li key={affected.dept}>
                  <span className="font-medium text-foreground">[{affected.dept}]</span> {affected.impact}
                </li>
              ))}
            </TextList>
          )}
          {canRequest && (
            <div className="form-row">
              <FormField label="상신 메모">
                <TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="선택 이유" />
              </FormField>
              <Button disabled={busy || blockedReason !== null} variant={recommended ? "default" : "outline"} onClick={requestApproval}>
                이 대안으로 {option.route.approver}에 상신
              </Button>
              {blockedReason && <p className="text-muted-foreground">{blockedReason}</p>}
            </div>
          )}
          <ErrorText error={error} />
        </>
      )}
    </div>
  );
}
