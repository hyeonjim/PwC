// SKU 주간 재고 전망 표.
import { StatusBadge } from "@/components/common/status-badge";
import { TableHeaderRow } from "@/components/common/table-header-row";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { formatQuantity } from "@/lib/format";
import { STOCK_FLAG_LABEL } from "@/lib/labels";
import type { WeekRow } from "@/types/supply";

const COLUMNS = ["주(월요일)", "기초재고", "입고", "평시 수요", "캠페인 수요", "기말재고", "부족", "커버(주)", "상태"];

export function WeeklyProjectionTable({ rows }: { rows: WeekRow[] }) {
  return (
    <Table>
      <TableHeaderRow columns={COLUMNS} />
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.week}>
            <TableCell>{row.week}</TableCell>
            <TableCell>{formatQuantity(row.opening_qty)}</TableCell>
            <TableCell>{row.inbound_qty ? `${formatQuantity(row.inbound_qty)} (${row.inbound_refs.join(", ")})` : "-"}</TableCell>
            <TableCell>{formatQuantity(row.baseline_qty)}</TableCell>
            <TableCell>{row.campaign_qty ? formatQuantity(row.campaign_qty) : "-"}</TableCell>
            <TableCell>{formatQuantity(row.closing_qty)}</TableCell>
            <TableCell>{row.shortage_qty ? formatQuantity(row.shortage_qty) : "-"}</TableCell>
            <TableCell>{row.cover_weeks ?? "-"}</TableCell>
            <TableCell>{row.flag === "ok" ? STOCK_FLAG_LABEL.ok : <StatusBadge tone="warn">{STOCK_FLAG_LABEL[row.flag]}</StatusBadge>}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
