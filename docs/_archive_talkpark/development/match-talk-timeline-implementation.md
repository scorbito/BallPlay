# 경기톡 타임라인 보기 개발 기록

작성일: 2026-05-14

## 작업 개요

- 브랜치: `feature/match-talk-timeline`
- master 머지 커밋: `4ef4495 feat: add match talk timeline view`
- 목적: 경기톡에 별도 상세 페이지를 만들지 않고, 날짜/경기 필터 상태에서 글 흐름을 빠르게 훑을 수 있는 타임라인 보기를 추가한다.

## 기획 반영

- 기본 경기톡 피드는 기존 카드형을 유지한다.
- 날짜 또는 경기 필터로 진입하면 기본 표시를 타임라인으로 한다.
- 필터 상태에서는 `필터 해제`, `카드로 보기` 또는 `타임라인 보기` 버튼을 제공한다.
- 타임라인에서는 글의 사진을 직접 노출하지 않고 `사진 있음` 배지만 표시한다.
- 좋아요, 댓글, 삭제는 개별 글 단위로 유지한다.
- 댓글은 상세 페이지 이동 없이 타임라인 글 아래에서 펼쳐서 확인, 작성, 삭제한다.
- 경기톡 상세 페이지는 만들지 않는다.

## 동작 정책

### 전체 피드

- `/community?tab=match-talk`
- 기본은 카드형 피드다.
- 사용자가 카드의 경기 영역을 누르면 해당 경기 필터로 전환되고, 기본 타임라인으로 표시된다.

### 경기 필터

- `/community?tab=match-talk&gameId={gameId}`
- 경기 헤더를 표시한다.
- `status_at_post` 기준으로 `경기 전`, `진행 중`, `최종` 섹션을 나눈다.
- 같은 상태 안에서는 작성 시각 오름차순으로 표시한다.
- 기본 표시 모드는 타임라인이다.

### 날짜 필터

- `/community?tab=match-talk&date=YYYY-MM-DD`
- 경기별 섹션을 먼저 나눈다.
- 각 경기 안에서 `status_at_post` 기준으로 섹션을 나눈다.
- 기본 표시 모드는 타임라인이다.

## 구현 내용

### `app/community/page.tsx`

- `searchParams.date`를 추가로 받는다.
- SSR 초기 경기톡 조회에서 `gameId`, `date` 필터를 함께 전달한다.
- `CommunityScreen`에 `initialMatchTalkDate`를 전달한다.

### `components/domain/CommunityScreen.tsx`

- `initialMatchTalkDate` prop을 추가한다.
- 후기 탭으로 전환할 때 `gameId`와 함께 `date` 파라미터도 제거한다.
- `MatchTalkFeed`에 날짜 초기값을 전달한다.

### `components/domain/MatchTalkFeed.tsx`

- `gameFilter`, `dateFilter`, `viewMode` 상태를 관리한다.
- `gameId` 또는 `date` 필터가 있으면 초기 `viewMode`를 `timeline`으로 설정한다.
- 필터 해제 시 전체 피드로 돌아가며 `viewMode`를 `card`로 되돌린다.
- 카드에서 경기 필터로 진입할 때 `viewMode`를 `timeline`으로 설정한다.
- `listMatchPostsAction`, `loadMoreMatchPostsAction` 호출에 현재 필터를 동일하게 전달한다.
- 새 글 작성 후 현재 필터와 맞는 글만 피드에 prepend한다.

### `components/domain/MatchTalkTimeline.tsx`

- 신규 타임라인 컴포넌트다.
- 날짜 필터에서는 `gameId`별로 1차 그룹핑한다.
- 경기 필터에서는 선택 경기 안에서 바로 상태별 그룹핑한다.
- 상태 그룹은 `scheduled`, `in_progress`, `finished` 순서로 표시한다.
- 타임라인 글은 작성자, 작성 시각, 본문, 사진 있음 배지, 감정 스티커, 좋아요, 댓글, 삭제 액션을 표시한다.
- 댓글은 `CommentThread`를 재사용해 글 아래에서 펼친다.
- 삭제 확인 모달은 타임라인 카드 안에서 잘리지 않도록 전용 fixed backdrop을 사용한다.
- 감정 스티커는 헤더가 아니라 하단 반응 라인의 왼쪽에 배치한다.

### `lib/actions/matchTalk.ts`

- `loadMoreMatchPostsAction`이 `gameId`, `date` 필터 객체를 받을 수 있게 변경했다.
- 기존 `listMatchPostsFromDb`의 날짜 필터 지원을 그대로 활용한다.

### `styles/dark-match-talk-timeline.css`

- 타임라인 전용 스타일을 별도 파일로 분리했다.
- `dark-match-talk.css`가 이미 길기 때문에 파일 길이 관리를 위해 별도 CSS를 사용했다.
- 타임라인 카드, 상태 섹션, 작은 좋아요/댓글 액션, 삭제 확인 모달 스타일을 포함한다.

### `app/layout.tsx`

- `dark-match-talk-timeline.css` import를 추가했다.

## 검증

- `npm.cmd run lint` 통과.
- `npx.cmd tsc --noEmit --incremental false` 통과.
- 기존 `lib/state/AppState.tsx` hook dependency warning은 이번 작업과 무관한 기존 warning으로 남아 있다.

## 머지 결과

- `feature/match-talk-timeline`에서 커밋 생성.
- `master`로 fast-forward 머지 완료.
- 머지 커밋: `4ef4495 feat: add match talk timeline view`

## 남은 확인 포인트

- 실사용 데이터가 많아졌을 때 날짜 필터 타임라인의 경기 섹션 정렬이 직관적인지 확인한다.
- 모바일 실제 기기에서 타임라인 카드 밀도가 적절한지 확인한다.
- 사용자가 타임라인에서 사진을 보고 싶어 하는 흐름이 많다면 `사진 있음` 배지를 눌러 카드 보기로 전환하는 동선을 추가할 수 있다.
