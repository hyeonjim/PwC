import type { ReactNode } from "react";

import { SourceBadge } from "@/components/common/source-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** 제목·설명이 있는 카드 묶음. sourceType 을 주면 설명 끝에 출처 꼬리표를 붙인다. */
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {hasDescription && (
          <CardDescription>
            {description} {sourceType && <SourceBadge type={sourceType} />}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}
