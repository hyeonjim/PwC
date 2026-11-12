// 백엔드(/api/v1) 응답 형식 — 작업(task)·처리 이력 공통. backend/app/schemas/task.py 와 맞춘다.

export type TaskBase<Payload> = {
  id: number;
  kind: string;
  title: string;
  status: string;
  payload: Payload;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: number;
  task_id: number | null;
  actor: string;
  action: string;
  note: string;
  detail: Record<string, unknown>;
  created_at: string;
};
