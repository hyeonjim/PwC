"use client";

import Link from "next/link";

import { NewCaseForm } from "@/app/cases/_components/new-case-form";
import { LoadingMessage } from "@/components/common/loading-message";
import { MutedText } from "@/components/common/muted-text";
import { PageTitle } from "@/components/common/page-title";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { useApi } from "@/hooks/use-api";
import { formatQuantity } from "@/lib/format";
import { CASE_STATUS_LABEL, CASE_STATUS_TONE } from "@/lib/labels";
import type { CaseTask, Plan } from "@/types/case";
import type { Supply } from "@/types/supply";

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
        {!cases.data && <LoadingMessage error={cases.error} />}
        {cases.data?.length === 0 && <MutedText>아직 접수된 검토 건이 없습니다. 아래에서 접수하세요.</MutedText>}
        <div>
        {cases.data?.map((caseTask) => (
          <Link key={caseTask.id} href={`/cases/detail/?id=${caseTask.id}`} className="case-row">
            <span className="case-row-id">#{caseTask.id}</span>
            <StatusBadge tone={CASE_STATUS_TONE[caseTask.status]}>
              {CASE_STATUS_LABEL[caseTask.status] ?? caseTask.status}
            </StatusBadge>
            <span className="font-medium">{caseTask.title}</span>
            <span className="text-muted-foreground">
              {caseTask.payload.skus.map((sku) => `${sku.sku_id} +${sku.uplift_pct}%`).join(", ")} · 캠페인 기간 부족 {formatQuantity(caseTask.payload.shortage_in_campaign_qty)}개
              {caseTask.payload.info_gap_count ? ` · 정보 공백 ${caseTask.payload.info_gap_count}건` : ""}
            </span>
          </Link>
        ))}
        </div>
      </Section>

      {plans.data && supply.data ? <NewCaseForm plans={plans.data} supply={supply.data} /> : <LoadingMessage error={plans.error ?? supply.error} />}
    </>
  );
}
