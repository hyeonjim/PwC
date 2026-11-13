import type { ReactNode } from "react";

/** 페이지 맨 위 제목 + 한 줄 설명. action 을 주면 오른쪽에 주요 버튼을 둔다. */
export function PageTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action}
    </div>
  );
}
