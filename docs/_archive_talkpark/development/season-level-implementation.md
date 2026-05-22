# 시즌 레벨 개발 계획

> 시즌 레벨 기획을 실제 제품에 단계적으로 적용하기 위한 개발 계획입니다.
> 각 단계는 작업 후 바로 확인하거나 테스트할 수 있는 단위로 나눕니다.

관련 문서:
- 기획: [../planning/season-level.md](../planning/season-level.md)
- 백필 정책: [../planning/season-level-backfill.md](../planning/season-level-backfill.md)
- 작업 인덱스: [../WORKPLAN.md](../WORKPLAN.md)

## 1. 개발 원칙

- 먼저 디자인과 사용자 흐름을 확인하고, 이후 실데이터와 DB 변경을 연결한다.
- XP는 단순 합계 컬럼이 아니라 이벤트 로그 기반으로 관리한다.
- 지급/회수 로직은 반드시 멱등하게 만든다.
- 1일 1직관 정책은 화면과 DB 양쪽에서 막는다.
- MVP에서는 레벨 경쟁보다 마이페이지 성장감을 우선한다. 타인 레벨은 노출하지 않고 프로필 모달에서만 확인한다.
- 시즌 레벨 본 기능 개발 전에 **Step 0 프로필 모달 + 자기소개**를 먼저 도입한다. 모달에 레벨이 들어갈 자리만 깔아둔 뒤, 본 기능이 완성되면 실데이터를 연결한다.

## 2. 최종 정책 요약

| 항목 | 정책 |
|---|---|
| 시즌 기준 | `games.game_date`의 연도 |
| 직관 제한 | 사용자 1명당 경기일 기준 1일 1직관 |
| 직관 XP | 경기 종료 후 결과 확인 시 `+30` |
| 티켓 XP | 티켓 인증 성공 시 `+100` |
| 후기 XP | 후기 저장 성공 시 `+70` |
| 사진 보너스 | 사용자 업로드 사진이 처음 포함된 시점에 `+20` |
| 사진 삭제 | 후기 수정으로 사진을 지워도 XP 회수 없음 |
| 후기 삭제 | 후기 XP와 사진 보너스 XP 회수 |
| 직관 삭제 | 해당 직관에서 발생한 모든 XP 회수 |
| 레벨 상시 노출 위치 | 마이페이지, 홈 내 카드만 |
| 타인 레벨 노출 | 프로필 모달에서만 (닉네임/사진 탭으로 진입) |
| 자기소개(bio) | `profiles.bio`, 150자, 한 줄, 이모지 허용, NULL 허용 |
| 프로필 모달 | 후기 상세/후기 카드/댓글/경기톡 글·댓글의 작성자 영역에서 진입 |
| 모달 친구 액션 | 기존 `friends.ts` 액션 재사용 (sendFriendRequest/respondFriendRequest/deleteFriend) |

## 3. 단계별 개발 계획

### Step 0. 프로필 모달 + 자기소개 (선행 작업)

목표:
- 타인 정보를 보고 싶을 때 진입하는 프로필 모달과 자기소개 필드를 먼저 도입한다.
- 후기 상세/댓글/경기톡 작성자 영역에 레벨을 상시 표시하지 않고, 닉네임·사진 탭 → 모달 흐름을 깐다.
- 시즌 레벨 본 기능보다 먼저 출시한다. 모달의 레벨 영역은 placeholder 또는 숨김으로 두고, Step 10에서 실데이터를 연결한다.

작업:
- `profiles.bio text NULL` 컬럼 추가 (마이그레이션 SQL `supabase/add-profile-bio.sql` 또는 통합 SQL에 포함)
- 마이페이지 프로필 편집 UI에 자기소개 입력 필드 추가 (150자, 한 줄, 이모지 허용)
- `getPublicProfileAction(userId)` 서버 액션 신설
  - 반환: 사진 / 닉네임 / 응원팀 / bio / 시즌 레벨(placeholder) / 시즌 활동 지표(직관 횟수·승률·후기 수) / `relationship` / `incoming_request_id`
  - `relationship`은 기존 `lib/actions/friends.ts`의 `FriendCandidate.relationship` 패턴과 동일 + `self` 추가
- `<ProfileModal />` 컴포넌트 신설
  - 카드형 작은 모달, 배경 탭/닫기 버튼으로 닫힘
  - 헤더: 사진 / 닉네임 / 응원팀 뱃지
  - 자기소개: 빈 값일 때 "아직 소개가 없어요" placeholder
  - 활동 지표 영역: 현재 시즌 직관 횟수·승률·후기 수
  - 레벨/칭호 영역: 이번 Step에서는 숨김 또는 placeholder. Step 10에서 실데이터 연결
  - 친구 액션 영역: 기존 친구 액션 재사용
    - `self` → "내 프로필" 라벨 (또는 버튼 숨김)
    - `friend` → "친구" 비활성 뱃지
    - `requested` → "신청됨" 비활성
    - `incoming` → "수락" / "거절" 버튼 (`respondFriendRequestAction`)
    - `none` → "친구 신청" 버튼 (`sendFriendRequestAction`)
- 작성자 영역 탭 → 모달 진입 연결
  - 후기 상세 작성자
  - 후기 리스트 카드 작성자
  - 댓글 작성자
  - 경기톡 글 작성자
  - 경기톡 댓글 작성자
- 후기 상세 작성자 영역에서 **레벨 상시 표시 코드는 도입하지 않는다** (애초에 없으므로 추가만 안 하면 됨)

테스트 기준:
- 본인 프로필 탭해도 모달이 동일하게 열린다 (특수 분기 없음, 친구 액션만 `self` 상태)
- 자기소개 빈 값은 placeholder 문구로 표시된다
- 친구 신청/수락/거절/끊기 시 모달 내 상태가 즉시 반영된다
- 친구 페이지(`/my/friends`)의 기존 흐름이 깨지지 않는다
- 자기소개 150자 초과 입력 차단
- 자기소개 줄바꿈 입력 차단

완료 조건:
- 자기소개 편집/저장 풀 흐름 동작
- 프로필 모달이 후기/댓글/경기톡 모든 작성자 영역에서 진입 가능
- 모달 내 친구 액션 5가지 상태가 모두 정상

### Step 1. 디자인 전용 목업 적용

목표:
- 실데이터 변경 없이 시즌 레벨 UI를 먼저 확인한다.
- 마이페이지와 홈에서 레벨 노출 위치와 밀도를 검토한다.

작업:
- 시즌 레벨 표시용 mock 데이터 상수 추가
- 마이페이지 프로필 영역에 시즌 레벨 카드 추가
- 홈 내 카드에는 짧은 `Lv.6 응원단골` 정도만 표시
- 후기 상세/커뮤니티/댓글/경기톡에는 레벨을 상시 표시하지 않음 (Step 0의 프로필 모달로만 노출)

확인:
- `http://localhost:3000/my`
- `http://localhost:3000/`

테스트 기준:
- 모바일에서 카드가 너무 커지지 않는다.
- 닉네임이 길어도 레벨 텍스트와 겹치지 않는다.
- 홈의 핵심 정보인 직관 승률/현재 직관 흐름을 방해하지 않는다.
- 커뮤니티/후기 상세/댓글/경기톡에 레벨 텍스트가 새로 추가되지 않았는지 확인.

완료 조건:
- 디자인 방향 승인
- mock 데이터 제거 전까지 UI만 독립적으로 확인 가능

### Step 2. 레벨 계산 유틸 추가

목표:
- DB 연결 전에도 동일한 레벨 계산 규칙을 사용할 수 있게 한다.

작업:
- 레벨 threshold 상수 추가
- `getSeasonLevel(totalXp)` 유틸 추가
- 다음 레벨까지 필요한 XP 계산 추가
- 진행률 계산 추가

예상 파일:
- `lib/season-level/levels.ts`
- `lib/season-level/types.ts`

테스트 기준:
- 0 XP는 Lv.1
- 200 XP는 Lv.2
- 7700 XP 이상은 Lv.10
- Lv.10에서는 다음 레벨 필요 XP가 0 또는 max 상태로 표시

완료 조건:
- mock UI가 하드코딩 레벨이 아니라 계산 유틸 결과를 사용

### Step 3. DB 설계와 마이그레이션 준비

목표:
- XP 이벤트 로그와 1일 1직관 제한을 DB에서 보장할 준비를 한다.

작업:
- 1일 1직관은 **trigger 방식**으로 보장한다. `attendances`에 별도 날짜 컬럼을 추가하지 않고, INSERT/UPDATE trigger가 `games.game_date`를 조인해 같은 날짜의 기존 직관 존재 여부를 확인한다.
  - 우천 연기로 `games.game_date`가 바뀌어도 동기화 부담 없음.
  - 기존 `unique(user_id, game_id)`는 그대로 유지(같은 경기 중복 등록 방지).
- 기존 데이터 점검: 같은 유저가 같은 날짜에 여러 직관을 가진 케이스가 있는지 확인 쿼리 작성. 있으면 trigger 적용 전 정리.
- `season_xp_events` 테이블 설계.
- RLS 정책과 GRANT 문 설계 (Supabase 2026-10-30 Data API 권한 변경 대비).

권장 테이블:

```text
season_xp_events
- id            uuid pk
- user_id       uuid (auth.users)
- season        int  (games.game_date의 연도)
- type          text ('attendance_result_acknowledged' | 'ticket_verified' | 'review_created' | 'review_photo_bonus' | ...revoked)
- source_id     uuid (attendance_id 기준)
- xp            int  (양수=지급, 음수=회수)
- metadata      jsonb
- created_at    timestamptz
```

권장 unique:

```text
user_id + season + type + source_id
```

시즌 정의:
- `season int` — `extract(year from games.game_date)` 결과.
- 시즌 경계: KBO 정규시즌은 보통 3월~11월. 안전하게 **`game_date`의 연도** 기준으로 통일. 시즌 종료 후 12월에 등록하는 과거 경기도 그 경기의 연도 시즌으로 계산.

1일 1직관 trigger 초안:

```sql
create function check_one_attendance_per_day()
returns trigger as $$
declare
  new_game_date date;
  existing_count int;
begin
  select game_date into new_game_date
    from public.games where id = new.game_id;

  select count(*) into existing_count
    from public.attendances a
    join public.games g on g.id = a.game_id
    where a.user_id = new.user_id
      and g.game_date = new_game_date
      and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if existing_count > 0 then
    raise exception '하루에 하나의 직관만 기록할 수 있어요.'
      using errcode = '23505';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger one_attendance_per_day
  before insert or update on public.attendances
  for each row execute function check_one_attendance_per_day();
```

RLS / GRANT 초안 (Supabase Data API 2026-10-30 변경 대비):

```sql
-- 본인 이벤트만 SELECT (친구 모달에서 타인 시즌 XP 합계는 서버 액션의 service role로 조회)
grant select on public.season_xp_events to authenticated;
grant insert, update, delete on public.season_xp_events to service_role;

alter table public.season_xp_events enable row level security;

create policy "users read own xp events"
  on public.season_xp_events for select to authenticated
  using (auth.uid() = user_id);
```

확인:
- 같은 유저가 같은 날짜에 여러 직관을 가진 기존 데이터가 있는지 확인.
- 중복이 있으면 trigger 적용 전 정리 정책 결정 (가장 오래된 것 유지, 나머지 삭제 + 사용자 안내 등).

완료 조건:
- SQL 적용 전 검토 가능한 마이그레이션 초안 완성 (`supabase/season-level.sql` 형태로 정리)

### Step 4. DB 마이그레이션 적용

목표:
- 실제 DB에 시즌 레벨 저장 구조와 1일 1직관 제약을 적용한다.

작업:
- `supabase/season-level.sql` 작성 (Step 3에서 설계한 초안 기준):
  - `check_one_attendance_per_day()` 함수 + `one_attendance_per_day` trigger
  - `season_xp_events` 테이블 + unique 제약 + index
  - RLS enable + 정책
  - GRANT 문 (Supabase 2026-10-30 변경 대비)
- Supabase SQL Editor에서 적용 (사용자 작업).

테스트 기준:
- 같은 날짜의 다른 경기를 추가 등록하면 DB에서 실패한다 (trigger에서 `23505` 에러).
- 같은 경기 중복 등록도 기존처럼 실패한다 (`unique(user_id, game_id)` 유지).
- 다른 날짜 직관 등록은 정상 동작.
- 기존 직관 목록 조회가 깨지지 않는다.
- `season_xp_events` 테이블에 service role로 INSERT 가능, 일반 user는 본인 row만 SELECT.

완료 조건:
- Supabase SQL Editor에서 마이그레이션 성공.
- 기존 주요 화면 정상 동작.

### Step 5. 1일 1직관 앱 로직 연결

목표:
- 사용자가 DB 에러를 보기 전에 화면에서 자연스럽게 안내받게 한다.

작업:
- 일반 직관 등록 시 같은 날짜 기존 직관 확인
- 티켓 기반 직관 등록 시 같은 날짜 기존 직관 확인
- 중복 날짜 등록 시 기존 기록 수정 안내 메시지 표시
- 서버 액션에서도 동일 조건 방어

사용자 문구:

```text
하루에 하나의 직관만 기록할 수 있어요.
이미 이 날짜에 등록한 직관이 있어요. 기존 기록을 수정해 주세요.
```

테스트 기준:
- 같은 날짜 직관 등록 차단
- 다른 날짜 직관 등록 가능
- 티켓 인증 흐름에서도 같은 정책 적용
- 에러 메시지가 기술적 DB 에러로 노출되지 않음

완료 조건:
- 1일 1직관 정책이 UI와 서버에서 모두 동작

### Step 6. XP 이벤트 헬퍼 구현

목표:
- 각 기능에서 XP 지급/회수를 직접 SQL로 흩뿌리지 않도록 공통화한다.

작업:
- `grantXpEvent({ userId, season, type, sourceId, xp })` 추가 (멱등 — unique key 위반 시 무시)
- `revokeXpEvent({ userId, season, type, sourceId })` 추가 (지급된 이벤트가 있을 때만 -xp row 생성)
- `getUserSeasonXp(userId, season)` 추가
- `getUserSeasonLevel(userId, season)` 추가 (`getSeasonLevel(totalXp)` 유틸과 조합)

예상 파일:
- `lib/season-level/events.ts` (server action 또는 helper)
- `lib/supabase/season-level.ts` (DB 쿼리)

사진 판별 유틸은 별도 모듈 없이 `photos.length > 0` 한 줄로 처리 (Step 7 사진 판별 기준 참조).

테스트 기준:
- 같은 이벤트를 두 번 지급해도 1회만 반영 (DB unique key 보장)
- 지급된 이벤트가 없으면 회수 이벤트를 만들지 않음

완료 조건:
- 액션 연결 전 단위 테스트 또는 스크립트 검증 가능

### Step 7. 실시간 XP 지급 연결

목표:
- 신규 활동에서 XP가 자동으로 쌓이게 한다.

작업 — 각 트리거를 정확한 위치의 server action에 연결:

| 트리거 | 호출 위치 (파일/액션) | XP |
|---|---|---:|
| `attendance_result_acknowledged` | `lib/actions/attendance.ts` → `acknowledgeAttendanceResultAction` | +30 |
| `ticket_verified` (직관과 함께 인증) | `lib/actions/ticket.ts` → `registerAttendanceFromTicket` | +100 |
| `ticket_verified` (사후 인증) | `lib/actions/attendance.ts` → `verifyAttendanceWithTicket` | +100 |
| `review_created` | `lib/actions/review.ts` → `createReviewAction` | +70 |
| `review_photo_bonus` (생성 시) | `lib/actions/review.ts` → `createReviewAction` (photos.length > 0) | +20 |
| `review_photo_bonus` (수정 시) | `lib/actions/review.ts` → `updateReviewAction` (photos.length > 0이고 아직 미지급) | +20 |

사진 보너스 판별 기준:
- **시스템 기본 이미지는 사용하지 않는다.** 후기는 사진이 비어 있는 상태로 시작하고, 모든 사진은 사용자가 직접 업로드한 Storage 객체다.
- 따라서 보너스 판별은 단순히 `reviews.photos.length > 0` 으로 충분.
- 별도 URL 패턴 검사나 플래그 컬럼 불필요.

주의:
- 직관 등록 즉시 `+30`을 지급하지 않는다.
- 사진 보너스는 후기 수정으로 나중에 사진을 추가해도 지급한다.
- 사진 삭제만으로는 XP를 회수하지 않는다.

테스트 기준:
- 경기 종료 확인 후 XP 증가
- 티켓 인증 성공 후 XP 증가 (등록 시 / 사후 모두)
- 후기 작성 후 XP 증가
- 사진 없는 후기 작성 후 나중에 사진 추가 시 `+20`
- 같은 행동 반복 시 중복 지급 없음 (멱등성)

완료 조건:
- 신규 사용자 기준으로 시즌 XP가 자연스럽게 증가

### Step 8. XP 회수 연결

목표:
- 삭제 시 현재 유효한 활동 상태와 XP 합계가 맞게 만든다.

작업:
- 후기 삭제 시 `review_created`, `review_photo_bonus` 회수
- 직관 삭제 시 해당 직관의 모든 XP 이벤트 회수
- 티켓 인증 삭제/취소 기능이 생기면 `ticket_verified` 회수 연결

테스트 기준:
- 후기 삭제 시 후기 XP와 사진 보너스 XP 감소
- 직관 삭제 시 직관/티켓/후기 관련 XP 모두 감소
- 이미 회수한 이벤트를 다시 회수하지 않음

완료 조건:
- 삭제/재등록 반복 후에도 XP 합계가 예상과 일치

### Step 9. 기존 데이터 백필

목표:
- 시즌 중 도입 시 기존 사용자 활동을 XP로 반영한다.

작업:
- 전체 1회 백필 스크립트 또는 관리자 액션 작성
- `ensureSeasonXpBackfilled(userId, season)` 작성
- `season_level_states.last_xp_backfilled_at` 도입 여부 결정
- 백필 실행 전 dry-run 출력 지원

백필 대상:
- `result_acknowledged_at IS NOT NULL` 직관
- `verified = true` 직관
- 직관에 연결된 후기
- 사용자 업로드 사진이 있는 후기

테스트 기준:
- 같은 백필을 여러 번 실행해도 XP 중복 없음
- 삭제된 기록은 백필하지 않음
- 백필 후 마이페이지 XP가 기대값과 일치

완료 조건:
- 운영자가 안전하게 1회 실행할 수 있는 절차 확보

### Step 10. 실데이터 UI 연결

목표:
- Step 1에서 승인한 디자인에 실제 시즌 레벨 데이터를 연결한다.
- Step 0의 프로필 모달 레벨 영역을 실데이터로 채운다.

작업:
- AppState 또는 페이지 loader에 시즌 레벨 데이터 추가
- 마이페이지 시즌 레벨 카드 실데이터 연결
- 홈 짧은 레벨 표시 실데이터 연결
- `getPublicProfileAction` 반환의 `season_level`에 실제 값 채우고, `<ProfileModal />` 레벨 영역 노출
- 로딩/빈 상태 처리

테스트 기준:
- 신규 유저는 Lv.1로 표시
- XP가 있는 유저는 계산된 레벨로 표시
- 레벨 데이터 로딩 실패 시 화면 전체가 깨지지 않음
- 프로필 모달의 레벨이 모달 대상 사용자 본인의 레벨로 표시되며, 현재 로그인 유저 레벨로 잘못 표시되지 않음

완료 조건:
- mock 데이터 제거
- 마이/홈 실데이터 레벨 표시 완료
- 프로필 모달 레벨 영역 실데이터 표시 완료

### Step 11. 회귀 테스트와 배포

목표:
- 기존 핵심 기능이 시즌 레벨 작업으로 깨지지 않았는지 확인한다.

수동 테스트:
- 회원가입/로그인
- 직관 등록
- 티켓 인증
- 경기 종료 확인
- 후기 작성
- 후기 수정으로 사진 추가
- 후기 삭제
- 직관 삭제
- 마이페이지 레벨 표시
- 홈 레벨 표시
- 자기소개 입력/저장/표시 (빈 값 placeholder 포함)
- 프로필 모달 진입 (후기 상세, 후기 카드, 댓글, 경기톡 글, 경기톡 댓글)
- 프로필 모달 친구 액션 5가지 상태 (self/none/friend/requested/incoming)
- 후기 상세·커뮤니티·댓글·경기톡에 레벨이 상시 노출되지 않는지 확인

자동/명령 테스트:
- lint
- typecheck
- 가능하면 시즌 레벨 유틸 단위 테스트

완료 조건:
- 로컬 확인 완료
- 프로덕션 배포 후 마이페이지/홈/후기 상세 스모크 테스트 완료

## 4. 권장 진행 순서

Step 0(프로필 모달 + 자기소개) 선행 → 이후 시즌 레벨 본 기능.

```text
Step 0 프로필 모달 + 자기소개 (선행 출시)
→ Step 1 디자인 목업
→ Step 2 계산 유틸
→ Step 3 DB 설계
→ Step 4 DB 적용
→ Step 5 1일 1직관 연결
→ Step 6 XP 헬퍼
→ Step 7 지급 연결
→ Step 8 회수 연결
→ Step 9 백필
→ Step 10 실데이터 UI (마이/홈 + 프로필 모달 레벨 영역)
→ Step 11 테스트/배포
```

Step 0은 시즌 레벨과 독립적으로 가치가 있으므로 먼저 단독 배포할 수 있습니다. 모달의 레벨 영역은 Step 10에서 실데이터로 채워집니다.

디자인 승인 전에는 시즌 레벨 DB 변경을 하지 않는 것을 권장합니다. 시즌 레벨 카드의 크기와 위치가 확정되면 실데이터 작업으로 넘어갑니다.

## 5. 남은 결정 사항

- 시즌 레벨 카드의 최종 디자인
- Lv.10 이후 표시 방식
- 지난 시즌 기록 화면을 첫 버전에 포함할지 여부
- 레벨업 토스트/모달을 첫 버전에 포함할지 여부
- 프로필 모달 활동 지표(직관 횟수·승률·후기 수)의 시즌 기준 — 현재 시즌만 / 누적 둘 다 / 토글 중 택1

## 5.1. 확정된 P0 결정 사항 (2026-05-14)

- **시스템 사진 제거**: 후기는 사진이 비어 있는 상태로 시작. 사용자 업로드 사진만 사용. 사진 보너스 판별은 `reviews.photos.length > 0` 으로 단순화.
- **시즌은 `int`**: `extract(year from games.game_date)` 결과. KBO 시즌은 보통 11월 종료이지만 안전하게 12/31 KST 까지를 같은 시즌으로 본다.
- **1일 1직관은 trigger 방식**: `attendances`에 별도 날짜 컬럼을 추가하지 않고 `check_one_attendance_per_day()` trigger로 검증. 우천 연기로 `games.game_date`가 바뀌어도 자동 반영(동기화 부담 없음). 기존 `unique(user_id, game_id)` 제약은 그대로 유지.
- **XP 백필 실행 방식**: 단발 스크립트 `scripts/backfill-season-xp.ts` + dry-run 옵션으로 시작. 운영자가 환경변수로 실행. 어드민 콘솔은 Phase 2로.

## 5.2. 진행 상태 (2026-05-16 기준)

Step 0 ~ 11 모두 구현 완료. `feature/season-level` 브랜치에 커밋되어 있고 master 머지 대기 상태.

| Step | 상태 | 핵심 변경 |
|---|---|---|
| Step 0 — 프로필 모달 + 자기소개 | ✅ 완료 | `profiles.bio`, `<ProfileModal />`, 5곳 작성자 영역 연결 |
| Step 1 — 디자인 목업 | ✅ 완료 | `SeasonLevelCard` + `SeasonLevelMiniChip`, mock 데이터 |
| Step 2 — 레벨 계산 유틸 | ✅ 완료 | `lib/season-level/levels.ts` `getSeasonLevel()` |
| Step 3 — DB 설계 | ✅ 완료 | `supabase/season-level.sql` 작성 |
| Step 4 — DB 마이그레이션 적용 | ✅ 완료 | Supabase SQL Editor 실행, trigger + `season_xp_events` + RLS/GRANT |
| Step 5 — 1일 1직관 앱 로직 | ✅ 완료 | `createAttendanceAction`/`registerAttendanceFromTicket`에 사전 체크 + trigger 에러 분기 |
| Step 6 — XP 이벤트 헬퍼 | ✅ 완료 | `lib/season-level/events.ts` (`grantXpEvent`/`revokeXpEvent`/`getUserSeasonXp`/`getUserSeasonLevel`) |
| Step 7 — 실시간 XP 지급 | ✅ 완료 | 4개 server action(ack/티켓 등록/티켓 사후 인증/후기 작성)에 grant 호출 + 시스템 사진 fallback 제거 |
| Step 8 — XP 회수 | ✅ 완료 | `deleteReviewAction`/`deleteAttendanceAction`에 revoke 호출 |
| Step 9 — 백필 스크립트 | ✅ 완료 | `scripts/backfill-season-xp.mjs` dry-run/--apply, 멱등 |
| Step 10 — 실데이터 UI | ✅ 완료 | `lib/season-level/queries.ts` SSR fetch + Home/My/ProfileModal mock 제거 |
| Step 11 — 회귀 검증 | ✅ 완료 | `npx tsc --noEmit`/`npm run build` 통과 |

### 사용자 실측 라운드 (2026-05-16)

실측 중 발견된 버그 두 가지를 추가 fix로 처리:

1. **acknowledgeAttendanceResult XP 누락**
   - 원인: `.update().select("...games!inner(game_date)")` PostgREST 패턴이 빈 결과 반환 → XP 지급 블록 통과 실패
   - 수정: UPDATE select는 본 테이블(`id, game_id`)만, `game_date`는 별도 쿼리 (커밋 `5ebb636`)

2. **결과 보기 모달이 표시되지 않는 문제** (사용자 처리 — 커밋 `f41b057`)
   - 원인 1: `addAttendance`가 mock ID(`att-{timestamp}`)로 client state 추가 → server UUID와 불일치 → ack/finalize 호출 시 DB에서 못 찾음
   - 원인 2: `.result-modal { position: fixed }`인데 phone-frame `overflow:hidden` + `border-radius`로 클리핑되어 viewport에 떠도 안 보임
   - 원인 3: `setResultPayload` 가드(`current?.attendanceId === payload.attendanceId ? current : payload`)로 같은 attendance 두 번째 클릭 시 모달 안 열림
   - 수정:
     - `createAttendanceAction`이 `{ attendanceId }` 반환, client `addAttendance`가 server UUID 사용
     - `.result-modal { position: fixed → absolute }` (ModalShell과 동일 패턴, phone-frame 안에 풀스크린)
     - 가드 제거 — `setResultPayload(payload)` 단순화
     - `acknowledgeAttendanceResult`를 Promise 반환으로 변경, 실패 시 토스트 안내
     - client state에 score/result가 비어있는 케이스에 `finalizeAttendanceAction` fallback 추가

### 사용자 작업 (남은 단계)

- [ ] `scripts/backfill-season-xp.mjs --apply` 실행 — 기존 직관·후기에 XP 소급 적용 (108개 이벤트 예정, 멱등)
- [ ] master 머지 + 프로덕션 배포
- [ ] 본 운영 환경에서 실측 검증

## 6. Phase 2 일괄 도입 예정 항목

아래 항목들은 MVP에 포함하지 않고 Phase 2에서 한 번에 묶어 도입한다.

- **신고 기능 일괄 도입**
  - 경기톡 글/댓글 신고 버튼
  - 후기/후기 댓글 신고 버튼
  - 자기소개 부적절 내용 신고 (프로필 모달 내)
  - 신고 테이블·관리자 처리 동선 설계
- **친구 신청 취소**
  - 프로필 모달 `requested` 상태에서 신청 취소 액션 (`friend_requests` pending row 제거)
- **그 외 잠재 후보**
  - 차단/숨김(Block) 기능 — 신고와 동시 검토
