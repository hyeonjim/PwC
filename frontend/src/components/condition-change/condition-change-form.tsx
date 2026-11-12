"use client";

// 조건 변경 입력 (모의): 공급자 입고예정 회신, 발주 지연, Corevia 생산 여력 회신, 수요 가정 정정.
import { useState } from "react";

import { ErrorText } from "@/components/common/error-text";
import { FormField, TextInput, inputClassName } from "@/components/common/form-field";
import { SourceBadge } from "@/components/common/source-badge";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { postApi } from "@/lib/api-client";

type ConditionChangeFormProps = {
  onDone: () => void;
  skuIds: string[];
  purchaseOrderRefs: string[];
  caseId?: number;
  /** Corevia 생산 라인 (회신 입력용). 비어 있으면 입력칸을 숨긴다. */
  productLines?: { product_id: string; product_name: string; line_id: string }[];
};

export function ConditionChangeForm({ onDone, skuIds, purchaseOrderRefs, caseId, productLines = [] }: ConditionChangeFormProps) {
  const { busy, error, run } = useAction(onDone);
  const [transitSkuId, setTransitSkuId] = useState(skuIds[0] ?? "");
  const [transitEta, setTransitEta] = useState("2026-07-10");
  const [purchaseOrderRef, setPurchaseOrderRef] = useState(purchaseOrderRefs[0] ?? "");
  const [purchaseOrderEta, setPurchaseOrderEta] = useState("2026-10-02");
  const [demandSkuId, setDemandSkuId] = useState(skuIds[0] ?? "");
  const [upliftPercent, setUpliftPercent] = useState("20");
  const [productId, setProductId] = useState(productLines[0]?.product_id ?? "");
  const [availableQuantity, setAvailableQuantity] = useState("30000");

  const submitChange = (body: Record<string, unknown>) => run(() => postApi("/changes", body));

  return (
    <div className="flex flex-col gap-4 text-base">
      <div className="flex flex-wrap items-end gap-2">
        <FormField label="이동중 물량 입고예정일 회신 — SKU">
          <select className={inputClassName} value={transitSkuId} onChange={(event) => setTransitSkuId(event.target.value)}>
            {skuIds.map((skuId) => (
              <option key={skuId}>{skuId}</option>
            ))}
          </select>
        </FormField>
        <FormField label="입고예정일">
          <TextInput type="date" value={transitEta} onChange={(event) => setTransitEta(event.target.value)} />
        </FormField>
        <Button disabled={busy || !transitSkuId} variant="outline" onClick={() => submitChange({ type: "in_transit_eta", sku_id: transitSkuId, eta: transitEta })}>
          공급자 회신 반영
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <FormField label="발주 입고예정일 변경(지연) 회신 — 발주">
          <select className={inputClassName} value={purchaseOrderRef} onChange={(event) => setPurchaseOrderRef(event.target.value)}>
            {purchaseOrderRefs.map((ref) => (
              <option key={ref}>{ref}</option>
            ))}
          </select>
        </FormField>
        <FormField label="바뀐 입고예정일">
          <TextInput type="date" value={purchaseOrderEta} onChange={(event) => setPurchaseOrderEta(event.target.value)} />
        </FormField>
        <Button disabled={busy || !purchaseOrderRef} variant="outline" onClick={() => submitChange({ type: "po_eta", po_ref: purchaseOrderRef, eta: purchaseOrderEta })}>
          공급자 회신 반영
        </Button>
      </div>

      {productLines.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <FormField label="Corevia 생산 여력 회신 — 라인">
            <select className={inputClassName} value={productId} onChange={(event) => setProductId(event.target.value)}>
              {productLines.map((line) => (
                <option key={line.product_id} value={line.product_id}>
                  {line.product_name} ({line.line_id})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="리드타임 안 추가 생산 가능 수량">
            <TextInput type="number" min={0} value={availableQuantity} onChange={(event) => setAvailableQuantity(event.target.value)} />
          </FormField>
          <Button
            disabled={busy || !productId}
            variant="outline"
            onClick={() => submitChange({ type: "capacity_reply", product_id: productId, available_qty: Number(availableQuantity), actor: "Corevia 생산계획팀" })}
          >
            Corevia 회신 반영
          </Button>
        </div>
      )}

      {caseId !== undefined && (
        <div className="flex flex-wrap items-end gap-2">
          <FormField label="수요 가정 정정 — SKU">
            <select className={inputClassName} value={demandSkuId} onChange={(event) => setDemandSkuId(event.target.value)}>
              {skuIds.map((skuId) => (
                <option key={skuId}>{skuId}</option>
              ))}
            </select>
          </FormField>
          <FormField label="새 수요 증가율(%)">
            <TextInput type="number" min={0} value={upliftPercent} onChange={(event) => setUpliftPercent(event.target.value)} />
          </FormField>
          <Button
            disabled={busy || !demandSkuId}
            variant="outline"
            onClick={() => submitChange({ type: "demand_revision", case_id: caseId, sku_id: demandSkuId, uplift_pct: Number(upliftPercent), actor: "마케팅팀" })}
          >
            마케팅 정정 반영
          </Button>
        </div>
      )}
      <p className="text-muted-foreground">
        <SourceBadge type="mock" /> 반영하면 끝나지 않은 모든 검토 건을 다시 확인하고, 결론이 달라진 건은 &lsquo;재검토 필요&rsquo;로 바꿉니다.
      </p>
      <ErrorText error={error} />
    </div>
  );
}
