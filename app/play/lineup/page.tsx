import type { Metadata } from "next";
import { LineupBuilderScreen } from "@/components/domain/LineupBuilderScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "팀 관리",
  description: "KBO 팀 슬롯을 운영하고 라인업을 자유롭게 구성하세요.",
  alternates: { canonical: "/play/lineup" }
};

export default function LineupPage({
  searchParams
}: {
  searchParams?: { entry?: string; back?: string };
}) {
  return (
    <LineupBuilderScreen
      initialEntryId={searchParams?.entry ?? null}
      backHref={searchParams?.back ?? null}
    />
  );
}
