"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { Empty, Facts, Field, Loading, PageTitle, Section, Src, Status, inputClass } from "@/components/ops/basic";
import { ActionError, ApprovalBox, ChangeForm, EventList, WeekTable, WorkList, useAction } from "@/components/ops/parts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { post } from "@/lib/api";
import { CASE_STATUS, DECISION, NEXT_STEP, PO_STATUS, krw, qty, won } from "@/lib/format";
import type { CaseDetail, Check, Judgment, Option } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const CAN_REQUEST = ["received", "info_needed", "checked", "judged", "rejected", "conditional", "recheck_needed"];

export default function Page() {
  // 정적 내보내기에서는 주소의 ?id= 를 읽는 부분을 Suspense 로 감싸야 한다.
  return (
    <Suspense fallback={<Loading error={null} />}>
      <CaseDetailView />
    </Suspense>
  );
}

function CaseDetailView() {
  const id = useSearchParams().get("id");
  const { data, error, reload } = useApi<CaseDetail>(id ? `/cases/${id}` : null);

  if (!id) return <Empty>주소에 검토 건 번호(?id=)가 없습니다.</Empty>;
  if (!data) return <Loading error={error} />;

  const c = data.case;
  const check = c.payload.check;
  const canRequest = CAN_REQUEST.includes(c.status);
  const pending = data.approvals.find((a) => a.status === "pending");

  return (
    <>
      <Link className="text-sm underline" href="/cases/">
        ← 검토 건 목록
      </Link>
      <PageTitle title={`#${c.id} ${c.title}`} />
      <Section
        title={
          <span className="flex items-center gap-2">
            현재 상태 <Status tone={["recheck_needed", "rejected", "info_needed"].includes(c.status) ? "warn" : "default"}>{CASE_STATUS[c.status] ?? c.status}</Status>
          </span>
        }
      >
        <p className="text-sm">{NEXT_STEP[c.status]}</p>
      </Section>

      <Section
        title="① 접수 내용"
        description={
          <>
            마케팅팀이 낸 캠페인 계획과 수요 가정 <Src type="claim" />
          </>
        }
      >
        <Facts
          rows={[
            ["기안", check?.plan ? `${check.plan.plan_id} · ${check.plan.campaign_name} (${check.plan.product_line})` : "-"],
            ["캠페인 기간", `${c.payload.start_date} ~ ${c.payload.end_date}`],
            ...(c.payload.previous_schedule
              ? ([["변경 전 기간", `${c.payload.previous_schedule.start_date} ~ ${c.payload.previous_schedule.end_date}`]] as [string, string][])
              : []),
            ["대상 SKU·증가율", c.payload.skus.map((s) => `${s.sku_id} +${s.uplift_pct}%`).join(", ")],
            ["작성자 / 기준시점", `${c.payload.author} / ${c.payload.demand_as_of}`],
            ["요청 예산", check?.plan ? won(check.plan.requested_budget_krw) : "-"],
            ["집행 예정일", check?.plan?.settlement_date ?? "-"],
            ["계약 확정기한", check?.plan ? `${check.plan.contract_deadline} (D-${check.plan.days_to_deadline}) — 지나면 자동 확정` : "-"],
            ["메모", c.payload.note || "-"],
          ]}
        />
      </Section>

      {check && <CheckSection check={check} caseId={c.id} onDone={reload} />}

      <JudgmentSection judgment={c.payload.judgment} caseId={c.id} canJudge={canRequest} onDone={reload} options={check?.options ?? []} />

      {check && (
        <Section title="④ 대안과 승인 상신" description="담당자가 대안을 골라 승인권자에게 올립니다. 승인권자는 규정에 따라 시스템이 정합니다.">
          {c.payload.rejected_options.length > 0 && (
            <p className="text-sm">이전에 거절된 대안: {c.payload.rejected_options.map((r) => `${r.title}${r.note ? ` (${r.note})` : ""}`).join(", ")}</p>
          )}
          {c.payload.conditions.length > 0 && <p className="text-sm">승인권자가 붙인 조건: {c.payload.conditions.map((x) => x.note).join(" / ")}</p>}
          {check.options.map((o) => (
            <OptionCard
              key={o.key}
              option={o}
              caseId={c.id}
              canRequest={canRequest}
              recommended={c.payload.judgment?.recommendation.recommended_option === o.key}
              selected={c.payload.selected_option === o.key}
              onDone={reload}
            />
          ))}
        </Section>
      )}

      <Section title="⑤ 승인 회신" description="외부 결재 시스템 대신, 승인권자 역할로 회신을 넣습니다.">
        {data.approvals.length === 0 && <Empty>아직 상신한 건이 없습니다.</Empty>}
        {pending && <ApprovalBox approval={pending} onDone={reload} />}
        {data.approvals
          .filter((a) => a.status !== "pending")
          .map((a) => (
            <ApprovalBox key={a.id} approval={a} onDone={reload} />
          ))}
      </Section>

      <Section title="⑥ 후속 처리" description="승인·거절·정보 공백에 따라 생긴 부서별 작업과 발주. 작업이 모두 끝나면 검토 건이 완료됩니다.">
        <WorkList items={[...data.work_items].reverse()} onDone={reload} />
        {data.pos.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>발주</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>수량</TableHead>
                <TableHead>금액</TableHead>
                <TableHead>입고예정</TableHead>
                <TableHead>대금 지급일</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.pos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>PO-{p.id}</TableCell>
                  <TableCell>{p.payload.sku_id}</TableCell>
                  <TableCell>{qty(p.payload.qty)}</TableCell>
                  <TableCell>{won(p.payload.amount_krw)}</TableCell>
                  <TableCell>
                    {p.payload.eta} {p.payload.eta_confirmed ? "(회신 확정)" : "(가정)"}
                  </TableCell>
                  <TableCell>{p.payload.payment_due_date}</TableCell>
                  <TableCell>{PO_STATUS[p.status] ?? p.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      {check && (
        <Section title="⑦ 조건 변경 입력" description="공급 지연, 입고예정 회신, 수요 정정 같은 새 사건을 넣어 기존 판단을 다시 검증합니다.">
          <ChangeForm
            onDone={reload}
            caseId={c.id}
            skuIds={check.skus.map((s) => s.sku_id)}
            poRefs={[...new Set(check.skus.flatMap((s) => s.inbound.filter((i) => !i.ref.startsWith("이동중")).map((i) => i.ref)))]}
          />
        </Section>
      )}

      <Section title="⑧ 처리 이력" description="누가 언제 무엇을 했는지">
        <EventList events={data.events} />
      </Section>
    </>
  );
}

// ── ② 확인 결과 ─────────────────────────────────────────────────

function CheckSection({ check, caseId, onDone }: { check: Check; caseId: number; onDone: () => void }) {
  const { busy, error, run } = useAction(onDone);
  return (
    <Section
      title="② 확인 결과"
      description={
        <>
          재고·입고 일정·현금을 캠페인 수요와 맞춰 본 결과 ({check.horizon_weeks}주 전망) <Src type="calculation" />
        </>
      }
    >
      <p className="text-sm font-medium">
        {check.conclusion === "ok" ? "캠페인 기간에 품절이 예상되지 않습니다." : <Status tone="warn">캠페인 기간에 품절이 예상됩니다</Status>}
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>현재고</TableHead>
            <TableHead>평시 주간 수요</TableHead>
            <TableHead>증가율</TableHead>
            <TableHead>MOQ / 리드타임</TableHead>
            <TableHead>평시 품절 주</TableHead>
            <TableHead>캠페인 반영 품절 주</TableHead>
            <TableHead>캠페인 기간 부족</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {check.skus.map((s) => (
            <TableRow key={s.sku_id}>
              <TableCell>
                {s.sku_id} {s.sku_name}
              </TableCell>
              <TableCell>{qty(s.on_hand_qty)}</TableCell>
              <TableCell>{qty(s.avg_weekly_demand_4w)}</TableCell>
              <TableCell>+{s.uplift_pct}%</TableCell>
              <TableCell>
                {qty(s.moq)} / {s.lead_time_weeks}주
              </TableCell>
              <TableCell>{s.baseline_first_stockout_week ?? "없음"}</TableCell>
              <TableCell>{s.campaign_first_stockout_week ?? "없음"}</TableCell>
              <TableCell>{s.shortage_in_campaign_qty ? `${qty(s.shortage_in_campaign_qty)}개` : "없음"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="text-sm">
        <p className="font-medium">입고 예정</p>
        <ul className="mt-1 flex flex-col gap-1">
          {check.skus.flatMap((s) =>
            s.inbound.map((i) => (
              <li key={`${s.sku_id}-${i.ref}`}>
                {s.sku_id} · {i.ref} · {qty(i.qty)}개 · {i.eta ?? "입고일 미확인"} <span className="text-muted-foreground">({i.basis})</span>
              </li>
            )),
          )}
        </ul>
      </div>

      <div className="text-sm">
        <p className="font-medium">정보 공백 {check.info_gaps.length}건</p>
        {check.info_gaps.length === 0 && <p className="text-muted-foreground">없음</p>}
        <ul className="mt-1 flex flex-col gap-1">
          {check.info_gaps.map((g) => (
            <li key={g.key}>
              {g.material ? <Status tone="warn">판단에 영향</Status> : <Status tone="muted">영향 없음</Status>} {g.message} → {g.next_action}
            </li>
          ))}
        </ul>
      </div>

      <div className="text-sm">
        <p className="font-medium">현금 약정</p>
        <p>
          전망 최저 잔액 {krw(check.cash.min_closing_krw)} ({check.cash.min_date}) · 30억 하회 예상 구간:{" "}
          {check.cash.breach_windows.length ? check.cash.breach_windows.map((w) => `${w.start} ~ ${w.end}`).join(", ") : "없음"}
        </p>
        <p className="text-muted-foreground">이 구간에 현금이 나가는 신규 약정은 금액·종류와 무관하게 그룹 CEO 승인입니다.</p>
      </div>

      {check.skus.map((s) => (
        <details key={s.sku_id} className="text-sm">
          <summary className="cursor-pointer font-medium">{s.sku_id} 주간 전망 펼치기</summary>
          <WeekTable rows={s.rows} />
        </details>
      ))}

      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={busy} onClick={() => run(() => post(`/cases/${caseId}/check`))}>
          지금 상태로 다시 확인
        </Button>
      </div>
      <ActionError error={error} />
    </Section>
  );
}

// ── ③ AI 판단 ───────────────────────────────────────────────────

function JudgmentSection({
  judgment,
  caseId,
  canJudge,
  onDone,
  options,
}: {
  judgment?: Judgment;
  caseId: number;
  canJudge: boolean;
  onDone: () => void;
  options: Option[];
}) {
  const { busy, error, run } = useAction(onDone);
  const rec = judgment?.recommendation;
  const recommended = options.find((o) => o.key === rec?.recommended_option);

  return (
    <Section title="③ AI 판단" description="계산 결과와 규정을 읽고 어떤 대안으로 올릴지 초안을 씁니다. 결정은 사람이 합니다.">
      {!judgment && <Empty>아직 판단을 받지 않았습니다.</Empty>}
      {judgment && rec && (
        <>
          <Facts
            rows={[
              ["판단 주체", judgment.source === "ai" ? `AI (${judgment.model})` : "규칙 기반 예비 판단 (AI 미연결)"],
              ["결론", DECISION[rec.decision] ?? rec.decision],
              ["권고 대안", recommended ? recommended.title : "없음"],
              ["승인권자", rec.required_approver],
              ["확신 정도", rec.confidence],
            ]}
          />
          <p className="text-sm">{rec.summary}</p>
          {judgment.error && <p className="text-sm text-muted-foreground">AI 를 쓰지 못한 이유: {judgment.error}</p>}

          <div className="text-sm">
            <p className="font-medium">근거</p>
            <ul className="mt-1 flex flex-col gap-1">
              {rec.evidence.map((e, i) => (
                <li key={i}>
                  <Src type={e.source_type} /> {e.statement} <span className="text-muted-foreground">({e.source_ref})</span>
                </li>
              ))}
            </ul>
          </div>
          {rec.alternatives.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">대안별 영향</p>
              <ul className="mt-1 flex flex-col gap-1">
                {rec.alternatives.map((a, i) => (
                  <li key={i}>
                    {a.option} — {a.tradeoff}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {rec.missing_info.length > 0 && (
            <div className="text-sm">
              <p className="font-medium">확인되지 않은 정보</p>
              <ul className="mt-1 list-disc pl-5">
                {rec.missing_info.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {canJudge && (
        <div className="flex items-center gap-2">
          <Button disabled={busy} onClick={() => run(() => post(`/cases/${caseId}/judge`))}>
            {busy ? "판단 받는 중… (1~2분 걸릴 수 있습니다)" : judgment ? "AI 판단 다시 받기" : "AI 판단 받기"}
          </Button>
        </div>
      )}
      <ActionError error={error} />
    </Section>
  );
}

// ── ④ 대안 ──────────────────────────────────────────────────────

function OptionCard({
  option: o,
  caseId,
  canRequest,
  recommended,
  selected,
  onDone,
}: {
  option: Option;
  caseId: number;
  canRequest: boolean;
  recommended: boolean;
  selected: boolean;
  onDone: () => void;
}) {
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction(onDone);
  const d = o.details;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{o.title}</span>
        {!o.applicable ? <Status tone="muted">해당 없음</Status> : o.feasible ? <Status>가능</Status> : <Status tone="warn">한계 있음</Status>}
        {recommended && <Status>AI 권고</Status>}
        {selected && <Status tone="muted">상신한 대안</Status>}
      </div>
      <p>{o.summary}</p>

      {o.applicable && (
        <>
          {d.lines && (
            <ul className="flex flex-col gap-1">
              {d.lines.map((l) => (
                <li key={l.sku_id}>
                  {l.sku_id} {qty(l.qty)}개 (MOQ {qty(l.moq)}) · {won(l.amount_krw)} · 입고예정 {l.eta} {l.arrives_before_stockout ? "" : "— 품절 시점보다 늦음"} · 지급일 {l.payment_due_date}
                </li>
              ))}
              <li>
                전망 최저 잔액 {krw(d.cash_min_before_krw)} → {krw(d.cash_min_after_krw)}
                {d.payment_in_breach_window ? " · 지급일이 30억 하회 예상 구간 안" : ""}
              </li>
            </ul>
          )}
          {d.new_start_date && (
            <p>
              변경 기간: {d.new_start_date} ~ {d.new_end_date}
            </p>
          )}
          <p className="text-muted-foreground">
            승인권자: <span className="font-medium text-foreground">{o.route.approver}</span> — {o.route.rule} <Src type={o.route.source_type} />
          </p>
          {o.affected_depts.length > 0 && (
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {o.affected_depts.map((a) => (
                <li key={a.dept}>
                  <span className="font-medium text-foreground">[{a.dept}]</span> {a.impact}
                </li>
              ))}
            </ul>
          )}
          {canRequest && (
            <div className="flex flex-wrap items-end gap-2">
              <Field label="상신 메모">
                <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="선택 이유" />
              </Field>
              <Button disabled={busy} variant={o.feasible ? "default" : "outline"} onClick={() => run(() => post(`/cases/${caseId}/approval`, { option_key: o.key, note }))}>
                이 대안으로 {o.route.approver}에 상신
              </Button>
            </div>
          )}
          <ActionError error={error} />
        </>
      )}
    </div>
  );
}
