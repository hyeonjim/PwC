import { ErrorText } from "@/components/common/error-text";
import { MutedText } from "@/components/common/muted-text";

export function LoadingMessage({ error }: { error: string | null }) {
  return error ? <ErrorText error={`불러오지 못했습니다: ${error}`} /> : <MutedText>불러오는 중…</MutedText>;
}
