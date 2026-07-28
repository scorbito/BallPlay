// 커스텀 야구공 아이콘 — lucide-react 1.14.0 에 Baseball 이 없어서 직접 SVG로 그린다.
// 원형 + 좌우 stitching 곡선. lucide 아이콘과 동일하게 size prop 을 받아
// HomeScreen 의 카드 아이콘(typeof ListChecks) 자리에도 그대로 꽂을 수 있다.
//
// 색이 있는 BP 포인트용 공은 components/domain/points/PointBaseballIcon 이 따로 있다.
// 이쪽은 currentColor 를 따르는 단색 라인 아이콘이다.

type Props = {
  size?: number;
  className?: string;
};

export function BaseballIcon({ size = 24, className }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M5.5 6.5c1.2 1.6 1.8 3.5 1.8 5.5s-.6 3.9-1.8 5.5" />
      <path d="M18.5 6.5c-1.2 1.6-1.8 3.5-1.8 5.5s.6 3.9 1.8 5.5" />
    </svg>
  );
}
