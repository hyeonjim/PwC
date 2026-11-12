import Link from "next/link";

const NAVIGATION_ITEMS = [
  ["/", "오늘 할 일"],
  ["/cases/", "캠페인 검토"],
  ["/work/", "승인·작업함"],
  ["/supply/", "SKU 수요·공급"],
  ["/cash/", "현금·약정"],
  ["/data/", "원본·가정"],
] as const;

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-baseline gap-x-5 gap-y-1 px-4 py-3">
        <Link href="/" className="font-semibold">
          Masil 캠페인 수요·공급 조정
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-base">
          {NAVIGATION_ITEMS.map(([href, label]) => (
            <Link key={href} href={href} className="hover:underline">
              {label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto text-base text-muted-foreground">기준일 2026-07-01</span>
      </div>
    </header>
  );
}
