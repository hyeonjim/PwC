// 백엔드(FastAPI) 호출 도우미.
// - 배포: 화면과 API 가 같은 주소라 상대 경로(/api/...)로 부른다.
// - 개발: Next.js 개발 서버(3000)에서 FastAPI(8000)를 부른다.
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }
  return (await res.json()) as T;
}

export type Health = {
  status: string;
  db: string;
  db_engine: string;
  raw_tables: number;
  ai_configured: boolean;
  ai_model: string;
};

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

/** 오류를 화면에 보여 줄 한 줄 글자로 바꾼다. FastAPI 의 {"detail": "..."} 를 풀어 준다. */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    try {
      const body = JSON.parse(e.message) as { detail?: unknown };
      if (typeof body.detail === "string") return body.detail;
    } catch {
      /* JSON 이 아니면 그대로 보여 준다 */
    }
    return `${e.status} ${e.message}`;
  }
  return e instanceof Error ? e.message : String(e);
}
