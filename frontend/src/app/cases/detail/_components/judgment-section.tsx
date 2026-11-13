"use client";

// AI 판단: 계산 결과와 규정을 읽고 어떤 대안으로 올릴지 초안을 쓴다.
import { ErrorText } from "@/components/common/error-text";
import { FactList } from "@/components/common/fact-list";
import { MutedText } from "@/components/common/muted-text";
import { Section } from "@/components/common/section";
import { SourceBadge } from "@/components/common/source-badge";
import { SubSection } from "@/components/common/sub-section";
import { TextList } from "@/components/common/text-list";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { postApi } from "@/lib/api-client";
import { DECISION_LABEL } from "@/lib/labels";
import type { Judgment, Option } from "@/types/case";

type JudgmentSectionProps = {
  judgment?: Judgment;
  caseId: number;
  canJudge: boolean;
  onDone: () => void;
  options: Option[];
};

export function JudgmentSection({ judgment, caseId, canJudge, onDone, options }: JudgmentSectionProps) {
  const { busy, error, run } = useAction(onDone);
  const recommendation = judgment?.recommendation;
  const recommendedOption = options.find((option) => option.key === recommendation?.recommended_option);
  const buttonLabel = busy ? "판단 받는 중… (1~2분 걸릴 수 있습니다)" : judgment ? "AI 판단 다시 받기" : "AI 판단 받기";

  return (
    <Section title="AI 판단" description="계산 결과와 규정을 읽고 어떤 대안으로 올릴지 초안을 씁니다. 결정은 사람이 합니다.">
      {!judgment && <MutedText>아직 판단을 받지 않았습니다.</MutedText>}
      {judgment && recommendation && (
        <>
          <FactList
            rows={[
              ["판단 주체", judgment.source === "ai" ? `AI (${judgment.model})` : "규칙 기반 예비 판단 (AI 미연결)"],
              ["결론", DECISION_LABEL[recommendation.decision] ?? recommendation.decision],
              ["권고 대안", recommendedOption ? recommendedOption.title : "없음"],
              ["승인권자", recommendation.required_approver],
              ["확신 정도", recommendation.confidence],
            ]}
          />
          <p>{recommendation.summary}</p>
          {judgment.error && <MutedText>AI 를 쓰지 못한 이유: {judgment.error}</MutedText>}

          <SubSection title="근거">
            <TextList>
              {recommendation.evidence.map((evidence, index) => (
                <li key={index}>
                  <SourceBadge type={evidence.source_type} /> {evidence.statement} <span className="text-muted-foreground">({evidence.source_ref})</span>
                </li>
              ))}
            </TextList>
          </SubSection>
          {recommendation.alternatives.length > 0 && (
            <SubSection title="대안별 영향">
              <TextList>
                {recommendation.alternatives.map((alternative, index) => (
                  <li key={index}>
                    {alternative.option} — {alternative.tradeoff}
                  </li>
                ))}
              </TextList>
            </SubSection>
          )}
          {recommendation.missing_info.length > 0 && (
            <SubSection title="확인되지 않은 정보">
              <ul className="text-list list-disc pl-5">
                {recommendation.missing_info.map((info, index) => (
                  <li key={index}>{info}</li>
                ))}
              </ul>
            </SubSection>
          )}
        </>
      )}
      {canJudge && (
        <div className="flex items-center gap-2">
          <Button disabled={busy} variant={judgment ? "outline" : "default"} onClick={() => run(() => postApi(`/cases/${caseId}/judge`))}>
            {buttonLabel}
          </Button>
        </div>
      )}
      <ErrorText error={error} />
    </Section>
  );
}
