"use client";

// 새 캠페인 검토 접수 양식.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorText } from "@/components/common/error-text";
import { FactList } from "@/components/common/fact-list";
import { FormField, TextInput, inputClassName } from "@/components/common/form-field";
import { Section } from "@/components/common/section";
import { SourceBadge } from "@/components/common/source-badge";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { postApi } from "@/lib/api-client";
import { formatWon } from "@/lib/format";
import type { CaseTask, Plan } from "@/types/case";
import type { Supply } from "@/types/supply";

/** 기안의 후보 SKU 에 기본 증가율 30% 를 채운다. */
const getDefaultUplift = (plan: Plan) => Object.fromEntries(plan.candidate_skus.map((sku) => [sku.sku_id, "30"]));

export function NewCaseForm({ plans, supply }: { plans: Plan[]; supply: Supply }) {
  const router = useRouter();
  const sortedPlans = [...plans].sort((a, b) => a.days_to_deadline - b.days_to_deadline || a.plan_id.localeCompare(b.plan_id));
  const [planId, setPlanId] = useState(sortedPlans[0].plan_id);
  const [startDate, setStartDate] = useState("2026-07-20");
  const [endDate, setEndDate] = useState("2026-08-16");
  const [author, setAuthor] = useState("마케팅팀");
  const [note, setNote] = useState("");
  // SKU 별 수요 증가율. 비어 있으면 대상이 아니다.
  const [upliftBySku, setUpliftBySku] = useState<Record<string, string>>(() => getDefaultUplift(sortedPlans[0]));
  const { busy, error, run } = useAction(() => undefined);
  const plan = sortedPlans.find((candidate) => candidate.plan_id === planId)!;

  const choosePlan = (nextPlanId: string) => {
    setPlanId(nextPlanId);
    setUpliftBySku(getDefaultUplift(sortedPlans.find((candidate) => candidate.plan_id === nextPlanId)!));
  };

  const skuLines = Object.entries(upliftBySku)
    .filter(([, value]) => value !== "")
    .map(([skuId, value]) => ({ sku_id: skuId, uplift_pct: Number(value) }));

  const submit = () =>
    run(async () => {
      const created = await postApi<CaseTask>("/cases", { plan_id: planId, start_date: startDate, end_date: endDate, skus: skuLines, author, note });
      router.push(`/cases/detail/?id=${created.id}`);
    });

  return (
    <Section title="새 검토 접수" description="캠페인 기간과 수요 증가율은 원본에 없어 마케팅팀이 직접 냅니다" sourceType="claim">
      <FormField label="캠페인 확대 기안 (계약 확정기한이 가까운 순)">
        <select className={inputClassName} value={planId} onChange={(event) => choosePlan(event.target.value)}>
          {sortedPlans.map((candidate) => (
            <option key={candidate.plan_id} value={candidate.plan_id}>
              {candidate.plan_id} · {candidate.campaign_name} · {candidate.product_line} · 확정기한 {candidate.contract_deadline} (D-{candidate.days_to_deadline})
            </option>
          ))}
        </select>
      </FormField>
      <FactList
        rows={[
          ["상품군 / 채널", `${plan.product_line} / ${plan.sales_channel} (${plan.country})`],
          ["요청 예산", formatWon(plan.requested_budget_krw)],
          [
            "예상 GMV",
            <span key="gmv" className="flex items-center gap-2">
              {formatWon(plan.expected_gmv_krw)} <SourceBadge type="claim" />
            </span>,
          ],
          ["집행 예정일", plan.settlement_date],
          ["계약 확정기한", `${plan.contract_deadline} (D-${plan.days_to_deadline})`],
        ]}
      />

      <div className="form-row">
        <FormField label="캠페인 시작일">
          <TextInput type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </FormField>
        <FormField label="캠페인 종료일">
          <TextInput type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </FormField>
        <FormField label="작성자">
          <TextInput value={author} onChange={(event) => setAuthor(event.target.value)} />
        </FormField>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground">
          대상 SKU 와 수요 증가율(평시 주간 판매 대비 %). 비워 두면 대상에서 빠집니다. 기안의 상품군과 같은 분류의 SKU 를 먼저 채워 뒀습니다 <SourceBadge type="assumption" />
        </p>
        <div className="case-form-sku-grid">
          {supply.skus.map((sku) => (
            <label key={sku.sku_id} className="flex items-center gap-2">
              <TextInput
                type="number"
                min={0}
                className="w-20"
                value={upliftBySku[sku.sku_id] ?? ""}
                placeholder="-"
                onChange={(event) => setUpliftBySku({ ...upliftBySku, [sku.sku_id]: event.target.value })}
              />
              <span>
                {sku.sku_id} {sku.sku_name}{" "}
                <span className="text-muted-foreground">
                  · {sku.category} · 커버 {sku.cover_weeks}주
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <FormField label="메모">
        <TextInput value={note} onChange={(event) => setNote(event.target.value)} placeholder="수요 가정의 근거 등" />
      </FormField>
      <div className="flex items-center gap-2">
        <Button disabled={busy || skuLines.length === 0} onClick={submit}>
          접수하고 확인 시작
        </Button>
        {skuLines.length === 0 && <span className="text-muted-foreground">대상 SKU 를 하나 이상 넣어 주세요.</span>}
      </div>
      <ErrorText error={error} />
    </Section>
  );
}
