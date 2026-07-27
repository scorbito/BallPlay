import { AppShell } from "@/components/layout/AppShell";
import type { Notice } from "@/lib/types/domain";

type Props = {
  notice: Notice;
};

function formatDateTime(iso: string) {
  // published_at 은 UTC(timestamptz). 서버(Vercel)가 UTC라 getHours() 등은 9시간 밀림 →
  // 반드시 한국 시간(Asia/Seoul)으로 명시 변환한다. formatToParts 로 안전하게 조립.
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value])
  );
  return `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}`;
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
