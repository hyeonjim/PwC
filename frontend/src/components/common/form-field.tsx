import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const inputClassName = "h-9 rounded-lg border border-border bg-background px-2 text-base";

/** 라벨이 위에 붙은 입력 칸 묶음 */
export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-base">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/** 기본 모양이 들어간 input. 글자·날짜·숫자 입력에 모두 쓴다. */
export function TextInput({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClassName, className)} {...props} />;
}
