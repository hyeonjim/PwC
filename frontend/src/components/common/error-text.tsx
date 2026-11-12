/** 오류가 있을 때만 빨간 글자로 보여 준다. */
export function ErrorText({ error }: { error: string | null }) {
  return error ? <p className="text-base text-destructive">{error}</p> : null;
}
