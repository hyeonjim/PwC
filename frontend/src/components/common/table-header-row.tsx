import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** 열 이름 목록으로 표 머리줄을 만든다. 빈 글자는 빈 칸이 된다. numericColumns 에 든 열(0부터)은 오른쪽 정렬한다. */
export function TableHeaderRow({ columns, numericColumns = [] }: { columns: string[]; numericColumns?: number[] }) {
  return (
    <TableHeader>
      <TableRow>
        {columns.map((column, index) => (
          <TableHead key={`${index}-${column}`} className={numericColumns.includes(index) ? "table-number" : undefined}>
            {column}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}
