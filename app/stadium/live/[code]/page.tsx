import { LiveMatchScreen } from "@/components/domain/stadium/LiveMatchScreen";

export const dynamic = "force-dynamic";

export default function StadiumLiveMatchPage({
  params
}: {
  params: { code: string };
}) {
  return <LiveMatchScreen inviteCode={params.code} />;
}
