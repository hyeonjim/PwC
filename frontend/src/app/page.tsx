"use client";

import { useEffect, useState } from "react";

import { api, type Health } from "@/lib/api";

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Health>("/health")
      .then(setHealth)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-semibold">Aurora 운영 시스템</h1>
      <p className="mt-1 text-sm text-zinc-500">
        캠페인 수요와 공급 일정 · 기준일 2026-07-01
      </p>

      <section className="mt-8 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="font-medium">시스템 연결 상태</h2>
        {error && <p className="mt-3 text-sm text-red-600">백엔드 연결 실패: {error}</p>}
        {!error && !health && <p className="mt-3 text-sm text-zinc-500">확인 중…</p>}
        {health && (
          <dl className="mt-3 grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
            <dt className="text-zinc-500">백엔드</dt>
            <dd>{health.status}</dd>
            <dt className="text-zinc-500">DB</dt>
            <dd>
              {health.db} ({health.db_engine})
            </dd>
            <dt className="text-zinc-500">원본 데이터</dt>
            <dd>CSV {health.raw_tables}개</dd>
            <dt className="text-zinc-500">AI</dt>
            <dd>
              {health.ai_configured ? `연결됨 · ${health.ai_model}` : "키 미설정 (예비 판단 모드)"}
            </dd>
          </dl>
        )}
      </section>
    </main>
  );
}
