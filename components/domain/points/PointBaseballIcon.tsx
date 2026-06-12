type PointBaseballIconProps = {
  size?: number;
  className?: string;
};

export function PointBaseballIcon({ size = 14, className = "point-chip-ball-icon" }: PointBaseballIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.12" />
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M7.1 5.9c1.3 1.6 2 3.7 2 6.1s-.7 4.5-2 6.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16.9 5.9c-1.3 1.6-2 3.7-2 6.1s.7 4.5 2 6.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M6.4 8.6l2.2.8M6.1 12h2.4M6.4 15.4l2.2-.8M17.6 8.6l-2.2.8M17.9 12h-2.4M17.6 15.4l-2.2-.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
