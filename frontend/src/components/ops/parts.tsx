"use client";

// 여러 화면에서 같이 쓰는 업무 조각: 승인 회신, 작업 목록, 조건 변경 입력, 주간 전망 표, 처리 이력.
import Link from "next/link";
import { useState } from "react";

import { Empty, Field, Src, Status, inputClass } from "@/components/ops/basic";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorText, post } from "@/lib/api";
import { APPROVAL_STATUS, FLAG, WORK_STATUS, qty, time } from "@/lib/format";
import type { ApprovalTask, EventRow, WeekRow, WorkTask } from "@/lib/types";

/** 버튼을 누르면 API 를 부르고, 끝나면 화면을 다시 불러온다. */
export function useAction(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

export function ActionError({ error }: { error: string | null }) {
  return error ? <p className="text-sm text-destructive">{error}</p> : null;
}

// ── 승인 회신 (모의) ─────────────────────────────────────────────

export function ApprovalBox({ approval, onDone, showCase = false }: { approval: ApprovalTask; onDone: () => void; showCase?: boolean }) {
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction(onDone);
  const reply = (decision: string) => run(() => post(`/approvals/${approval.id}/reply`, { decision, note }));
  const p = approval.payload;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Status tone={approval.status === "pending" ? "default" : "muted"}>{APPROVAL_STATUS[approval.status] ?? approval.status}</Status>
        <span className="font-medium">
          승인권자: {p.approver} · 대안: {p.option.title}
        </span>
        {showCase && (
          <Link className="underline" href={`/cases/detail/?id=${p.case_id}`}>
            검토 건 #{p.case_id}
          </Link>
        )}
      </div>
      <p className="text-muted-foreground">
        적용 규정: {p.rule} <Src type={p.option.route.source_type} />
      </p>
      <p>{p.option.summary}</p>
      {p.note && <p className="text-muted-foreground">상신 메모: {p.note}</p>}
      {approval.status === "pending" && (
        <>
          <Field label="회신 메모 (거절 사유·조건)">
            <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="예: 하회 구간 신규 약정 불가" />
          </Field>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={busy} onClick={() => reply("approve")}>
              승인
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => reply("conditional")}>
              조건부 승인
            </Button>
            <Button disabled={busy} variant="destructive" onClick={() => reply("reject")}>
              거절
            </Button>
            <Src type="mock" />
            <span className="text-muted-foreground">실제 결재가 아니라 승인권자 역할로 넣는 모의 회신입니다.</span>
          </div>
          <ActionError error={error} />
        </>
      )}
    </div>
  );
}

// ── 작업 목록 ───────────────────────────────────────────────────

export function WorkList({ items, onDone, showCase = false }: { items: WorkTask[]; onDone: () => void; showCase?: boolean }) {
  const { busy, error, run } = useAction(onDone);
  if (items.length === 0) return <Empty>작업이 없습니다.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      {items.map((w) => (
        <div key={w.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
          <Status tone={w.status === "done" ? "muted" : "default"}>{WORK_STATUS[w.status] ?? w.status}</Status>
          <span className="font-medium">[{w.payload.dept}]</span>
          <span className="flex-1">{w.title}</span>
          {showCase && (
            <Link className="underline" href={`/cases/detail/?id=${w.payload.case_id}`}>
              #{w.payload.case_id}
            </Link>
          )}
          {w.status === "open" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => post(`/work/${w.id}/status`, { status: "in_progress" }))}>
              시작
            </Button>
          )}
          {w.status !== "done" && (
            <Button size="sm" disabled={busy} onClick={() => run(() => post(`/work/${w.id}/status`, { status: "done" }))}>
              완료 처리
            </Button>
          )}
        </div>
      ))}
      <ActionError error={error} />
    </div>
  );
}

// ── 조건 변경 입력 (모의) ────────────────────────────────────────

type ChangeFormProps = {
  onDone: () => void;
  skuIds: string[];
  poRefs: string[];
  caseId?: number;
};

export function ChangeForm({ onDone, skuIds, poRefs, caseId }: ChangeFormProps) {
  const { busy, error, run } = useAction(onDone);
  const [transitSku, setTransitSku] = useState(skuIds[0] ?? "");
  const [transitEta, setTransitEta] = useState("2026-07-10");
  const [poRef, setPoRef] = useState(poRefs[0] ?? "");
  const [poEta, setPoEta] = useState("2026-10-02");
  const [demandSku, setDemandSku] = useState(skuIds[0] ?? "");
  const [uplift, setUplift] = useState("20");

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="이동중 물량 입고예정일 회신 — SKU">
          <select className={inputClass} value={transitSku} onChange={(e) => setTransitSku(e.target.value)}>
            {skuIds.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="입고예정일">
          <input type="date" className={inputClass} value={transitEta} onChange={(e) => setTransitEta(e.target.value)} />
        </Field>
        <Button disabled={busy || !transitSku} variant="outline" onClick={() => run(() => post("/changes", { type: "in_transit_eta", sku_id: transitSku, eta: transitEta }))}>
          공급자 회신 반영
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Field label="발주 입고예정일 변경(지연) 회신 — 발주">
          <select className={inputClass} value={poRef} onChange={(e) => setPoRef(e.target.value)}>
            {poRefs.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="바뀐 입고예정일">
          <input type="date" className={inputClass} value={poEta} onChange={(e) => setPoEta(e.target.value)} />
        </Field>
        <Button disabled={busy || !poRef} variant="outline" onClick={() => run(() => post("/changes", { type: "po_eta", po_ref: poRef, eta: poEta }))}>
          공급자 회신 반영
        </Button>
      </div>

      {caseId !== undefined && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="수요 가정 정정 — SKU">
            <select className={inputClass} value={demandSku} onChange={(e) => setDemandSku(e.target.value)}>
              {skuIds.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="새 수요 증가율(%)">
            <input type="number" min={0} className={inputClass} value={uplift} onChange={(e) => setUplift(e.target.value)} />
          </Field>
          <Button
            disabled={busy || !demandSku}
            variant="outline"
            onClick={() => run(() => post("/changes", { type: "demand_revision", case_id: caseId, sku_id: demandSku, uplift_pct: Number(uplift), actor: "마케팅팀" }))}
          >
            마케팅 정정 반영
          </Button>
        </div>
      )}
      <p className="text-muted-foreground">
        <Src type="mock" /> 반영하면 끝나지 않은 모든 검토 건을 다시 확인하고, 결론이 달라진 건은 &lsquo;재검토 필요&rsquo;로 바꿉니다.
      </p>
      <ActionError error={error} />
    </div>
  );
}

// ── 주간 전망 표 ────────────────────────────────────────────────

export function WeekTable({ rows }: { rows: WeekRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>주(월요일)</TableHead>
          <TableHead>기초재고</TableHead>
          <TableHead>입고</TableHead>
          <TableHead>평시 수요</TableHead>
          <TableHead>캠페인 수요</TableHead>
          <TableHead>기말재고</TableHead>
          <TableHead>부족</TableHead>
          <TableHead>커버(주)</TableHead>
          <TableHead>상태</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.week}>
            <TableCell>{r.week}</TableCell>
            <TableCell>{qty(r.opening_qty)}</TableCell>
            <TableCell>{r.inbound_qty ? `${qty(r.inbound_qty)} (${r.inbound_refs.join(", ")})` : "-"}</TableCell>
            <TableCell>{qty(r.baseline_qty)}</TableCell>
            <TableCell>{r.campaign_qty ? qty(r.campaign_qty) : "-"}</TableCell>
            <TableCell>{qty(r.closing_qty)}</TableCell>
            <TableCell>{r.shortage_qty ? qty(r.shortage_qty) : "-"}</TableCell>
            <TableCell>{r.cover_weeks ?? "-"}</TableCell>
            <TableCell>{r.flag === "ok" ? FLAG.ok : <Status tone="warn">{FLAG[r.flag]}</Status>}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── 처리 이력 ───────────────────────────────────────────────────

export function EventList({ events, showCase = false }: { events: EventRow[]; showCase?: boolean }) {
  if (events.length === 0) return <Empty>아직 이력이 없습니다.</Empty>;
  return (
    <ol className="flex flex-col gap-1.5 text-sm">
      {events.map((e) => (
        <li key={e.id} className="flex flex-wrap gap-x-2">
          <span className="text-muted-foreground">{time(e.created_at)}</span>
          <span className="font-medium">
            {e.actor} · {e.action}
          </span>
          {showCase && e.task_id != null && (
            <Link className="underline" href={`/cases/detail/?id=${e.task_id}`}>
              #{e.task_id}
            </Link>
          )}
          <span className="basis-full text-muted-foreground sm:basis-auto">{e.note}</span>
        </li>
      ))}
    </ol>
  );
}
