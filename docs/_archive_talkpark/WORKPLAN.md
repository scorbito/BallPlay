# 오늘은 승요 작업계획서

> **상태(2026-05-13 기준): MVP 출시 완료 ✅**
> 프로덕션 도메인에 배포된 상태이며, 핵심 기능은 모두 구현·검증됐다. 현재는 실제 홍보와 사용자 모집을 진행하는 운영 단계다. 후속 개선/운영 백로그는 [planning/qa-checklist.md](./planning/qa-checklist.md) 참조.

이 문서는 작업 인덱스(README 역할)다. 상세 내용은 아래 문서로 분리되어 있으며, 각 문서는 독립적으로 갱신·참조한다.

## 문서 구성

| 문서 | 역할 |
|------|------|
| **WORKPLAN.md** (이 파일) | 현재 상태 요약 + 다음 작업 + 분리 문서 인덱스 |
| [VERSION.md](./VERSION.md) | 현재 버전, 버전 정책, 릴리즈 기록 |
| [planning/feature-overview.md](./planning/feature-overview.md) | 현재 제품 기능, 화면, 정책, 기술 스택 요약 |
| [planning/season-level.md](./planning/season-level.md) | 시즌 레벨/XP/칭호 기능 기획 |
| [planning/match-talk.md](./planning/match-talk.md) | 경기톡 게시판(커뮤니티 2번째 탭) 기획 |
| [planning/season-level-backfill.md](./planning/season-level-backfill.md) | 시즌 레벨 백필 정책 |
| [planning/profile-modal.md](./planning/profile-modal.md) | 프로필 모달/자기소개 기획 |
| [development/season-level-implementation.md](./development/season-level-implementation.md) | 시즌 레벨 단계별 개발 계획 |
| [planning/phase-history.md](./planning/phase-history.md) | Phase별 구현 히스토리 요약 |
| [planning/progress-log.md](./planning/progress-log.md) | 병렬 작업 전략, 단계 완료 기준, 리뷰어 검수 결과(개발 프로세스) |
| [planning/qa-checklist.md](./planning/qa-checklist.md) | 진행 현황 표 + 운영·성장 백로그 |
| [planning/decision-log.md](./planning/decision-log.md) | 시간순 의사결정 로그(왜 그 선택을 했는지) |

## 현재 상태 (2026-05-13)

- **MVP 출시 완료 및 사용자 모집 단계 진입** — 프로덕션 도메인 배포, 가입·직관 등록·후기 작성·공유·알림 전 흐름 동작
- **Phase 1 ~ 11** 모두 MVP 기준 구현·검토·실측 확인 완료
- **마지막 라운드 (2026-05-11 ~ 05-12)** — PWA 설치 가이드, 새로고침 UX, React #310 진단/해결, 공유 카드 Canvas 2D 재구성, 디폴트 닉네임 다양화, 직관 모달 UX, 후기 사진 캐러셀/라이트박스
- **후속 백로그**: 운영 관측성, 약관 법무 검토/동의 체크박스, 환경변수/seed 문서화, README 보강, 다음 라운드 후보(Realtime/레벨 시스템/푸시/유입 분석 등)

## 다음 작업 후보 (우선순위 순)

1. **사용자 모집/홍보 운영** — 초기 사용자 반응, 문의, 이탈 지점 기록
2. **운영 관측성** — Vercel Cron 실행 로그 추적, 동기화 실패 알림 — [qa-checklist.md § 2.3](./planning/qa-checklist.md)
3. **법무/동의 보강** — 약관 법무 검토 + 회원가입 동의 체크박스 — [qa-checklist.md § 2.4](./planning/qa-checklist.md)
4. **운영 문서화** — 환경변수표, seed/SQL 적용 순서, README 보강 — [qa-checklist.md § 2.5](./planning/qa-checklist.md)
5. **다음 라운드 후보** — Supabase Realtime, 프로필 모달 + 자기소개([기획](./planning/season-level.md#12-프로필-모달과-자기소개)·[개발](./development/season-level-implementation.md) Step 0), 직관 경험치 시스템([기획](./planning/season-level.md)·[개발](./development/season-level-implementation.md)), 경기톡 게시판([기획](./planning/match-talk.md)) ✅ 출시, 푸시 알림, 유입 분석 — [qa-checklist.md § 2.7](./planning/qa-checklist.md)

## 작업 워크플로

- 새 작업 시작 시 [qa-checklist.md](./planning/qa-checklist.md)에서 해당 항목을 찾아 진행
- 작업 완료 시 체크박스 갱신 + 해당 분리 문서에 결과 기록
- 기능 범위가 바뀌면 [feature-overview.md](./planning/feature-overview.md), 구현 이력이 중요하면 [phase-history.md](./planning/phase-history.md)를 갱신
- 의사결정/트레이드오프가 있었다면 [decision-log.md](./planning/decision-log.md)에 날짜와 함께 추가
- 리뷰어 검수를 받았다면 [progress-log.md](./planning/progress-log.md)에 결과 누적

## 기준 자료 (요약)

- 기획/디자인 브리프: `data/design_brief.md`
- 디자인 시안 PNG 4장: `data/ChatGPT Image 2026년 5월 5일 오후 06_14_00 (*.png)`
- 사용 가능 이미지 어셋: `public/assets/*.png`
- 제품 스펙: [product-spec.md](./product-spec.md)
- KBO 구단 로고는 사용하지 않음. 팀 표현은 팀명·팀 컬러·이니셜·추상 배지로 대체.

## 기술 스택 (요약)

Next.js App Router + TypeScript + Supabase(Auth/DB/Storage) + Gemini Vision + Vercel(icn1). 자세한 결정 사항은 [feature-overview.md § 4](./planning/feature-overview.md), 변경 히스토리는 [decision-log.md](./planning/decision-log.md) 참조.
