import type { ReactNode } from "react";

/** 이름표: 값 줄 목록 */
export function FactList({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="fact-list">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
