import { redirect } from "next/navigation";

// v1: 미니게임이 라인업 짜기 하나뿐이라 허브 페이지 없앰. BottomTabs는 바로
// /play/lineup으로 보내고, 직접 /play로 들어온 경우만 여기서 리다이렉트.
// 추후 미니게임이 늘어나면 다시 허브 화면으로 부활 가능.
export default function PlayHubPage() {
  redirect("/play/lineup");
}
