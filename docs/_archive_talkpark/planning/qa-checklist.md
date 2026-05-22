# 운영 체크리스트

> 현재 Phase별 진행 현황과 MVP 출시 이후 운영·성장 단계의 후속 작업을 모은 문서.
> 새 작업자가 이어 받을 때 가장 먼저 보는 단일 진실 원천.

관련 문서:
- 기능 명세: [feature-overview.md](./feature-overview.md)
- Phase 구현 히스토리: [phase-history.md](./phase-history.md)
- 진행 로그: [progress-log.md](./progress-log.md)
- 의사결정 히스토리: [decision-log.md](./decision-log.md)
- 상위 인덱스: [../WORKPLAN.md](../WORKPLAN.md)

## 1. 진행 현황 요약

| Phase | 상태 | 담당 | 마지막 업데이트 |
|---|---|---|---|
| Phase 1. 프로젝트 스캐폴딩 | Completed / Reviewed | Codex | 2026-05-06 |
| Phase 2. 디자인 토큰/공통 컴포넌트 | Completed / Reviewed | Codex | 2026-05-06 |
| Phase 3. 홈/랜딩/온보딩 | Completed / Reviewed | Codex | 2026-05-06 |
| Phase 4. 일정/경기 상세/팀 순위 | Completed / Reviewed (게임 상세는 Phase 8.7에서 보류) | Codex | 2026-05-08 |
| Phase 5. 커뮤니티/마이/설정 | Completed / Reviewed | Codex | 2026-05-06 |
| Phase 6. 모달/공유 카드 | Completed / Reviewed | Codex | 2026-05-06 |
| Phase 6.5. 프론트 인터랙션 완성 | Completed / QA Passed | Codex + Subagents | 2026-05-06 |
| Phase 6.8. 추가 수정사항 | Completed / QA Passed | Codex | 2026-05-06 |
| Phase 7. 서비스 데이터 모델/API 설계 | Completed / Release Accepted | Codex | 2026-05-13 |
| Phase 8. 인증/DB/스토리지 연동 | Completed / Release Accepted | Codex | 2026-05-13 |
| Phase 8.5. 외부 데이터 연동 | Completed / Operational Monitoring | Codex | 2026-05-13 |
| Phase 8.6. 후기 댓글 기능 | Completed | Codex | 2026-05-08 |
| Phase 8.7. 다크 컨셉 전면 리디자인 | Completed | Codex | 2026-05-08 |
| Phase 8.8. 소셜 로그인(Google + 카카오) + 인증/온보딩 다크 리디자인 | Completed / Release Accepted | Codex | 2026-05-13 |
| Phase 8.9. 익명 로그인 + 정식 계정 업그레이드 | Completed / Release Accepted | Codex | 2026-05-13 |
| Phase 9. 반응형/접근성/시각 QA | Completed / MVP 기준 검토 완료 | Codex | 2026-05-13 |
| Phase 9.5. 운영 페이지 (공지·이용안내·문의·약관) | Completed / Release Accepted | Codex | 2026-05-13 |
| Phase 10. 배포 준비 | Completed / Production Released | Codex | 2026-05-13 |
| Phase 10.5. 출시 직전 마무리 라운드 | Completed / 사용자 실측 확인 (2026-05-11 ~ 05-12) | Codex | 2026-05-12 |
| Phase 11. 인수 문서/마무리 | Completed / 운영 문서 분리 완료 | Codex | 2026-05-13 |
| Phase 12. MVP 이후 운영 백로그 | Operational Backlog (사용자 모집 이후 개선) | Codex | 2026-05-13 |

> 진행 요약: **MVP 출시 완료 및 사용자 모집 단계 진입(2026-05-13)**. 모든 핵심 Phase가 MVP 기준 검토와 사용자 실측 검증을 통과했고, 운영 도메인에서 사용자 가입·직관·후기·공유·알림 전체 흐름이 동작한다. 남은 항목은 출시 차단 이슈가 아니라 운영 중 개선/관측/성장 백로그다.


## 2. 운영·성장 백로그

> 시간순 구현 기록은 [phase-history.md](./phase-history.md)에 보존한다. 이 섹션은 **사용자를 모으면서 운영 중에 개선할 작업**을 카테고리별로 모은 백로그다.

### 2.1. 출시 검토 완료 기록

MVP 출시와 실제 홍보 단계 진입을 기준으로, 아래 항목은 출시 차단 검토가 끝난 것으로 처리한다.

- [x] Phase 7 (서비스 데이터 모델/API 설계) MVP 기준 검토 완료
- [x] Phase 8 (인증/DB/스토리지 연동) MVP 기준 검토 완료
- [x] Phase 8.5 (외부 데이터 연동) MVP 기준 검토 완료, 운영 모니터링으로 전환
- [x] Phase 8.8 (소셜 로그인 + 다크 리디자인) MVP 기준 검토 완료
- [x] Phase 8.9 (익명 → 정식 업그레이드) MVP 기준 검토 완료
- [x] Phase 9.5 (운영 페이지) MVP 기준 검토 완료
- [x] Phase 10 (배포 준비) 프로덕션 배포 완료
- [x] Phase 10.5 (출시 직전 마무리) 사용자 실측 확인 완료

### 2.2. QA·접근성

MVP 출시 기준의 주요 반응형/시각/실기기 검토는 완료됐다. 아래는 운영 중 개선 품질 항목으로 유지한다.

- [x] 색 대비/명도 MVP 기준 검토
- [x] 키보드 포커스/visible focus MVP 기준 검토
- [x] 이미지 alt 텍스트 MVP 기준 검토
- [x] 폼 input label MVP 기준 검토
- [x] `npm run lint` 회귀 점검
- [x] `npm run build` 회귀 점검
- [x] 실기기 수동 QA (iPhone Safari/PWA, Android Chrome/PWA, 데스크톱 Chrome/Edge/Safari)
- [ ] Playwright/E2E 자동화 도입 검토 (선택)

### 2.3. 운영 관측성 (Phase 8.5 잔여)

운영 중 관측과 장애 대응 품질을 높이기 위한 항목이다.

- [ ] Vercel Cron 실행 로그 30일 추적 — 실패율 0% 목표
- [ ] KBO/네이버 API 응답 변화 감지 — schema 변동 시 빠른 인지
- [ ] 동기화 실패 알림 채널 (Slack/Discord/이메일 중 택1)
- [ ] cron-job.org 백업 옵션 활성화 검토 — Vercel Hobby 하루 1회 제한 회피용

### 2.4. 약관·동의 (Phase 9.5 잔여)

- [ ] 이용약관/개인정보처리방침 법무 검토
- [ ] 회원가입 시 동의 체크박스 도입 (현재는 약관 페이지만 게시)
- [x] mailto 문의 MVP 기준 실측 확인
- [x] 공지 게시 워크플로 MVP 기준 확인

### 2.5. 운영 문서화

- [ ] 환경변수표 문서화 — `.env.example`을 docs로 끌어내 의미·발급처·교체 주기 표시
- [ ] seed 데이터/SQL 적용 순서 문서화 — clean checkout에서 재현 가능하게
- [x] CORS/도메인 화이트리스트 MVP 기준 점검
- [ ] Vercel/Supabase 에러 로그 1주 모니터링 후 P1 이슈 처리

### 2.6. 인수 문서

- [x] WORKPLAN 인덱스화
- [x] 기능 명세/Phase 히스토리/QA/진행 로그/의사결정 로그 분리
- [x] 구현 화면 목록 정리
- [x] 남은 TODO 인덱싱
- [x] 알려진 제한사항 기록 (예: 게임 상세 페이지 보류, 카카오 비즈 앱 미인증, 익명 user 디바이스 의존)
- [ ] README 업데이트 — 실행, 빌드, 주요 폴더, 디자인 기준
- [ ] clean checkout 기준 실행 가능 여부 확인

### 2.7. 다음 라운드 후보 (출시 후 검토)

- [ ] Supabase Realtime 도입 — 실시간 후기/좋아요/댓글/친구 알림
- [ ] Next.js 15 업그레이드 시 React #310 우회 패턴 재검토
- [ ] 직관 경험치/레벨 시스템 — `result_acknowledged_at` 트리거 재사용, 부정 방지(seat unique constraint, 시간 윈도우, 일일 캡)
- [ ] 어드민 콘솔 — 현재 Supabase Studio 직접 입력 → 운영자용 간이 어드민 페이지
- [ ] 친구 추천 알고리즘 — 현재는 placeholder
- [ ] 푸시 알림 — 현재 in-app 알림만, FCM/APNs 연동 검토
- [ ] 유입 분석 — 현재 추적 안 함, 옵션 A(자체 referrer/utm 테이블) 또는 Vercel Analytics 도입 검토
