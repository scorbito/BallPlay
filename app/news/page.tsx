import { unstable_noStore as noStore } from "next/cache";
import { NewsScreen } from "@/components/domain/NewsScreen";
import { listBpNews } from "@/lib/supabase/query-parts/bpNews";

export default async function NewsPage() {
  noStore();
  const news = await listBpNews(100);
  return <NewsScreen news={news} />;
}
