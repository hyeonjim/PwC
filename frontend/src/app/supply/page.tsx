"use client";

import { useState } from "react";

import { LoadingMessage } from "@/components/common/loading-message";
import { MutedText } from "@/components/common/muted-text";
import { PageTitle } from "@/components/common/page-title";
import { Section } from "@/components/common/section";
import { SourceBadge } from "@/components/common/source-badge";
import { StatusBadge } from "@/components/common/status-badge";
import { TableHeaderRow } from "@/components/common/table-header-row";
import { TextList } from "@/components/common/text-list";
import { WeeklyProjectionTable } from "@/components/supply/weekly-projection-table";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { formatQuantity, formatWon } from "@/lib/format";
import { PURCHASE_ORDER_STATUS_LABEL } from "@/lib/labels";
import type { Projection, Supply } from "@/types/supply";

const SKU_COLUMNS = ["SKU", "분류", "현재고", "주간 수요(4주 평균)", "커버(주)", "", "이동중", "리드타임", "품절 예상 주", "약속된 캠페인", ""];
const PRODUCTION_LINE_COLUMNS = ["Corevia 제품군", "공장·라인", "연간 생산능력", "가동률", "주간 여력(추정)", "시스템 추가 발주 사용", "Corevia 회신"];
const SOURCE_PURCHASE_ORDER_COLUMNS = ["발주", "SKU", "발주일", "수량", "입고예정(가정)", "금액", "대금 지급일"];

export default function SupplyPage() {
  const { data, error } = useApi<Supply>("/supply");
  const [openSkuId, setOpenSkuId] = useState<string | null>(null);
  const projection = useApi<Projection>(openSkuId ? `/supply/${openSkuId}` : null);

  return (
    <>
      <PageTitle
        title="SKU 수요·공급"
        description="SKU 별 재고, 입고 예정, 승인된 캠페인 수요를 한 표에서 봅니다. 승인된 발주와 캠페인은 바로 여기에 반영됩니다."
      />
      {!data && <LoadingMessage error={error} />}
      {data && (
        <>
          <Section
            title="SKU 현황"
            description={
              <>
                현재고·판매·MOQ·리드타임 <SourceBadge type="fact" /> · 품절 예상 주 <SourceBadge type="calculation" />
              </>
            }
          >
            <Table>
              <TableHeaderRow columns={SKU_COLUMNS} numericColumns={[2, 3, 4]} />
              <TableBody>
                {data.skus.map((sku) => (
                  <TableRow key={sku.sku_id}>
                    <TableCell>
                      {sku.sku_id} {sku.sku_name}
                    </TableCell>
                    <TableCell>{sku.category}</TableCell>
                    <TableCell className="table-number">{formatQuantity(sku.on_hand_qty)}</TableCell>
                    <TableCell className="table-number">{formatQuantity(sku.avg_weekly_demand_4w)}</TableCell>
                    <TableCell className="table-number">{sku.cover_weeks}</TableCell>
                    <TableCell>
                      {sku.below_safety_min ? <StatusBadge tone="warn">미달</StatusBadge> : sku.above_safety_max ? <StatusBadge tone="muted">여유</StatusBadge> : null}
                    </TableCell>
                    <TableCell>
                      {formatQuantity(sku.in_transit_qty)} ({sku.in_transit_eta ?? "입고일 미확인"})
                    </TableCell>
                    <TableCell>{sku.lead_time_weeks}주</TableCell>
                    <TableCell>{sku.first_stockout_week ?? "없음"}</TableCell>
                    <TableCell>
                      {sku.committed_campaigns.length === 0
                        ? "-"
                        : sku.committed_campaigns.map((campaign) => `#${campaign.case_id} ${campaign.start_date}~${campaign.end_date} +${campaign.uplift_pct}%`).join(", ")}
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setOpenSkuId(openSkuId === sku.sku_id ? null : sku.sku_id)}>
                        {openSkuId === sku.sku_id ? "닫기" : "주간 전망"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-muted-foreground">
              커버는 원본 정의대로 현재고만으로 계산합니다(이동중 미포함). 품절 예상 주는 입고일을 아는 물량만 넣은 16주 전망이며, 기준일 이후의 정기 발주는 원본에 없어
              넣지 않았습니다 <SourceBadge type="assumption" />
            </p>
          </Section>

          {openSkuId && (
            <Section title={`${openSkuId} 주간 전망`} description="기말재고 = 기초재고 + 입고 − 평시 수요 − 승인된 캠페인 수요">
              {!projection.data || projection.data.sku_id !== openSkuId ? (
                <LoadingMessage error={projection.error} />
              ) : (
                <>
                  <TextList>
                    {projection.data.inbound.map((inbound) => (
                      <li key={inbound.ref}>
                        {inbound.ref} · {formatQuantity(inbound.qty)}개 · {inbound.eta ?? "입고일 미확인"} <span className="text-muted-foreground">({inbound.basis})</span>
                      </li>
                    ))}
                  </TextList>
                  <WeeklyProjectionTable rows={projection.data.rows} />
                </>
              )}
            </Section>
          )}

          <Section
            title="Corevia 생산 라인 여력"
            description={
              <>
                생산능력·가동률 strat_capacity_cv <SourceBadge type="fact" /> · 주간 여력 = 연간 능력 × (1 − 가동률) ÷ 52 <SourceBadge type="assumption" /> · 추가 발주는
                리드타임 안의 여력까지만 낼 수 있습니다
              </>
            }
          >
            <Table>
              <TableHeaderRow columns={PRODUCTION_LINE_COLUMNS} numericColumns={[2, 4]} />
              <TableBody>
                {data.production_lines.map((line) => (
                  <TableRow key={line.line_id}>
                    <TableCell>
                      {line.product_id} {line.product_name}
                    </TableCell>
                    <TableCell>
                      {line.plant_id} {line.line_id}
                    </TableCell>
                    <TableCell className="table-number">{formatQuantity(line.capacity_qty)}</TableCell>
                    <TableCell>
                      {line.utilization_pct}% {line.utilization_pct >= 95 ? <StatusBadge tone="warn">포화</StatusBadge> : null}
                    </TableCell>
                    <TableCell className="table-number">{formatQuantity(line.free_weekly_qty)}</TableCell>
                    <TableCell>{line.committed_qty ? `${formatQuantity(line.committed_qty)}개` : "-"}</TableCell>
                    <TableCell>{line.confirmed_qty === null ? "없음" : `${formatQuantity(line.confirmed_qty)}개 가능`}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section
            title="원본 발주 14건"
            description={
              <>
                sc_purchase_orders_ms <SourceBadge type="fact" /> · 입고예정일은 발주일 + 리드타임 <SourceBadge type="assumption" />
              </>
            }
          >
            <Table>
              <TableHeaderRow columns={SOURCE_PURCHASE_ORDER_COLUMNS} numericColumns={[3, 5]} />
              <TableBody>
                {data.source_pos.map((purchaseOrder) => (
                  <TableRow key={purchaseOrder.po_id}>
                    <TableCell>{purchaseOrder.po_id}</TableCell>
                    <TableCell>{purchaseOrder.sku_id}</TableCell>
                    <TableCell>{purchaseOrder.order_date}</TableCell>
                    <TableCell className="table-number">{formatQuantity(purchaseOrder.qty)}</TableCell>
                    <TableCell>{purchaseOrder.eta}</TableCell>
                    <TableCell className="table-number">{formatWon(purchaseOrder.amount_krw)}</TableCell>
                    <TableCell>{purchaseOrder.payment_due_date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>

          <Section title={`시스템에서 승인된 추가 발주 ${data.system_pos.length}건`} description="검토 건 승인으로 생긴 발주. 실제로 보내지 않는 모의 발주입니다.">
            {data.system_pos.length === 0 ? (
              <MutedText>아직 없습니다.</MutedText>
            ) : (
              <TextList>
                {data.system_pos.map((purchaseOrder) => (
                  <li key={purchaseOrder.id}>
                    PO-{purchaseOrder.id} · {purchaseOrder.payload.sku_id} · {formatQuantity(purchaseOrder.payload.qty)}개 · {formatWon(purchaseOrder.payload.amount_krw)} · 입고예정{" "}
                    {purchaseOrder.payload.eta} · 지급 {purchaseOrder.payload.payment_due_date} · {PURCHASE_ORDER_STATUS_LABEL[purchaseOrder.status] ?? purchaseOrder.status} ·
                    검토 건 #{purchaseOrder.payload.case_id}
                  </li>
                ))}
              </TextList>
            )}
          </Section>
        </>
      )}
    </>
  );
}
