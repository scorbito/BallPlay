# Phase 구현 히스토리

> 「오늘은 승요」 MVP가 어떤 순서로 만들어졌는지 보존하는 요약 문서입니다.
> 최신 상태 판단은 [qa-checklist.md](./qa-checklist.md)를 기준으로 하고, 현재 기능 파악은 [feature-overview.md](./feature-overview.md)를 먼저 봅니다.

관련 문서:
- 현재 기능 명세: [feature-overview.md](./feature-overview.md)
- 진행 현황 + 운영 백로그: [qa-checklist.md](./qa-checklist.md)
- 리뷰 로그 + 개발 프로세스: [progress-log.md](./progress-log.md)
- 의사결정 히스토리: [decision-log.md](./decision-log.md)
- 상위 인덱스: [../WORKPLAN.md](../WORKPLAN.md)

## 1. Phase 1 ~ 6: UI 목업과 기본 경험

### Phase 1. 프로젝트 스캐폴딩

Next.js App Router, TypeScript, 기본 폴더 구조, lint/build/dev script, Pretendard 적용 방식, 이미지 어셋 정리를 완료했습니다.

상태: Completed / Reviewed

### Phase 2. 디자인 토큰과 공통 컴포넌트

색상 토큰, 팀 컬러, `TeamBadge`, `AppShell`, `Button`, `Card`, `SegmentedControl`, `FilterChips`, `ModalShell`, 주요 도메인 카드를 구현했습니다. KBO 로고 없이 팀 컬러와 이니셜 기반 표현을 고정했습니다.

상태: Completed / Reviewed

### Phase 3. 홈/랜딩/온보딩

랜딩, 로그인 UI, 온보딩 닉네임/팀 선택, 홈 빈 상태, 승률 히어로, 오늘 경기 배너, 미니 캘린더, 팀 순위 흐름을 구현했습니다.

상태: Completed / Reviewed

### Phase 4. 일정/경기 상세/팀 순위

월간/주간 일정, 캘린더 셀 배지, 선택일 상세, 경기 상세 목업, 팀 순위 페이지를 구현했습니다. 이후 MVP에서는 경기 상세 직접 진입을 보류하고 일정 중심 흐름으로 정리했습니다.

상태: Completed / Reviewed

### Phase 5. 커뮤니티/마이/설정

커뮤니티 피드, 후기 상세, 마이 메인, 내 직관 리스트, 내 후기, 친구 관리, 설정 화면을 구현했습니다.

상태: Completed / Reviewed

### Phase 6. 모달과 공유 카드

직관 등록, 후기 작성, 공유 카드 모달을 구현했습니다. 실제 API 전환을 고려해 submit handler 경계를 분리했습니다.

상태: Completed / Reviewed

## 2. Phase 6.5 ~ 6.8: Mock 상태와 실사용 UX 보강

### Phase 6.5. 프론트 인터랙션 완성

mock data를 client state 흐름으로 옮기고 직관 등록, 후기 작성, 공유 카드, 일정 전환, 좋아요/저장, 친구 관리, 설정 토글 등이 새로고침 전까지 실제처럼 반영되도록 만들었습니다.

상태: Completed / QA Passed

### Phase 6.8. 추가 수정사항

사용자 피드백을 반영해 홈 다음 직관 카드, KBO 시리즈 표시, 캘린더 직관 상태, 직관 등록 모달, 후기 작성 모달, 커뮤니티 필터와 카드 정렬, 친구 검색, 내 직관/후기 흐름을 다듬었습니다.

상태: Completed / QA Passed

## 3. Phase 7 ~ 8.6: 실제 데이터와 외부 연동

### Phase 7. 서비스 데이터 모델/API 설계

Supabase 기준 데이터 모델, API 계약, action 경계, future DB 전환 흐름을 설계했습니다. 현재 별도 Phase 7 문서는 제거했고 실제 기준은 `supabase/*.sql`과 구현 코드입니다.

상태: Completed / Release Accepted

### Phase 8. 인증/DB/스토리지 연동

Supabase Auth, DB, Storage, server action, admin client 패턴, 후기/직관 저장, 이미지 업로드, 삭제 시 Storage 정리, RLS 우회 패턴을 적용했습니다.

상태: Completed / Release Accepted

### Phase 8.5. 외부 데이터 연동

KBO 공식 API와 네이버 fallback 기반 일정/순위 동기화, Vercel Cron, 시즌 bulk load, Gemini Vision 기반 티켓 OCR, 티켓 인증 정책과 부정 방지 기준을 도입했습니다.

상태: Completed / Operational Monitoring

### Phase 8.6. 후기 댓글 기능

후기 댓글 테이블, 리스트, 작성, 삭제, 공개 범위 연동, owner 권한 처리를 추가했습니다.

상태: Completed

## 4. Phase 8.7 ~ 8.9: 다크 리디자인과 인증 흐름

### Phase 8.7. 다크 컨셉 전면 리디자인

전체 UI를 다크 프리미엄 스포츠 대시보드 스타일로 재구성했습니다. 다음 직관 페이지네이션, 후기 이미지 캐러셀, 무한 스크롤, 후기 수정/삭제, 프로필 사진, 비로그인 redirect 등도 함께 정리했습니다.

상태: Completed

### Phase 8.8. 소셜 로그인과 인증/온보딩 리디자인

Google/Kakao OAuth, 다크 로그인/랜딩/온보딩, 카카오 개인 앱 기준 scope 정리, 계정 선택 강제, 로그인 계정 칩 표시를 구현했습니다.

상태: Completed / Release Accepted

### Phase 8.9. 익명 로그인과 정식 계정 업그레이드

Supabase 익명 로그인, user.id 유지 정식 계정 전환, 익명 사용자 권한 제한, 친구 관리 잠금, 공개 범위 제한, 정식 전환 CTA를 구현했습니다.

상태: Completed / Release Accepted

## 5. Phase 9 ~ 10.5: 출시 준비와 운영 기능

### Phase 9. 반응형/접근성/시각 QA

모바일, 태블릿, 데스크톱 break point와 safe-area 처리를 적용했습니다. MVP 출시 기준의 주요 접근성, 색대비, lint/build, 실기기 QA는 완료 처리했고, 더 높은 수준의 자동화는 운영 백로그로 전환했습니다.

상태: Completed / MVP 기준 검토 완료

### Phase 9.5. 운영 페이지

공지, 이용안내, 문의, 이용약관, 개인정보처리방침을 추가했습니다. 공지는 Supabase `notices` 테이블과 마이 헤더 진입점으로 연결했습니다.

상태: Completed / Release Accepted

### Phase 10. 배포 준비

Vercel 배포, 한국 리전 `icn1`, PWA manifest, Open Graph, sitemap/robots, KBO cron 환경변수 정리, 시즌 일정 백필을 진행했습니다.

상태: Implemented / Vercel Production 배포 완료

### Phase 10.5. 출시 직전 마무리

2026-05-11 ~ 2026-05-12 라운드에서 스플래시, Suspense 스트리밍, 첫 사용자 튜토리얼, PWA 설치 안내, Pull-to-Refresh, visibility refresh, React #310 우회, 공유 카드 Canvas 2D 렌더링, 후기 라이트박스, 디폴트 닉네임 다양화를 완료했습니다.

상태: Completed / 사용자 실측 확인

## 6. Phase 11 이후

### Phase 11. 인수 문서와 마무리

README, 구현 화면 목록, TODO 인덱싱, 알려진 제한사항, clean checkout 검증, 빌드 산출 확인을 정리하는 단계입니다.

상태: Completed / 운영 문서 분리 완료

### Phase 12. MVP 이후 운영 백로그

운영 관측성, 법무/동의 보강, 환경변수/seed 문서화, README 보강, 다음 라운드 후보를 추적합니다.

상태: Operational Backlog

## 7. 출시 후 후보

- Supabase Realtime: 실시간 후기, 좋아요, 댓글, 친구 알림
- Next.js 15 업그레이드 시 React #310 우회 패턴 재검토
- 직관 경험치/레벨 시스템
- 운영자용 간이 어드민 페이지
- 친구 추천 알고리즘
- 푸시 알림
- 유입 분석
