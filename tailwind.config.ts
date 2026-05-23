import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-pretendard)", "Pretendard", "system-ui", "sans-serif"]
      },
      colors: {
        // === 기존 토큰 (호환 유지) ===
        primary: "#FF6B35",
        surface: "#FFFFFF",
        ink: "#1A1A1A",
        subtle: "#6B7280",
        win: "#16A34A",
        lose: "#DC2626",
        draw: "#6B7280",
        verified: "#FFD700",

        // === BallPlay 시맨틱 토큰 (CSS 변수 기반, globals.css와 동기화) ===
        // 사용법 예: bg-bp-card, text-bp-text-muted, border-bp-line
        bp: {
          bg: "var(--bp-bg)",
          "bg-soft": "var(--bp-bg-soft)",
          "bg-elevated": "var(--bp-bg-elevated)",
          "bg-section": "var(--bp-bg-section)",
          card: "var(--bp-card)",
          "card-soft": "var(--bp-card-soft)",
          text: "var(--bp-text)",
          "text-strong": "var(--bp-text-strong)",
          "text-secondary": "var(--bp-text-secondary)",
          "text-muted": "var(--bp-text-muted)",
          "text-subtle": "var(--bp-text-subtle)",
          "text-on-color": "var(--bp-text-on-color)",
          line: "var(--bp-line)",
          "line-soft": "var(--bp-line-soft)",
          "line-strong": "var(--bp-line-strong)",
          success: "var(--bp-success)",
          "success-soft": "var(--bp-success-soft)",
          danger: "var(--bp-danger)",
          "danger-soft": "var(--bp-danger-soft)",
          warning: "var(--bp-warning)",
          "warning-soft": "var(--bp-warning-soft)",
          info: "var(--bp-info)",
          "info-soft": "var(--bp-info-soft)",
          accent: "var(--bp-accent)",
          "accent-strong": "var(--bp-accent-strong)",
          "accent-soft": "var(--bp-accent-soft)",
          "accent-2": "var(--bp-accent-2)",
          "accent-2-strong": "var(--bp-accent-2-strong)",
          "accent-2-soft": "var(--bp-accent-2-soft)",
          "accent-3": "var(--bp-accent-3)",
          "accent-3-strong": "var(--bp-accent-3-strong)",
          "accent-3-soft": "var(--bp-accent-3-soft)",
          "game-victory": "var(--bp-game-victory)",
          "game-victory-strong": "var(--bp-game-victory-strong)"
        },

        // === KBO 10팀 컬러 ===
        // 사용법 예: bg-team-doosan, text-team-lg, bg-team-hanwha-soft
        team: {
          doosan: "var(--team-doosan)",
          "doosan-soft": "var(--team-doosan-soft)",
          lg: "var(--team-lg)",
          "lg-soft": "var(--team-lg-soft)",
          kt: "var(--team-kt)",
          "kt-accent": "var(--team-kt-accent)",
          "kt-soft": "var(--team-kt-soft)",
          ssg: "var(--team-ssg)",
          "ssg-soft": "var(--team-ssg-soft)",
          nc: "var(--team-nc)",
          "nc-soft": "var(--team-nc-soft)",
          kiwoom: "var(--team-kiwoom)",
          "kiwoom-soft": "var(--team-kiwoom-soft)",
          samsung: "var(--team-samsung)",
          "samsung-soft": "var(--team-samsung-soft)",
          lotte: "var(--team-lotte)",
          "lotte-soft": "var(--team-lotte-soft)",
          kia: "var(--team-kia)",
          "kia-soft": "var(--team-kia-soft)",
          hanwha: "var(--team-hanwha)",
          "hanwha-soft": "var(--team-hanwha-soft)"
        }
      }
    }
  },
  plugins: []
};

export default config;
