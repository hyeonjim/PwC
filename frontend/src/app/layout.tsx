import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

// 폰트는 시스템 한글 폰트를 쓴다(globals.css 의 --font-sans).
// next/font/google 은 빌드 때 외부에서 내려받아 배포 빌드를 불안정하게 할 수 있어 쓰지 않는다.

export const metadata: Metadata = {
  title: "Aurora 운영 시스템",
  description: "캠페인 수요와 공급 일정 — AI 운영 시스템",
};

const NAV = [
  ["/", "오늘 할 일"],
  ["/cases/", "캠페인 검토"],
  ["/work/", "승인·작업함"],
  ["/supply/", "SKU 수요·공급"],
  ["/cash/", "현금·약정"],
  ["/data/", "원본·가정"],
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-border">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline gap-x-5 gap-y-1 px-4 py-3">
            <Link href="/" className="font-semibold">
              Masil 캠페인 수요·공급 조정
            </Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="hover:underline">
                  {label}
                </Link>
              ))}
            </nav>
            <span className="ml-auto text-sm text-muted-foreground">기준일 2026-07-01</span>
          </div>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
