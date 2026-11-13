"use client";

// 확인 결과: 재고·입고 일정·현금을 캠페인 수요와 맞춰 본 결과.
import { ErrorText } from "@/components/common/error-text";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { SubSection } from "@/components/common/sub-section";
import { TableHeaderRow } from "@/components/common/table-header-row";
import { TextList } from "@/components/common/text-list";
import { WeeklyProjectionTable } from "@/components/supply/weekly-projection-table";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useAction } from "@/hooks/use-action";
import { postApi } from "@/lib/api-client";
import { formatHundredMillionWon, formatPeriod, formatQuantity } from "@/lib/format";
import type { Check } from "@/types/case";

const SKU_COLUMNS = ["SKU", "현재고", "평시 주간 수요", "증가율", "MOQ / 리드타임", "평시 품절 주", "캠페인 반영 품절 주", "캠페인 기간 부족"];

export function CheckResultSection({ check, caseId, onDone }: { check: Check; caseId: number; onDone: () => void }) {
  const { busy, error, run } = useAction(onDone);
  const breachText = check.cash.breach_windows.length
    ? check.cash.breach_windows.map((breachWindow) => formatPeriod(breachWindow.start, breachWindow.end)).join(", ")
    : "없음";

  return (
    <Section title="확인 결과" description={`재고·입고 일정·현금을 캠페인 수요와 맞춰 본 결과 (${check.horizon_weeks}주 전망)`} sourceType="calculation">
      <p className="font-medium">
        {check.conclusion === "ok" ? "캠페인 기간에 품절이 예상되지 않습니다." : <StatusBadge tone="warn">캠페인 기간에 품절이 예상됩니다</StatusBadge>}
      </p>

      <Table>
        <TableHeaderRow columns={SKU_COLUMNS} numericColumns={[1, 2, 3, 7]} />
        <TableBody>
          {check.skus.map((sku) => (
            <TableRow key={sku.sku_id}>
              <TableCell>
                {sku.sku_id} {sku.sku_name}
              </TableCell>
              <TableCell className="table-number">{formatQuantity(sku.on_hand_qty)}</TableCell>
              <TableCell className="table-number">{formatQuantity(sku.avg_weekly_demand_4w)}</TableCell>
              <TableCell className="table-number">+{sku.uplift_pct}%</TableCell>
              <TableCell>
                {formatQuantity(sku.moq)} / {sku.lead_time_weeks}주
              </TableCell>
              <TableCell>{sku.baseline_first_stockout_week ?? "없음"}</TableCell>
              <TableCell>{sku.campaign_first_stockout_week ?? "없음"}</TableCell>
              <TableCell className="table-number">{sku.shortage_in_campaign_qty ? `${formatQuantity(sku.shortage_in_campaign_qty)}개` : "없음"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <SubSection title="입고 예정">
        <TextList>
          {check.skus.flatMap((sku) =>
            sku.inbound.map((inbound) => (
              <li key={`${sku.sku_id}-${inbound.ref}`}>
                {sku.sku_id} · {inbound.ref} · {formatQuantity(inbound.qty)}개 · {inbound.eta ?? "입고일 미확인"}{" "}
                <span className="text-muted-foreground">({inbound.basis})</span>
              </li>
            )),
          )}
        </TextList>
      </SubSection>

      <SubSection title={`정보 공백 ${check.info_gaps.length}건`}>
        {check.info_gaps.length === 0 && <p className="text-muted-foreground">없음</p>}
        <TextList>
          {check.info_gaps.map((gap) => (
            <li key={gap.key}>
              {gap.material ? <StatusBadge tone="warn">판단에 영향</StatusBadge> : <StatusBadge tone="muted">영향 없음</StatusBadge>} {gap.message} → {gap.next_action}
            </li>
          ))}
        </TextList>
      </SubSection>

      <SubSection title="현금 약정">
        <p>
          전망 최저 잔액 {formatHundredMillionWon(check.cash.min_closing_krw)} ({check.cash.min_date}) · 30억 하회 예상 구간: {breachText}
        </p>
        <p className="text-muted-foreground">이 구간에 현금이 나가는 신규 약정은 금액·종류와 무관하게 그룹 CEO 승인입니다.</p>
      </SubSection>

      {check.skus.map((sku) => (
        <details key={sku.sku_id} className="projection-details">
          <summary>{sku.sku_id} 주간 전망 펼치기</summary>
          <WeeklyProjectionTable rows={sku.rows} />
        </details>
      ))}

      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={busy} onClick={() => run(() => postApi(`/cases/${caseId}/check`))}>
          지금 상태로 다시 확인
        </Button>
      </div>
      <ErrorText error={error} />
    </Section>
  );
}
