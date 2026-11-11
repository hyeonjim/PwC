"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Empty, Facts, Field, Loading, PageTitle, Section, Src, Status, inputClass } from "@/components/ops/basic";
import { ActionError, useAction } from "@/components/ops/parts";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/api";
import { CASE_STATUS, qty, won } from "@/lib/format";
import type { CaseTask, Plan, Supply } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function CasesPage() {
  const cases = useApi<CaseTask[]>("/cases");
  const plans = useApi<Plan[]>("/plans");
  const supply = useApi<Supply>("/supply");

  return (
    <>
      <PageTitle
        title="캠페인 검토"
        description="마케팅팀이 캠페인 계획과 수요 가정을 내면, 시스템이 재고·입고·현금을 확인하고 대안을 만듭니다."
      />

      <Section title="검토 건 목록">
        {!cases.data && <Loading error={cases.error} />}
        {cases.data?.length === 0 && <Empty>아직 접수된 검토 건이 없습니다. 아래에서 접수하세요.</Empty>}
        {cases.data?.map((c) => (
          <Link key={c.id} href={`/cases/detail/?id=${c.id}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm hover:bg-muted">
            <span className="text-muted-foreground">#{c.id}</span>
            <Status tone={["recheck_needed", "rejected", "info_needed"].includes(c.status) ? "warn" : c.status === "done" ? "muted" : "default"}>
              {CASE_STATUS[c.status] ?? c.status}
            </Status>
            <span className="font-medium">{c.title}</span>
            <span className="text-muted-foreground">
              {c.payload.skus.map((s) => `${s.sku_id} +${s.uplift_pct}%`).join(", ")} · 캠페인 기간 부족 {qty(c.payload.shortage_in_campaign_qty)}개
              {c.payload.info_gap_count ? ` · 정보 공백 ${c.payload.info_gap_count}건` : ""}
            </span>
          </Link>
        ))}
      </Section>

      {plans.data && supply.data ? (
        <NewCaseForm plans={plans.data} supply={supply.data} />
      ) : (
        <Loading error={plans.error ?? supply.error} />
      )}
    </>
  );
}

function NewCaseForm({ plans, supply }: { plans: Plan[]; supply: Supply }) {
  const router = useRouter();
  const sorted = [...plans].sort((a, b) => a.days_to_deadline - b.days_to_deadline || a.plan_id.localeCompare(b.plan_id));
  const [planId, setPlanId] = useState(sorted[0].plan_id);
  const [start, setStart] = useState("2026-07-20");
  const [end, setEnd] = useState("2026-08-16");
  const [author, setAuthor] = useState("마케팅팀");
  const [note, setNote] = useState("");
  // SKU 별 수요 증가율. 비어 있으면 대상이 아니다.
  const plan = sorted.find((p) => p.plan_id === planId)!;
  const defaults = (p: Plan) => Object.fromEntries(p.candidate_skus.map((s) => [s.sku_id, "30"]));
  const [uplift, setUplift] = useState<Record<string, string>>(() => defaults(sorted[0]));
  const { busy, error, run } = useAction(() => undefined);

  const choosePlan = (id: string) => {
    setPlanId(id);
    setUplift(defaults(sorted.find((p) => p.plan_id === id)!));
  };

  const lines = Object.entries(uplift)
    .filter(([, v]) => v !== "")
    .map(([sku_id, v]) => ({ sku_id, uplift_pct: Number(v) }));

  const submit = () =>
    run(async () => {
      const created = await post<CaseTask>("/cases", { plan_id: planId, start_date: start, end_date: end, skus: lines, author, note });
      router.push(`/cases/detail/?id=${created.id}`);
    });

  return (
    <Section
      title="새 검토 접수"
      description={
        <>
          캠페인 기간과 수요 증가율은 원본에 없어 마케팅팀이 직접 냅니다 <Src type="claim" />
        </>
      }
    >
      <Field label="캠페인 확대 기안 (계약 확정기한이 가까운 순)">
        <select className={inputClass} value={planId} onChange={(e) => choosePlan(e.target.value)}>
          {sorted.map((p) => (
            <option key={p.plan_id} value={p.plan_id}>
              {p.plan_id} · {p.campaign_name} · {p.product_line} · 확정기한 {p.contract_deadline} (D-{p.days_to_deadline})
            </option>
          ))}
        </select>
      </Field>
      <Facts
        rows={[
          ["상품군 / 채널", `${plan.product_line} / ${plan.sales_channel} (${plan.country})`],
          ["요청 예산", won(plan.requested_budget_krw)],
          [
            "예상 GMV",
            <span key="g" className="flex items-center gap-2">
              {won(plan.expected_gmv_krw)} <Src type="claim" />
            </span>,
          ],
          ["집행 예정일", plan.settlement_date],
          ["계약 확정기한", `${plan.contract_deadline} (D-${plan.days_to_deadline})`],
        ]}
      />

      <div className="flex flex-wrap gap-3">
        <Field label="캠페인 시작일">
          <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="캠페인 종료일">
          <input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="작성자">
          <input className={inputClass} value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted-foreground">
          대상 SKU 와 수요 증가율(평시 주간 판매 대비 %). 비워 두면 대상에서 빠집니다. 기안의 상품군과 같은 분류의 SKU 를 먼저 채워 뒀습니다 <Src type="assumption" />
        </p>
        <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
          {supply.skus.map((s) => (
            <label key={s.sku_id} className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                className={`${inputClass} w-20`}
                value={uplift[s.sku_id] ?? ""}
                placeholder="-"
                onChange={(e) => setUplift({ ...uplift, [s.sku_id]: e.target.value })}
              />
              <span>
                {s.sku_id} {s.sku_name} <span className="text-muted-foreground">· {s.category} · 커버 {s.cover_weeks}주</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <Field label="메모">
        <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="수요 가정의 근거 등" />
      </Field>
      <div className="flex items-center gap-2">
        <Button disabled={busy || lines.length === 0} onClick={submit}>
          접수하고 확인 시작
        </Button>
        {lines.length === 0 && <span className="text-sm text-muted-foreground">대상 SKU 를 하나 이상 넣어 주세요.</span>}
      </div>
      <ActionError error={error} />
    </Section>
  );
}
