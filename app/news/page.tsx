import type { Metadata } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { NewsScreen } from "@/components/domain/NewsScreen";
import { listBpNews } from "@/lib/supabase/query-parts/bpNews";

export const metadata: Metadata = {
  title: "야구 뉴스",
  description: "KBO 프로야구 최신 뉴스를 팀별로 모아봅니다.",
  alternates: { canonical: "/news" }
};

export default async function NewsPage() {
  noStore();
  const news = await listBpNews(100);
  return <NewsScreen news={news} />;
}
