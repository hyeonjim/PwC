import type { Metadata } from "next";
import "./globals.css";

// 폰트는 시스템 한글 폰트를 쓴다(globals.css 의 --font-sans).
// next/font/google 은 빌드 때 외부에서 내려받아 배포 빌드를 불안정하게 할 수 있어 쓰지 않는다.

export const metadata: Metadata = {
  title: "Aurora 운영 시스템",
  description: "캠페인 수요와 공급 일정 — AI 운영 시스템",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
