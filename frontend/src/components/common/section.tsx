import type { ReactNode } from "react";

import { SourceBadge } from "@/components/common/source-badge";

/** 제목·설명 아래에 카드 하나를 두는 묶음. sourceType 을 주면 설명 끝에 출처 꼬리표를 붙인다. */
export function Section({
  title,
  description,
  sourceType,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  sourceType?: string;
  children: ReactNode;
}) {
  const hasDescription = description != null || sourceType != null;
  return (
    <section className="section">
      <div>
        <h2 className="section-title">{title}</h2>
        {hasDescription && (
          <p className="section-description">
            {description} {sourceType && <SourceBadge type={sourceType} />}
          </p>
        )}
      </div>
      <div className="surface-card">{children}</div>
    </section>
  );
}
