"use client";

import { Facts, Loading, PageTitle, Section, Src, Status } from "@/components/ops/basic";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { krw, won } from "@/lib/format";
import type { Cash } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function CashPage() {
  const { data, error } = useApi<Cash>("/cash");

  return (
    <>
      <PageTitle
        title="현금·약정"
        description="Masil 단독 기준, 영업일별 일말 잔액이 30억 아래로 내려가는 구간을 찾습니다. 이 구간의 신규 현금 약정은 그룹 CEO 승인입니다."
      />
      {!data && <Loading error={error} />}
      {data && (
        <>
          <Section
            title="전망 요약"
            description={
              <>
                {data.as_of} ~ {data.horizon_end} · 잔액 = 기초 + 회수예정 − 운영 매입채무 − 발주대금 <Src type="calculation" />
              </>
            }
          >
            <Facts
              rows={[
                ["기준일 잔액", won(data.opening_krw)],
                ["약정 최소 잔액", won(data.covenant_min_krw)],
                ["전망 최저 잔액", `${won(data.min_closing_krw)} (${data.min_date})`],
                [
                  "30억 하회 예상 구간",
                  data.breach_windows.length === 0 ? (
                    "없음"
                  ) : (
                    <span className="flex flex-wrap items-center gap-2">
                      {data.breach_windows.map((w) => `${w.start} ~ ${w.end} (최저 ${krw(w.min_closing_krw)})`).join(", ")}
                      <Status tone="warn">하회 예상</Status>
                    </span>
                  ),
                ],
              ]}
            />
            <p className="text-sm text-muted-foreground">
              시스템에서 승인된 추가 발주대금도 여기에 반영됩니다. 그룹 지원이나 미인출 한도는 넣지 않습니다(원본 약정 조건).
            </p>
          </Section>

          <Section
            title="재무팀 공식 전망과 비교"
            description={
              <>
                fin_cash_forecast_ms 는 재무팀이 쓴 전망이라 사실이 아니라 주장으로 봅니다 <Src type="claim" />
              </>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>주(월요일)</TableHead>
                  <TableHead>공식 전망 주말 잔액</TableHead>
                  <TableHead>스케줄 합산 주말 잔액</TableHead>
                  <TableHead>차이</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.official_forecast.map((r) => (
                  <TableRow key={r.week}>
                    <TableCell>{r.week}</TableCell>
                    <TableCell>{krw(r.official_closing_krw)}</TableCell>
                    <TableCell>{krw(r.simulated_closing_krw)}</TableCell>
                    <TableCell>{krw(r.gap_krw)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground">
              차이가 큰 이유(확인 필요): 공식 전망은 일상 영업 수입·지출을 포함하지만, 계산 정의의 합산 방식은 확정된 채권·채무·발주대금만 넣습니다. 반대로 공식 전망에는
              7/21 발주대금 37.5억과 대형 파트너(CH-03) 결제조건 45일→90일 연장이 반영됐는지 확인되지 않습니다.
            </p>
          </Section>

          <Section title="영업일별 잔액" description="현금 이동이 있는 날과 30억 하회일만 보여 줍니다.">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>날짜</TableHead>
                  <TableHead>들어올 돈</TableHead>
                  <TableHead>나갈 돈</TableHead>
                  <TableHead>일말 잔액</TableHead>
                  <TableHead>내역</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows
                  .filter((r) => r.items.length > 0)
                  .map((r) => (
                    <TableRow key={r.date}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.inflow_krw ? krw(r.inflow_krw) : "-"}</TableCell>
                      <TableCell>{r.outflow_krw ? krw(r.outflow_krw) : "-"}</TableCell>
                      <TableCell>
                        {krw(r.closing_krw)} {r.below_covenant && <Status tone="warn">30억 하회</Status>}
                      </TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">
                        {r.items.length > 4 ? `${r.items[0].label} 외 ${r.items.length - 1}건` : r.items.map((i) => `${i.label}(${i.ref})`).join(", ")}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Section>

          <Section
            title={`전망에서 뺀 항목 ${data.excluded.length}건`}
            description={
              <>
                기한이 지난 미수금은 회수 시점을 알 수 없어 넣지 않았습니다 <Src type="assumption" />
              </>
            }
          >
            <ul className="flex flex-col gap-1 text-sm">
              {data.excluded.map((e) => (
                <li key={e.ref}>
                  {e.ref} · {e.label} · 기한 {e.original_date} · {won(e.amount_krw)}
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}
