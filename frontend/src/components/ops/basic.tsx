// 틀 단계용 기본 조각들. 디자인 없이 글자와 카드만 쓴다.
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SOURCE_TYPE } from "@/lib/format";

export function Section({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{children}</CardContent>
    </Card>
  );
}

/** 이 값이 원본인지, 부서 주장인지, 가정인지, 계산인지, 모의 입력인지 알려 주는 꼬리표. */
export function Src({ type }: { type: "fact" | "claim" | "assumption" | "calculation" | "mock" | string }) {
  return <Badge variant="outline">{SOURCE_TYPE[type] ?? type}</Badge>;
}

export function Status({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "warn" | "muted" }) {
  return (
    <Badge variant={tone === "warn" ? "destructive" : tone === "muted" ? "secondary" : "default"}>{children}</Badge>
  );
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-xl font-semibold">{title}</h1>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export function Loading({ error }: { error: string | null }) {
  return error ? (
    <p className="text-sm text-destructive">불러오지 못했습니다: {error}</p>
  ) : (
    <p className="text-sm text-muted-foreground">불러오는 중…</p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

/** 이름표: 값 줄 목록 */
export function Facts({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const inputClass = "h-8 rounded-lg border border-border bg-background px-2 text-sm";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
