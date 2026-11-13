import { LoaderCircle } from "lucide-react";

import { ErrorText } from "@/components/common/error-text";

export function LoadingMessage({ error }: { error: string | null }) {
  return error ? (
    <ErrorText error={`불러오지 못했습니다: ${error}`} />
  ) : (
    <p className="state-message">
      <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      불러오는 중…
    </p>
  );
}
