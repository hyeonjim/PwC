// 처리 이력 목록: 누가 언제 무엇을 했는지.
import { MutedText } from "@/components/common/muted-text";
import { TextLink } from "@/components/common/text-link";
import { formatDateTime } from "@/lib/format";
import type { EventRow } from "@/types/task";

export function EventList({ events, showCase = false }: { events: EventRow[]; showCase?: boolean }) {
  if (events.length === 0) return <MutedText>아직 이력이 없습니다.</MutedText>;
  return (
    <ol className="flex flex-col gap-1.5 text-base">
      {events.map((event) => (
        <li key={event.id} className="flex flex-wrap gap-x-2">
          <span className="text-muted-foreground">{formatDateTime(event.created_at)}</span>
          <span className="font-medium">
            {event.actor} · {event.action}
          </span>
          {showCase && event.task_id != null && <TextLink href={`/cases/detail/?id=${event.task_id}`}>#{event.task_id}</TextLink>}
          <span className="basis-full text-muted-foreground sm:basis-auto">{event.note}</span>
        </li>
      ))}
    </ol>
  );
}
