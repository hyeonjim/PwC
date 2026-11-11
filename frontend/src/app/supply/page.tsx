"use client";

import { useState } from "react";

import { Empty, Loading, PageTitle, Section, Src, Status } from "@/components/ops/basic";
import { WeekTable } from "@/components/ops/parts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PO_STATUS, qty, won } from "@/lib/format";
import type { Projection, Supply } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function SupplyPage() {
  const { data, error } = useApi<Supply>("/supply");
  const [open, setOpen] = useState<string | null>(null);
  const projection = useApi<Projection>(open ? `/supply/${open}` : null);

  return (
    <>
      <PageTitle
        title="SKU 수요·공급"
        description="SKU 별 재고, 입고 예정, 승인된 캠페인 수요를 한 표에서 봅니다. 승인된 발주와 캠페인은 바로 여기에 반영됩니다."
      />
      {!data && <Loading error={error} />}
      {data && (
        <>
          <Section
            title="SKU 현황"
            description={
              <>
                현재고·판매·MOQ·리드타임 <Src type="fact" /> · 품절 예상 주 <Src type="calculation" />
              </>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>분류</TableHead>
                  <TableHead>현재고</TableHead>
                  <TableHead>주간 수요(4주 평균)</TableHead>
                  <TableHead>커버(주)</TableHead>
                  <TableHead>이동중</TableHead>
                  <TableHead>리드타임</TableHead>
                  <TableHead>품절 예상 주</TableHead>
                  <TableHead>약속된 캠페인</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.skus.map((s) => (
                  <TableRow key={s.sku_id}>
                    <TableCell>
                      {s.sku_id} {s.sku_name}
                    </TableCell>
                    <TableCell>{s.category}</TableCell>
                    <TableCell>{qty(s.on_hand_qty)}</TableCell>
                    <TableCell>{qty(s.avg_weekly_demand_4w)}</TableCell>
                    <TableCell>
                      {s.cover_weeks}{" "}
                      {s.below_safety_min ? <Status tone="warn">미달</Status> : s.above_safety_max ? <Status tone="muted">여유</Status> : null}
                    </TableCell>
                    <TableCell>
                      {qty(s.in_transit_qty)} ({s.in_transit_eta ?? "입고일 미확인"})
                    </TableCell>
                    <TableCell>{s.lead_time_weeks}주</TableCell>
                    <TableCell>{s.first_stockout_week ?? "없음"}</TableCell>
                    <TableCell>
                      {s.committed_campaigns.length === 0
                        ? "-"
                        : s.committed_campaigns.map((c) => `#${c.case_id} ${c.start_date}~${c.end_date} +${c.uplift_pct}%`).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setOpen(open === s.sku_id ? null : s.sku_id)}>
                        {open === s.sku_id ? "닫기" : "주간 전망"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground">
              커버는 원본 정의대로 현재고만으로 계산합니다(이동중 미포함). 품절 예상 주는 입고일을 아는 물량만 넣은 16주 전망이며, 기준일 이후의 정기 발주는 원본에 없어
              넣지 않았습니다 <Src type="assumption" />
            </p>
          </Section>

          {open && (
            <Section title={`${open} 주간 전망`} description="기말재고 = 기초재고 + 입고 − 평시 수요 − 승인된 캠페인 수요">
              {!projection.data || projection.data.sku_id !== open ? (
                <Loading error={projection.error} />
              ) : (
                <>
                  <ul className="flex flex-col gap-1 text-sm">
                    {projection.data.inbound.map((i) => (
                      <li key={i.ref}>
                        {i.ref} · {qty(i.qty)}개 · {i.eta ?? "입고일 미확인"} <span className="text-muted-foreground">({i.basis})</span>
                      </li>
                    ))}
                  </ul>
                  <WeekTable rows={projection.data.rows} />
                </>
              )}
            </Section>
          )}

          <Section
            title="원본 발주 14건"
            description={
              <>
                sc_purchase_orders_ms <Src type="fact" /> · 입고예정일은 발주일 + 리드타임 <Src type="assumption" />
              </>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>발주</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>발주일</TableHead>
                  <TableHead>수량</TableHead>
                  <TableHead>입고예정(가정)</TableHead>
                  <TableHead>금액</TableHead>
                  <TableHead>대금 지급일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.source_pos.map((p) => (
                  <TableRow key={p.po_id}>
                    <TableCell>{p.po_id}</TableCell>
                    <TableCell>{p.sku_id}</TableCell>
                    <TableCell>{p.order_date}</TableCell>
                    <TableCell>{qty(p.qty)}</TableCell>
                    <TableCell>{p.eta}</TableCell>
                    <TableCell>{won(p.amount_krw)}</TableCell>
                    <TableCell>{p.payment_due_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section title={`시스템에서 승인된 추가 발주 ${data.system_pos.length}건`} description="검토 건 승인으로 생긴 발주. 실제로 보내지 않는 모의 발주입니다.">
            {data.system_pos.length === 0 ? (
              <Empty>아직 없습니다.</Empty>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {data.system_pos.map((p) => (
                  <li key={p.id}>
                    PO-{p.id} · {p.payload.sku_id} · {qty(p.payload.qty)}개 · {won(p.payload.amount_krw)} · 입고예정 {p.payload.eta} · 지급 {p.payload.payment_due_date} ·{" "}
                    {PO_STATUS[p.status] ?? p.status} · 검토 건 #{p.payload.case_id}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}
    </>
  );
}
