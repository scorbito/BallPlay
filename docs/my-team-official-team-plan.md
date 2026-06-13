# 나만의 팀 공식팀화 작업 계획

## 목표

나만의 팀을 별도 미니 모드가 아니라 기존 출전팀과 같은 공식 팀으로 승격한다.

공식팀으로 인정되는 범위:

- 공개 매치업 가능
- 팀 전적 기록
- 계정 누적 전적 합산
- 출전팀 랭킹 포함
- 가을야구 출전 가능
- 명예의 전당 표시 가능

## 팀 ID 정책

기존 KBO 팀은 기존 ID를 그대로 사용한다.

- `doosan`
- `lg`
- `kt`
- 기타 KBO 팀 ID

나만의 팀은 전역 고유 ID를 사용한다.

- `custom:<uuid>`

이 방식은 기존 `bp_lineups.team_id`, `bp_records.home_team_id`, `bp_records.away_team_id`처럼 `text` 기반으로 저장하던 구조를 유지하면서 커스텀 팀을 공식팀처럼 넣을 수 있다.

## DB 구조

1차 SQL:

- `supabase/add-bp-custom-teams.sql`

추가 테이블:

- `bp_custom_teams`
- `bp_custom_team_players`

기존 테이블 확장:

- `bp_lineups.lineup_type`
- `bp_lineups.custom_team_id`
- `bp_records.home_team_meta`
- `bp_records.away_team_meta`
- `bp_playoff_runs.team_meta`
- `bp_playoff_champions.team_meta`

## 코드 타입

추가 타입:

- `lib/types/playableTeam.ts`

핵심 타입:

- `PlayableTeamType`
- `PlayableTeamMeta`
- `PlayableTeamRoster`
- `PlayableTeamLineup`

팀 판별:

- `isCustomTeamId(teamId)`
- `getPlayableTeamType(teamId)`

## 쿼리 뼈대

추가 파일:

- `lib/supabase/query-parts/bpCustomTeams.ts`

기능:

- 내 활성 커스텀 팀 조회
- 커스텀 팀 ID로 조회
- 커스텀 팀 생성/수정
- 보유 선수 ID 조회
- 보유 선수 추가
- 커스텀 팀 로스터 모델 생성

## 후속 구현 순서

1. 나만의 팀 화면을 DB 기반으로 전환
   - 로컬스토리지 팀 정보와 선수 목록을 DB로 이전
   - DB에 팀이 없고 로컬 데이터가 있으면 1회 마이그레이션

2. 나만의 팀 라인업을 `bp_lineups`에 저장
   - `team_id = custom:<uuid>`
   - `lineup_type = custom`
   - `custom_team_id = custom:<uuid>`
   - 보유 선수만 라인업에 포함 가능

3. 기존 TeamLogo/TeamBadge 안전화
   - `custom:*` 팀 ID가 들어와도 깨지지 않도록 처리
   - custom 팀 메타가 있으면 이름/색상/이니셜 표시
   - 없으면 fallback 표시

4. 공개 매치 후보에 custom 라인업 포함
   - 조건: 타자 9명, 선발 투수 1명, 공개 상태, 활성 팀
   - 기존 KBO 기반 공개 라인업과 같은 리스트에 노출

5. 경기 결과 저장 확장
   - `bp_records.home_team_meta`
   - `bp_records.away_team_meta`
   - 경기 시작 시점의 커스텀 팀 이름/색상/뱃지 스냅샷 저장

6. 랭킹/전적 화면 연결
   - 기존 라인업 랭킹에 custom 팀 포함
   - 계정 누적 전적 합산
   - custom 팀도 일반 공식팀처럼 표시

7. 가을야구 연결
   - 출전팀 선택에 custom 팀 라인업 포함
   - `bp_playoff_runs.team_meta` 저장
   - 명예의 전당에서 custom 팀 뱃지 표시

## 주의점

- `getTeam(teamId)` 직접 호출은 custom 팀에서 깨질 수 있다.
- 화면 컴포넌트는 점진적으로 `PlayableTeamMeta` 기반으로 바꾸는 것이 안전하다.
- 과거 경기 기록은 팀 이름/뱃지 스냅샷이 있어야 팀명 변경 후에도 기록이 보존된다.
- 공식 전적에 포함되므로 경기 시작 시 라인업과 시드는 반드시 고정되어야 한다.
