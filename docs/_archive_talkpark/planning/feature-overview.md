# 기능 명세 (Feature Overview)

> 「오늘은 승요」의 현재 기능 범위와 제품 기준을 빠르게 파악하기 위한 문서입니다.
> 시간순 구현 기록은 [phase-history.md](./phase-history.md), 최신 진행 상태와 운영 백로그는 [qa-checklist.md](./qa-checklist.md)를 단일 기준으로 봅니다.

관련 문서:
- Phase별 구현 히스토리: [phase-history.md](./phase-history.md)
- 진행 현황 + 운영 백로그: [qa-checklist.md](./qa-checklist.md)
- 리뷰 로그 + 개발 프로세스: [progress-log.md](./progress-log.md)
- 의사결정 히스토리: [decision-log.md](./decision-log.md)
- 상위 인덱스: [../WORKPLAN.md](../WORKPLAN.md)

## 1. 제품 개요

「오늘은 승요」는 KBO 직관 경험을 기록하고, 내 직관 승률을 확인하며, 후기와 공유 카드로 경험을 나누는 모바일 우선 웹앱입니다.

핵심 경험:
- 직관 등록: 예정 경기와 지난 경기를 모두 등록할 수 있습니다.
- 티켓 인증: 티켓 사진 기반으로 직관을 인증하고 컬렉션에 보관합니다.
- 승률 확인: 내 팀 기준 직관 승률, 최근 직관, 결과 확인 모달을 제공합니다.
- 일정 확인: KBO 시즌 일정과 내 직관 상태를 캘린더에서 확인합니다.
- 후기 작성: 직관 기록에 연결된 후기를 사진과 함께 작성합니다.
- 커뮤니티: 공개 후기, 친구 후기, 좋아요, 저장, 댓글을 봅니다.
- 공유 카드: 직관 결과를 9:16 카드 이미지로 저장하거나 공유합니다.

현재 상태:
- 2026-05-13 기준 MVP 출시 완료 후 사용자 모집/홍보 운영 단계입니다.
- 가입, 익명 체험, 온보딩, 직관, 후기, 공유, 공지, 알림, PWA 설치 안내 흐름이 동작합니다.
- 남은 작업은 출시 차단 이슈가 아니라 운영 관측성, 법무/동의 보강, 운영 문서화, 다음 라운드 후보입니다.

## 2. 사용자 흐름

### 2.1. 첫 진입

- 랜딩에서 앱 소개와 시작 CTA를 제공합니다.
- Google, Kakao, 이메일, 익명 시작 흐름을 지원합니다.
- 익명 시작 시 디바이스 의존성과 정식 계정 전환 안내를 보여줍니다.
- 온보딩에서 닉네임과 내 팀을 설정합니다.
- 첫 홈 진입 시 `AppGuideModal`로 직관 기록, 티켓 인증, 후기, 친구 공유, PWA 설치를 안내합니다.

### 2.2. 홈

- 내 팀과 직관 통계를 중심으로 보여줍니다.
- 다음 직관, 현재 직관, 지난 직관 결과 확인 상태를 구분합니다.
- 경기 종료 후 사용자가 직접 결과를 확인하면 결과 모달과 축하/위로 연출을 표시합니다.
- 홈에서 직관 등록, 후기 작성, 공유 카드 흐름으로 진입할 수 있습니다.

### 2.3. 일정

- 월간 캘린더에서 KBO 일정과 내 직관 상태를 확인합니다.
- 우리 팀 시리즈, 홈/원정, 상대팀, 직관 승/패/무 상태를 표시합니다.
- 선택한 날짜의 경기 목록에서 바로 직관 등록으로 이어질 수 있습니다.
- 시즌 전체 탐색을 위해 2월부터 12월까지 조회 범위를 넓혀 둔 상태입니다.

### 2.4. 직관 등록과 인증

- 티켓 사진을 먼저 올리는 흐름을 우선합니다.
- Vision 분석은 날짜, 홈팀, 원정팀, 구장을 추출해 경기 매칭을 돕습니다.
- 사용자가 확인한 뒤 등록해야 DB와 Storage에 저장됩니다.
- 미인증 직관은 나중에 티켓 사진을 추가해 사후 인증할 수 있습니다.
- 부정 방지는 티켓 이미지 hash 중복 차단과 사용자+경기 unique constraint를 기준으로 합니다.

### 2.5. 후기와 커뮤니티

- 후기는 종료된 내 직관 기록에 연결해서 작성합니다.
- 사진은 최대 3장까지 첨부합니다.
- 공개 범위는 공개, 친구 공개, 비공개를 지원합니다.
- 커뮤니티는 최신/인기/친구 필터와 좋아요, 저장, 댓글, 공유를 제공합니다.
- 후기 상세는 이미지 캐러셀과 확대 보기를 지원합니다.

### 2.6. 마이와 설정

- 프로필, 내 팀, 관심팀, 로그인 계정 칩, 직관 통계, 메뉴를 제공합니다.
- 내 직관, 내 후기, 저장한 후기, 친구 관리, 공지, 이용안내, 문의, 약관, 개인정보처리방침으로 이동할 수 있습니다.
- 익명 사용자는 친구 관리와 일부 공개 범위 기능이 제한됩니다.
- 설정에서 공개 범위와 알림 관련 상태를 관리합니다.

## 3. 화면 목록

주요 라우트:
- `/landing`: 랜딩
- `/login`: 로그인과 정식 계정 전환
- `/onboarding`: 닉네임/내 팀 설정
- `/`: 홈
- `/schedule`: 일정
- `/community`: 커뮤니티 피드
- `/my`: 마이
- `/my/attendances`: 내 직관
- `/my/reviews`: 내 후기
- `/my/saved`: 저장한 후기
- `/my/friends`: 친구 관리
- `/my/notices`: 공지 목록
- `/my/notices/[id]`: 공지 상세
- `/my/help`: 이용안내
- `/my/contact`: 문의
- `/my/terms`: 이용약관
- `/my/privacy`: 개인정보처리방침
- `/reviews/[id]`: 후기 상세

보류 또는 특이사항:
- `/games/[id]` 경기 상세는 MVP에서 직접 진입을 보류하고 일정 중심 흐름으로 대체했습니다.
- 어드민 전용 공지 작성 화면은 없고, MVP에서는 Supabase Studio 직접 입력을 기준으로 합니다.

## 4. 디자인 기준

- 모바일 우선 폭은 360~414px입니다.
- 데스크톱에서는 모바일 프레임 또는 확장 레이아웃을 사용합니다.
- 현재 UI는 다크 프리미엄 스포츠 대시보드 톤을 기준으로 합니다.
- 주요 강조색은 브랜드 오렌지 `#FF6B35` 계열입니다.
- 숫자 통계와 승률은 가장 먼저 보이도록 크게 배치합니다.
- KBO 구단 로고와 상표 이미지는 사용하지 않습니다.
- 팀 표현은 팀명, 팀 컬러, 이니셜, 추상 배지로 대체합니다.
- UI 텍스트와 컴포넌트는 이미지가 아니라 HTML/CSS로 구현합니다.
- 생성 이미지는 마스코트, 배경, 후기 이미지, 공유 카드 배경 등 보조 어셋에만 사용합니다.

## 5. 어셋 기준

주요 어셋:
- `public/assets/mascot-default.png`
- `public/assets/mascot-cheer.png`
- `public/assets/mascot-bat.png`
- `public/assets/stadium-hero-vertical.png`
- `public/assets/stadium-review-day.png`
- `public/assets/stadium-review-sunset.png`
- `public/assets/stadium-review-night.png`
- `public/assets/share-bg-navy-red.png`
- `public/assets/share-bg-field.png`
- `public/assets/share-bg-white.png`

주의:
- 마스코트 일부 이미지는 투명 배경처럼 보이지만 실제 alpha가 없을 수 있습니다.
- 추가 어셋을 만들 때는 저작권/상표 이슈가 없는 생성 이미지 또는 자체 제작 이미지를 사용합니다.

## 6. 기술 스택

- Next.js App Router
- TypeScript
- Tailwind CSS와 커스텀 CSS 토큰
- lucide-react 아이콘
- Supabase Auth/DB/Storage
- Supabase SSR client + service-role admin action 패턴
- Google Gemini Vision 기반 티켓 OCR/경기 매칭
- KBO 공식 API + 네이버 스포츠 fallback 기반 일정/순위 동기화
- Vercel 배포, `icn1` 리전, Vercel Cron
- PWA manifest, iOS/Android 설치 안내
- Canvas 2D 기반 공유 카드 이미지 생성

## 7. 데이터와 정책

핵심 데이터:
- profiles: 사용자 프로필, 팀, 닉네임, 프로필 이미지
- games: KBO 경기 일정, 스코어, 상태
- attendances: 직관 기록, 응원팀, 인증 상태, 결과 확인 시점
- reviews: 후기 본문, 공개 범위, 연결된 직관
- review_likes / review_saves / review_comments: 후기 반응
- friends / friend_requests: 친구 관계와 요청
- notifications / notices: 알림과 공지

주요 정책:
- 사용자 데이터 read/write는 인증 확인 후 admin client로 수행하는 패턴을 사용합니다.
- 익명 사용자는 본인 데이터 작성은 허용하되 친구 관리와 일부 공개 범위 기능을 제한합니다.
- 카카오 OAuth는 이메일 동의항목 없이 닉네임/프로필 중심으로 운영합니다.
- 결과 모달은 `result_acknowledged_at` 기준으로 한 번 확인한 결과를 다시 자동 노출하지 않습니다.
- 공유 카드는 html2canvas 의존 없이 Canvas 2D로 직접 렌더링합니다.

## 8. 운영 기준

- 최신 진행 상태와 운영 백로그는 [qa-checklist.md](./qa-checklist.md)를 기준으로 합니다.
- 과거 Phase의 상세 구현 순서는 [phase-history.md](./phase-history.md)에 보존합니다.
- 의사결정 배경과 트레이드오프는 [decision-log.md](./decision-log.md)에 기록합니다.
- 리뷰어 검수 결과는 [progress-log.md](./progress-log.md)에 누적합니다.
- 새 문서나 기획 작업을 추가할 때는 파일당 500줄 이하를 유지합니다.
