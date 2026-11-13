"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAVIGATION_ITEMS = [
  ["/", "오늘 할 일"],
  ["/cases/", "캠페인 검토"],
  ["/work/", "승인·작업함"],
  ["/supply/", "SKU 수요·공급"],
  ["/cash/", "현금·약정"],
  ["/data/", "원본·가정"],
] as const;

/** 지금 주소가 이 메뉴에 속하는지. 홈은 정확히 일치할 때만, 나머지는 하위 주소도 포함한다. */
const isCurrentPage = (pathname: string, href: string) => (href === "/" ? pathname === "/" : `${pathname}/`.startsWith(href));

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-brand">
          Masil Commerce
        </Link>
        <nav className="site-nav" aria-label="주 메뉴">
          {NAVIGATION_ITEMS.map(([href, label]) => (
            <Link key={href} href={href} className="site-nav-link" aria-current={isCurrentPage(pathname, href) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <span className="site-header-meta">2026-07-01</span>
      </div>
    </header>
  );
}
