import { CouponsScreen } from "@/components/domain/CouponsScreen";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "내 쿠폰함",
  description: "이벤트 당첨 쿠폰을 확인하고 저장하세요."
};

export default function CouponsPage() {
  return <CouponsScreen />;
}
