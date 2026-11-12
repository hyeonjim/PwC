import { TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** 열 이름 목록으로 표 머리줄을 만든다. 빈 글자는 빈 칸이 된다. */
export function TableHeaderRow({ columns }: { columns: string[] }) {
  return (
    <TableHeader>
      <TableRow>
        {columns.map((column, index) => (
          <TableHead key={`${index}-${column}`}>{column}</TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}
