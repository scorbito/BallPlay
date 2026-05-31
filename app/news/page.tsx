import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { NewsScreen } from "@/components/domain/NewsScreen";
import { listBpNews } from "@/lib/supabase/query-parts/bpNews";

export const metadata: Metadata = {
  title: "야구 뉴스",
  description: "KBO 프로야구 최신 뉴스를 팀별로 모아봅니다.",
  alternates: { canonical: "/news" }
};

// 초기 50건 SSR — 추가 50건씩 클라이언트 "더 보기"로 fetch.
const INITIAL_PAGE_SIZE = 50;

export default async function NewsPage() {
  noStore();
  const news = await listBpNews(INITIAL_PAGE_SIZE);
  return <NewsScreen initialNews={news} pageSize={INITIAL_PAGE_SIZE} />;
}
