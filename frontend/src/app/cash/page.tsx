"use client";

import { FactList } from "@/components/common/fact-list";
import { LoadingMessage } from "@/components/common/loading-message";
import { MutedText } from "@/components/common/muted-text";
import { PageTitle } from "@/components/common/page-title";
import { Section } from "@/components/common/section";
import { StatusBadge } from "@/components/common/status-badge";
import { TableHeaderRow } from "@/components/common/table-header-row";
import { TextList } from "@/components/common/text-list";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { formatHundredMillionWon, formatPeriod, formatWon } from "@/lib/format";
import type { Cash } from "@/types/cash";

export default function CashPage() {
  const { data, error } = useApi<Cash>("/cash");

  return (
    <>
      <PageTitle
        title="현금·약정"
        description="Masil 단독 기준, 영업일별 일말 잔액이 30억 아래로 내려가는 구간을 찾습니다. 이 구간의 신규 현금 약정은 그룹 CEO 승인입니다."
      />
      {!data && <LoadingMessage error={error} />}
      {data && (
        <>
          <Section
            title="전망 요약"
            description={`${data.as_of} ~ ${data.horizon_end} · 잔액 = 기초 + 회수예정 − 운영 매입채무 − 발주대금`}
            sourceType="calculation"
          >
            <FactList
              rows={[
                ["기준일 잔액", formatWon(data.opening_krw)],
                ["약정 최소 잔액", formatWon(data.covenant_min_krw)],
                ["전망 최저 잔액", `${formatWon(data.min_closing_krw)} (${data.min_date})`],
                [
                  "30억 하회 예상 구간",
                  data.breach_windows.length === 0 ? (
                    "없음"
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      {data.breach_windows
                        .map((breachWindow) => `${formatPeriod(breachWindow.start, breachWindow.end)} (최저 ${formatHundredMillionWon(breachWindow.min_closing_krw)})`)
                        .join(", ")}
                      <StatusBadge tone="warn">하회 예상</StatusBadge>
                    </span>
                  ),
                ],
              ]}
            />
            <MutedText>시스템에서 승인된 추가 발주대금도 여기에 반영됩니다. 그룹 지원이나 미인출 한도는 넣지 않습니다(원본 약정 조건).</MutedText>
          </Section>

          <Section title="재무팀 공식 전망과 비교" description="fin_cash_forecast_ms 는 재무팀이 쓴 전망이라 사실이 아니라 주장으로 봅니다" sourceType="claim">
            <Table>
              <TableHeaderRow columns={["주(월요일)", "공식 전망 주말 잔액", "스케줄 합산 주말 잔액", "차이"]} />
              <TableBody>
                {data.official_forecast.map((row) => (
                  <TableRow key={row.week}>
                    <TableCell>{row.week}</TableCell>
                    <TableCell>{formatHundredMillionWon(row.official_closing_krw)}</TableCell>
                    <TableCell>{formatHundredMillionWon(row.simulated_closing_krw)}</TableCell>
                    <TableCell>{formatHundredMillionWon(row.gap_krw)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <MutedText>
              차이가 큰 이유(확인 필요): 공식 전망은 일상 영업 수입·지출을 포함하지만, 계산 정의의 합산 방식은 확정된 채권·채무·발주대금만 넣습니다. 반대로 공식 전망에는
              7/21 발주대금 37.5억과 대형 파트너(CH-03) 결제조건 45일→90일 연장이 반영됐는지 확인되지 않습니다.
            </MutedText>
          </Section>

          <Section title="영업일별 잔액" description="현금 이동이 있는 날과 30억 하회일만 보여 줍니다.">
            <Table>
              <TableHeaderRow columns={["날짜", "들어올 돈", "나갈 돈", "일말 잔액", "내역"]} />
              <TableBody>
                {data.rows
                  .filter((row) => row.items.length > 0)
                  .map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.inflow_krw ? formatHundredMillionWon(row.inflow_krw) : "-"}</TableCell>
                      <TableCell>{row.outflow_krw ? formatHundredMillionWon(row.outflow_krw) : "-"}</TableCell>
                      <TableCell>
                        {formatHundredMillionWon(row.closing_krw)} {row.below_covenant && <StatusBadge tone="warn">30억 하회</StatusBadge>}
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {row.items.length > 4 ? `${row.items[0].label} 외 ${row.items.length - 1}건` : row.items.map((item) => `${item.label}(${item.ref})`).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Section>

          <Section
            title={`전망에서 뺀 항목 ${data.excluded.length}건`}
            description="기한이 지난 미수금은 회수 시점을 알 수 없어 넣지 않았습니다"
            sourceType="assumption"
          >
            <TextList>
              {data.excluded.map((item) => (
                <li key={item.ref}>
                  {item.ref} · {item.label} · 기한 {item.original_date} · {formatWon(item.amount_krw)}
                </li>
              ))}
            </TextList>
          </Section>
        </>
      )}
    </>
  );
}
