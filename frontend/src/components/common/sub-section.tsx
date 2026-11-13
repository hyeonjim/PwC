import type { ReactNode } from "react";

/** Section 안에서 소제목 아래에 내용을 묶는다. */
export function SubSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="sub-title">{title}</h3>
      {children}
    </div>
  );
}
