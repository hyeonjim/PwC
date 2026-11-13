import { CircleAlert } from "lucide-react";

/** 오류가 있을 때만 채도를 낮춘 빨간 글자로 보여 준다. */
export function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p className="state-message state-message-error">
      <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
      {error}
    </p>
  ) : null;
}
