# 경기톡 개발 계획

> 경기톡(Match Talk) 기획을 실제 제품에 단계적으로 적용하기 위한 개발 계획입니다.
> 각 단계는 작업 후 바로 확인하거나 테스트할 수 있는 단위로 나눕니다.
> 진행 상황은 본 문서 §6에서 단계별로 갱신합니다.

관련 문서:
- 기획: [../planning/match-talk.md](../planning/match-talk.md)
- 작업 인덱스: [../WORKPLAN.md](../WORKPLAN.md)
- 후기 기능 명세: [../planning/feature-overview.md](../planning/feature-overview.md)

작업 브랜치: `feature/match-talk` → **master 머지 완료 (2026-05-13, merge commit `b877d2a`)**. 브랜치는 작업 내역 보존을 위해 유지.

## 1. 개발 원칙

- 댓글 UI는 후기에서 먼저 범용 컴포넌트로 분리한 뒤 경기톡에서 재사용한다.
- 라이브 스코어는 cron 폴링 대신 글쓰기 진입 시점의 lazy refresh로만 가져온다.
- DB 스키마는 후기와 별개 테이블로 두되, 좋아요/댓글 패턴은 후기와 동일하게 맞춘다.
- 작성 가능 범위는 "이번 주 월~일" 7일로 제한하고, 지난 주 글은 읽기 전용으로만 노출한다.
- 모든 글은 1개의 KBO 경기에 묶이며 작성 시점 스코어를 박제한다.
- 인증/사진/직관 종속 없음 — 누구나 로그인만 하면 작성 가능.

## 2. 최종 정책 요약

| 항목 | 정책 |
|---|---|
| 작성 자격 | 로그인 사용자 (익명 가입 포함) |
| 작성 가능 기간 | 이번 주 월~일 7일 (월요일 00시 KST 새 주차 시작) |
| 한 경기당 글 수 | 무제한 |
| 본문 | 최대 300자 |
| 사진 | 0~1장 (선택) |
| 감정 태그 | 1개 필수 (환호/응원/분노/불안) |
| 점수 박제 | 진입 시점 라이브 스코어 + 상태 박제 (이닝은 미박제) |
| 라이브 스코어 TTL | 2분 (글쓰기 진입 시 lazy refresh) |
| 사진 Storage 버킷 | 후기와 같은 버킷 재사용 (폴더로 구분) |
| 비로그인 목록 조회 | 허용 (작성·좋아요·댓글만 로그인 필요) |
| 응원팀 뱃지 | 프로필 main_team_id 자동 표시 |
| 직관 인증 뱃지 | 같은 (user_id, game_id) attendance 존재 시 표시 |
| 글 삭제 | 본인만 |
| 글 수정 | MVP 미포함 (Phase 2) |
| 신고/숨김 | MVP 미포함 (어드민 강제 삭제로 대응) |

## 3. 단계별 개발 계획

### Step 0. 댓글 컴포넌트 범용화 (사전 리팩토링)

목표:
- 후기 댓글 UI를 `<CommentThread />` 같은 범용 컴포넌트로 분리해 경기톡과 공용으로 쓴다.

작업:
- 기존 후기 댓글 컴포넌트 위치 파악
- `target_type` / `target_id` props 인터페이스 정의
- 댓글 목록 조회·작성·삭제 서버 액션을 target별로 주입할 수 있게 분리
- 후기 화면을 범용 컴포넌트 기반으로 교체

테스트 기준:
- 후기 댓글 작성/조회/삭제가 기존과 동일하게 동작
- 후기 상세 화면 시각적 회귀 없음
- 컴포넌트가 경기톡 target에도 그대로 붙을 수 있는 구조

완료 조건:
- 후기 화면이 새 범용 컴포넌트 기반으로 회귀 없이 동작
- 경기톡 target만 추가하면 재사용 가능한 상태

### Step 1. DB 스키마 설계

목표:
- 경기톡 글/좋아요/댓글 테이블과 라이브 스코어 캐시 컬럼을 설계한다.

작업:
- `match_posts` 테이블 설계
- `match_post_likes` 테이블 설계 (후기 좋아요와 동일 패턴)
- `match_post_comments` 테이블 설계 (후기 댓글과 동일 패턴)
- `games.last_live_synced_at timestamptz NULL` 컬럼 추가 설계
- RLS 정책 설계 (작성/조회/수정/삭제)
- 인덱스 설계: `(game_id, created_at desc)`, `(user_id, created_at desc)`

권장 `match_posts`:

```text
id              uuid PK
user_id         uuid FK → auth.users
game_id         uuid FK → games
body            text (max 300)
photo_url       text NULL
emotion_tag     enum('cheer','support','anger','anxiety')
score_home_at_post   int NULL
score_away_at_post   int NULL
status_at_post       enum('scheduled','in_progress','finished')
created_at      timestamptz
updated_at      timestamptz
deleted_at      timestamptz NULL
```

완료 조건:
- SQL 적용 전 검토 가능한 마이그레이션 초안 완성
- 후기 RLS 정책과 일관된 형태인지 확인

### Step 2. DB 마이그레이션 적용

목표:
- 실제 Supabase에 경기톡 스키마를 적용한다.

작업:
- `supabase/*.sql`에 마이그레이션 파일 추가
- `match_posts`, `match_post_likes`, `match_post_comments` 생성
- `games.last_live_synced_at` 컬럼 추가
- 인덱스/제약/RLS 적용
- Supabase Storage에 경기톡 사진 버킷 정책 확인 (후기 사진과 동일 버킷 재사용 여부 결정)

테스트 기준:
- 마이그레이션 후 후기/직관/일정 등 기존 기능 정상 동작
- 로그인 사용자가 글을 insert/select할 수 있고 비로그인은 select만 가능 (또는 정책대로)
- 본인 글만 update/delete 가능

완료 조건:
- 로컬 또는 Supabase SQL Editor에서 마이그레이션 성공
- 기존 화면 회귀 없음

### Step 3. 라이브 스코어 lazy refresh

목표:
- 글쓰기 진입 시점에 캐시 TTL을 확인하고 필요 시 KBO API를 호출해 갱신한다.

작업:
- `refreshGameLiveScore(gameId)` 서버 액션 작성
- `games.last_live_synced_at`이 `now() - TTL` 보다 오래되면 KBO API 호출 후 `games` 업데이트
- TTL 상수는 `lib/server/kbo/`에 분리 (권장 2~3분)
- 호출 실패 시 DB 캐시값 그대로 반환, 캐시도 없으면 NULL 반환
- 기존 cron route는 일정/결과 sync 용도로 유지 (점수 cron만 폐기)

예상 파일:
- `lib/server/kbo/liveScore.ts`
- `lib/actions/matchTalk.ts` (서버 액션 진입점)

테스트 기준:
- TTL 내 재요청 시 API 호출 없음
- TTL 만료 후 요청 시 API 호출 + 캐시 갱신
- API 실패 시에도 함수가 throw하지 않음 (stale 반환)
- 비활성 경기(과거/취소)도 안전하게 동작

완료 조건:
- 서버 액션 단위로 호출 시 정상 동작
- 글쓰기 진입에서 이 함수만 호출하면 점수 박제 준비 완료

### Step 4. 경기톡 서버 액션 (CRUD)

목표:
- 글 작성/조회/삭제 + 좋아요/댓글 서버 액션을 구현한다.

작업:
- `createMatchPostAction(input)`
  - 인증 확인
  - game_id가 이번 주 월~일 범위인지 검증
  - `refreshGameLiveScore(game_id)` 호출 → 박제값 확정
  - body 300자, 감정 태그 enum 검증
  - 사진 1장 업로드 처리 (Storage)
  - row insert
- `listMatchPostsAction({ date?, gameId?, teamId?, emotionTag?, cursor? })`
  - 필터/페이지네이션
  - 작성자 프로필·응원팀·직관 인증 여부 조인
  - 좋아요 수·댓글 수 카운트
- `deleteMatchPostAction(postId)`
  - 본인 확인 후 soft delete (`deleted_at`)
- `toggleMatchPostLikeAction(postId)`
- `listMatchPostCommentsAction(postId)`
- `createMatchPostCommentAction(postId, body)`
- `deleteMatchPostCommentAction(commentId)`

예상 파일:
- `lib/actions/matchTalk.ts`
- `lib/supabase/query-parts/matchPosts.ts`

테스트 기준:
- 비로그인 작성 차단
- 지난 주/다음 주 경기 작성 차단
- 작성 시 박제값이 작성 시점의 라이브 스코어와 일치
- 본인 글만 삭제 가능
- 좋아요 토글, 댓글 작성/삭제 정상 동작
- 직관 인증 뱃지 플래그가 attendance 존재 여부에 따라 정확히 결정됨

완료 조건:
- 클라이언트 UI 없이도 서버 액션만으로 CRUD 시연 가능

### Step 5. 커뮤니티 탭 구조 변경과 경기톡 목록 화면

목표:
- 커뮤니티 탭에 [후기]/[경기톡] 서브탭을 두고 경기톡 목록을 본다.

작업:
- 커뮤니티 탭 라우트/컴포넌트에 서브탭 추가
- 경기톡 목록 UI: 글 카드 리스트
- 필터 UI: 날짜 (이번 주 7일), 경기 (선택 날짜의 경기 목록), (옵션) 응원팀, (옵션) 감정 태그
- 선택된 경기가 있으면 상단 컨텍스트 헤더 (스코어/상태/구장) 노출
- 무한 스크롤 또는 더 보기 페이지네이션

테스트 기준:
- 후기 탭은 기존 동작 그대로 유지
- 서브탭 전환 시 URL이 갱신 (예: `/community?tab=match-talk`)
- 필터 변경 시 목록이 정상 갱신
- 빈 상태 메시지 표시

완료 조건:
- 디자인 승인된 목록 UI에서 더미/실데이터로 글이 보임

### Step 6. 글 작성 모달

목표:
- 기획서 §3.2 흐름대로 글을 작성한다.

작업:
- 작성 모달 컴포넌트 추가
- 단계: 날짜 선택 → 경기 선택 → 본문 → 감정 태그 → 사진(선택) → 등록
- 날짜 picker는 이번 주 7일만, 경기 없는 날은 비활성
- 본문 글자 수 카운터 (300자)
- 감정 태그 4개 칩 UI (단일 선택, 필수)
- 사진 1장 첨부 (압축 후 업로드는 기존 후기 사진 흐름 재사용)
- 등록 직전 라이브 스코어 1회 더 확인하지 않고 진입 시점 값 사용
- 등록 후 목록 갱신 + 토스트

테스트 기준:
- 본문 비어있으면 등록 비활성
- 감정 태그 미선택 시 등록 비활성
- 글자 수 초과 시 등록 차단
- 사진 미첨부 시에도 등록 가능
- 등록 후 모달 닫히고 목록 최상단에 새 글 표시
- 등록 실패 시 사용자가 입력한 본문/사진이 유지됨

완료 조건:
- 사용자가 처음부터 끝까지 글을 등록할 수 있음
- 박제값이 §9.5 정책대로 진입 시점 값으로 저장됨

### Step 7. 글 카드 표시와 상세

목표:
- 기획서 §4.1의 카드 구성과 §9.9의 표시 분기를 구현한다.

작업:
- 글 카드: 닉네임, 응원팀 뱃지, 직관 인증 뱃지(조건부), 작성 시각
- 박제 헤더: status_at_post에 따라 "경기 전" / "LG 3 : 2 두산 · 진행 중" / "최종 LG 5 : 3 두산"
- 본문 + (선택) 사진 + 감정 태그
- 좋아요 / 댓글 수 표시 + 액션
- 글 클릭 시 댓글 스레드 (Step 0의 범용 컴포넌트 재사용)
- 본인 글이면 삭제 메뉴 노출

테스트 기준:
- 응원팀 뱃지가 양 팀 팬 모두에서 정확히 표시
- 직관 인증 뱃지가 attendance 존재 시에만 표시 (사후 추가/삭제 반영)
- scheduled 상태일 때 스코어 숨김
- canceled 상태도 자연스럽게 표시
- 본인 글 외에는 삭제 메뉴 비노출

완료 조건:
- 글 단위 모든 UI 요소가 디자인대로 표시되고 인터랙션 정상

### Step 8. 진입 동선 (홈/일정 → 경기톡)

목표:
- 홈과 일정 상세에서 경기톡으로 자연스럽게 진입한다.

작업:
- 홈 이번 주 일정 카드에 글 개수 뱃지 (`💬 N`)
- 글 개수는 서버에서 weekGames와 함께 한 번에 조회 (N+1 방지)
- 일정 상세 화면에 "경기톡 보기" 버튼 → 해당 경기 필터된 목록으로 이동
- 진입 시 URL 쿼리로 필터 상태 전달

테스트 기준:
- 글이 없는 경기 카드는 뱃지 숨김 또는 0 표시
- 일정 상세에서 "경기톡 보기" 클릭 시 정확히 해당 경기 글만 보임
- 모바일 카드 레이아웃이 뱃지 추가로 깨지지 않음

완료 조건:
- 홈/일정에서 경기톡으로 가는 두 동선이 모두 동작
- 기획서 §5.4 권장안 (a) (일정 상세 경유)을 기본으로 구현

### Step 9. 회귀 테스트와 운영 준비

목표:
- 경기톡 작업이 후기/일정/홈/직관 등 기존 기능을 깨지 않았는지 확인하고 운영 반영 준비.

수동 테스트:
- 후기 작성/조회/삭제 (Step 0의 댓글 범용화 회귀 확인 포함)
- 직관 등록과 결과 확인
- 일정 페이지 정상 동작
- 홈 카드 표시
- 경기톡 글 작성/조회/삭제 풀 흐름
- 좋아요/댓글 풀 흐름
- 모바일(375/414/iOS Safari) 레이아웃 확인
- 다크 모드 색대비 확인

자동/명령 테스트:
- `npm run lint`
- `npm run build`
- 타입체크

배포 절차:
- `feature/match-talk` → master PR/머지
- Vercel 자동 배포 확인
- 운영 환경에서 글 작성 1건 스모크 테스트
- KBO API lazy refresh가 운영에서 정상 호출되는지 로그 확인

완료 조건:
- 로컬 회귀 통과
- master 머지 후 운영 스모크 테스트 통과

## 4. 권장 진행 순서

```text
Step 0 댓글 컴포넌트 범용화 (사전 리팩토링)
→ Step 1 DB 스키마 설계
→ Step 2 DB 마이그레이션 적용
→ Step 3 라이브 스코어 lazy refresh
→ Step 4 서버 액션 CRUD
→ Step 5 커뮤니티 탭 + 목록 화면
→ Step 6 작성 모달
→ Step 7 글 카드 + 상세
→ Step 8 진입 동선
→ Step 9 회귀 테스트와 배포
```

UI보다 DB와 서버 액션을 먼저 안정화한 뒤 화면을 붙이는 흐름입니다. Step 5~7은 디자인 확인 후 순서를 살짝 섞어도 무방하나, Step 4까지는 순서 고정 권장.

## 5. 남은 결정 사항

- 감정 태그 4개로 시작하되 추후 추가 시점 기준
- 글 개수 뱃지를 홈 카드에 노출할 때 0건도 표시할지, 1건 이상만 표시할지
- Phase 2 이후 신고 버튼 도입 시점

### 결정 완료 (2026-05-13)

- 라이브 스코어 TTL: **2분**
- 사진 Storage 버킷: **후기와 같은 버킷 재사용** (폴더 분리)
- 비로그인 목록 조회: **허용** (작성·좋아요·댓글은 로그인 필요)

### 후속 기획 반영 필요 (2026-05-14)

- 날짜/경기 필터가 적용된 상태에서 `타임라인 보기` 모드를 추가한다.
- 기본 경기톡 피드는 기존 카드형을 유지한다.
- 필터 상태 헤더에 `필터 해제`와 `타임라인 보기` 버튼을 함께 노출한다.
- 타임라인 모드에서는 `카드로 보기` 버튼으로 되돌아갈 수 있게 한다.
- 날짜 필터는 경기별 섹션 → 경기 상태별 섹션 → 글 목록 구조로 보여준다.
- 특정 경기 필터는 경기 헤더 → 경기 상태별 섹션 → 글 목록 구조로 보여준다.
- 타임라인에서는 사진을 숨기고 `사진 있음` 또는 `📷` 표시만 제공한다.
- 좋아요, 댓글, 삭제는 기존처럼 개별 글 단위로 유지한다.
- 상세 기획은 [../planning/match-talk.md § 11](../planning/match-talk.md)를 기준으로 한다.

## 6. 진행 상황

> 각 단계 완료 시 상태와 PR/커밋 링크, 메모를 함께 갱신합니다.
> 상태: ⬜ 대기 / 🟡 진행 중 / ✅ 완료 / ⏸️ 보류

| Step | 제목 | 상태 | 메모 |
|---|---|---|---|
| 0 | 댓글 컴포넌트 범용화 | ✅ | `components/common/CommentThread.tsx` 신설 + 후기 화면 교체. typecheck/lint/build 통과 |
| 1 | DB 스키마 설계 | ✅ | `supabase/add-match-talk.sql` 작성. enum 2종 + 테이블 3종 + games.last_live_synced_at + RLS. Storage는 review-photos 폴더 분리 |
| 2 | DB 마이그레이션 적용 | ✅ | 운영 Supabase에 `add-match-talk.sql` 실행 완료. 테이블 3종 + games 컬럼 확인 |
| 3 | 라이브 스코어 lazy refresh | ✅ | `lib/server/kbo/liveScore.ts` 신설. TTL 2분, 같은 날짜 일괄 갱신, 실패 시 stale 반환 |
| 4 | 서버 액션 CRUD | ✅ | `lib/actions/matchTalk.ts` + `lib/supabase/query-parts/matchPosts.ts` + 도메인 타입 추가 |
| 5 | 커뮤니티 탭 + 목록 화면 | ✅ | `CommunityScreen`에 후기/경기톡 서브탭 + `MatchTalkFeed` + `MatchPostCard` + dark-match-talk.css |
| 6 | 작성 모달 | ✅ | `MatchTalkComposerModal` 신설. 7일 chip + 경기 리스트 + 300자 본문 + 감정 4태그 + 사진 1장 |
| 7 | 글 카드 + 상세 | ✅ | `/match-talk/[id]` 상세 페이지 + `MatchPostDetailScreen` + 댓글은 Step 0 CommentThread 재사용 |
| 8 | 진입 동선 | ✅ | 홈 카드 뱃지(글 0건은 숨김) + 일정 행에 "💬 경기톡" 링크 |
| 9 | 회귀 테스트와 배포 | ✅ | 사용자 수동 회귀 완료, master 머지 진행 |

### 작업 로그

- 2026-05-13 — **master 머지 + 운영 배포 완료.** `feature/match-talk` 12개 커밋을
  `--no-ff` 머지로 master에 통합(merge commit `b877d2a`) → `origin/master` 푸시 →
  Vercel 자동 빌드/배포 트리거. 30개 파일 변경(+3884/-143), 신규 파일 13개.
  - 신규: CommentThread, MatchPostCard, MatchTalkFeed, MatchPostDetailScreen,
    MatchTalkComposerModal, matchTalk.ts, liveScore.ts, matchPosts.ts,
    matchTalkWeek.ts, dark-match-talk.css, add-match-talk.sql,
    /match-talk/[id]/page.tsx, 본 개발 계획서.
  - 변경: AppShell(hideHeader prop), HomeScreen(우리팀 일정 월요일 자동 숨김 +
    말풍선 인디케이터), ScheduleScreen/CommunityScreen/MyScreen(상단 헤더 숨김),
    각 loading.tsx, 모달 base CSS 등.
  - 브랜치는 작업 내역으로 남겨둠(삭제하지 않음).
- 2026-05-13 — 개발 계획서 작성. `feature/match-talk` 브랜치 생성.
- 2026-05-13 — 후기 댓글 구조 조사 완료. UI는 `ReviewDetailScreen.tsx` 364-430 라인에 인라인,
  서버 액션은 `lib/actions/comment.ts`, 쿼리는 `lib/supabase/query-parts/reviews.ts:376`,
  DB는 `supabase/add-comments.sql`. Step 0 결정 사항: (1) 경기톡 댓글 삭제 권한은
  본인 댓글 + 글 작성자로 후기와 동일. (2) 공용 CSS는 분리하지 않고 dark-review-detail.css
  그대로 두고 경기톡도 같은 .phone-frame-dark 컨텍스트에서 재사용.
- 2026-05-13 — Step 0 완료. `components/common/CommentThread.tsx` 신설하고
  ReviewDetailScreen의 인라인 댓글 UI를 교체. 낙관 업데이트는 부모(후기 화면)가 갖고,
  컴포넌트는 입력/제출/삭제 UI만 책임지는 구조. `canDeleteAsOwner` prop으로
  글 작성자 삭제 권한을 외부에서 주입. typecheck/lint/build 모두 통과.
  경기톡은 추후 같은 컴포넌트에 다른 onSubmit/onDelete만 주입해 재사용.
- 2026-05-13 — UX 다듬기 일괄 정리. 작성 모달 다크 테마 + 7일 칩 한 줄 + 경기 칩 가로 5개,
  우리팀 경기 자동 선택; 글 카드 헤더에 응원팀 배지 + 직관 인증, 본인 글에 더보기 메뉴;
  댓글은 카드 안에서 펼침/접힘(CommentThread 재사용); 상세 페이지는 차단(redirect);
  필터 해제 시 서버에서 다시 fetch, 새 글/삭제 시 부분 갱신; 일정·커뮤니티·마이 상단
  타이틀 숨김(loading.tsx 포함); 우리팀 일정에 월요일 자동 숨김 + 말풍선 인디케이터
  (좌우 흔들기 애니메이션) + week-list isolation으로 stacking context 격리;
  토스트 위치를 모달 열렸을 때 위로 올림; modal-body base에 flex/overflow 보장 추가.
- 2026-05-13 — Step 9 자동 검증 완료. `npm run lint` / `npx tsc --noEmit` /
  `npx next build` 모두 통과. /match-talk/[id] 라우트, /community 페이지의
  서브탭 분기까지 빌드 그래프에 정상 포함. 새로 추가된 lint warning 없음.
- 2026-05-13 — Step 8 완료. 홈 → 경기톡 / 일정 → 경기톡 두 진입 동선 연결.
  - 홈: `app/page.tsx`에서 `countMatchPostsByGameIds(weekGames.map(g=>g.id))` 한 번 호출로
    이번 주 카드용 카운트를 모아 HomeScreen prop으로 전달(N+1 회피). 카드 안 우리팀
    경기에 글 개수 ≥ 1인 경우만 `💬 N` 뱃지를 Link로 표시 — `?tab=match-talk&gameId=X`로
    필터된 경기톡 목록으로 진입.
  - 일정: `ScheduleScreen` 경기 행의 status 칸을 `sched-game-meta` 컨테이너로 묶고
    그 안에 `💬 경기톡` 링크 추가. 취소된 경기는 링크 숨김.
  - 스타일은 dark-match-talk.css에 sched-game-meta, sched-game-talk-link,
    hd-week-talk-badge 추가. typecheck/build 통과.
- 2026-05-13 — Step 7 완료. 글 상세 페이지 `/match-talk/[id]` 추가.
  - `app/match-talk/[id]/page.tsx`: SSR로 post + comments + 인증 정보 조회.
  - `components/domain/MatchPostDetailScreen.tsx`: MatchPostCard 재사용 + CommentThread
    재사용. 좋아요 낙관 업데이트와 롤백, 댓글 작성/삭제는 후기 상세와 동일 패턴.
  - `MatchPostCard`에 Link 추가 — 본문/사진/감정 태그 영역만 상세로 이동하도록 묶고,
    좋아요·삭제 메뉴·게임 컨텍스트 버튼은 카드 안에서 작동. 상세 화면에서는
    `onClickGameFilter`가 없으면 게임 컨텍스트가 정적 표시되도록 분기.
  - dark-match-talk.css에 match-post-link, match-post-game-context-static 추가.
  - typecheck/build 통과. /match-talk/[id] 라우트 생성 확인.
- 2026-05-13 — Step 6 완료. `MatchTalkComposerModal` 신설.
  - 흐름: 이번 주 7일 chip(경기 없는 날 비활성) → 그 날짜의 경기 1개 선택 →
    300자 본문(카운터 포함) → 감정 태그 4개 중 1개 필수 → 사진 1장(선택) → 올리기.
  - 서버 액션 `listWriteableGamesAction()` 추가 — 이번 주 + 취소 제외 경기 목록.
  - 사진 업로드는 기존 review-photos 버킷 + `match-talk/` 폴더 사용
    (`uploadUserFile("review-photos", file, "match-talk")`).
  - 등록 성공 시 토스트 + `router.refresh()`로 목록 즉시 갱신.
  - 박제값은 createMatchPostAction 내부에서 lazy refresh로 처리(Step 3 헬퍼 재사용).
  - dark-match-talk.css에 composer-* 스타일 일괄 추가. typecheck/build 통과.
- 2026-05-13 — Step 5 완료. 커뮤니티 페이지에 [후기]/[경기톡] 서브탭 도입.
  - `app/community/page.tsx`: `searchParams.tab/gameId`로 초기 탭/필터 결정,
    경기톡 초기 글 20개와 currentUserId를 함께 SSR.
  - `components/domain/CommunityScreen.tsx`: 상단 community-tabs UI 추가.
    탭 전환 시 `router.replace`로 URL 갱신 (`?tab=match-talk`). 기존 후기 영역은
    그대로 두고 fragment로 감싸 회귀 위험 최소화.
  - `components/domain/MatchTalkFeed.tsx` 신설: 무한 스크롤(IntersectionObserver),
    경기 필터, 컨텍스트 헤더, 좋아요 낙관 업데이트.
  - `components/domain/MatchPostCard.tsx` 신설: 작성자·응원팀·직관 인증 뱃지,
    박제 스코어/상태 표시, 본문, 사진, 감정 태그, 좋아요/댓글 카운트.
    본인 글은 더보기 메뉴에서 삭제 가능.
  - `lib/utils/matchTalkWeek.ts` 분리: `"use server"` 파일에 동기 export가 불가능해
    `getThisWeekRangeKst()` 유틸을 별도 파일로 이동.
  - `styles/dark-match-talk.css` 신설 + `app/layout.tsx`에 import.
  - 글쓰기 버튼은 Step 6까지 토스트("곧 열릴 예정")로 안내. typecheck/lint/build 통과.
- 2026-05-13 — Step 4 완료. 도메인 타입 + 쿼리 + 서버 액션 일괄 추가.
  - `lib/types/domain.ts`에 `MatchPost`, `MatchPostComment`, `MatchPostEmotionTag`,
    `MatchPostStatusSnapshot` 추가.
  - `lib/supabase/query-parts/matchPosts.ts`: `listMatchPostsFromDb` (필터·페이지네이션·
    조인·집계), `getMatchPostByIdFromDb`, `listMatchPostCommentsFromDb`,
    `countMatchPostsByGameIds` (홈 뱃지용).
  - `lib/actions/matchTalk.ts`: 7개 액션 + `getThisWeekRangeKst()` 유틸.
    글 작성 시 (1) 이번 주 월~일 범위 검증, (2) 취소 경기 차단, (3) lazy refresh →
    `toMatchPostSnapshotColumns()`로 박제. 삭제는 soft delete(deleted_at).
    댓글은 후기와 동일한 본인+글 작성자 정책.
  - typecheck/lint/build 모두 통과. 클라이언트 UI 없이 액션만으로 CRUD 가능 상태.
- 2026-05-13 — Step 3 완료. `lib/server/kbo/liveScore.ts` 신설.
  `refreshGameLiveScore(gameId)`: games row 조회 → TTL(2분) 확인 →
  만료 시 `syncGamesForDate(game.game_date)` 호출 → 같은 날짜의 모든 게임에
  동일 `last_live_synced_at`을 박아 캐시 일관성 유지 → refetch 후 반환.
  실패 시 throw 없이 stale 캐시 반환. 캐시도 없으면 `null` 반환.
  `toMatchPostSnapshotColumns()`: 스냅샷을 match_posts 박제 컬럼으로 변환하는 헬퍼.
  scheduled 상태에서는 스코어를 NULL로 강제하고, canceled가 어쩌다 들어와도
  finished로 안전 매핑. typecheck/lint 통과.
- 2026-05-13 — Step 2 완료. 운영 Supabase SQL Editor에서 `add-match-talk.sql` 전체 실행.
  match_posts/match_post_likes/match_post_comments 테이블, games.last_live_synced_at
  컬럼 생성 확인. 기존 기능 회귀 없음.
- 2026-05-13 — Step 1 완료. `supabase/add-match-talk.sql` 작성.
  결정 사항 반영: TTL 2분(코드에 적용 예정), 사진 버킷은 `review-photos` 재사용
  (폴더 `{user_id}/match-talk/`로 분리), 비로그인 조회 허용.
  설계 포인트: (1) `status_at_post` enum에 'canceled'는 미포함 — 기획서 §3.1에서
  취소 경기는 작성 선택지에서 제외하기 때문. 작성 후 취소된 경기는 표시 단계에서
  현재 `games.status='canceled'`를 별도 조회해 배지로 노출 예정 (Step 7).
  (2) soft delete를 위해 `deleted_at` + RLS는 update 권한 본인만 + 조회 시 IS NULL.
  (3) 인덱스는 deleted_at IS NULL 부분 인덱스로 활성 글만 다룸.
