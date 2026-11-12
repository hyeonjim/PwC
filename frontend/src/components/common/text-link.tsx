import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** 밑줄 있는 글자 링크 */
export function TextLink({ className, ...props }: ComponentProps<typeof Link>) {
  return <Link className={cn("underline", className)} {...props} />;
}
