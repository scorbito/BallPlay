import { AppShell } from "@/components/layout/AppShell";
import type { Notice } from "@/lib/types/domain";

type Props = {
  notice: Notice;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const yy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

export function NoticeDetailScreen({ notice }: Props) {
  return (
    <AppShell activeTab="my" title="공지사항" theme="light" backHref="/my/notices">
      <article className="notice-detail">
        <header>
          <h1>{notice.title}</h1>
          <time>{formatDateTime(notice.publishedAt)}</time>
        </header>
        <div className="notice-body">
          {notice.body.split("\n").map((line, i) => (
            line.trim() === "" ? <br key={i} /> : <p key={i}>{line}</p>
          ))}
        </div>
      </article>
    </AppShell>
  );
}
