-- BallPlay bp_lineups 보강 — 라인업 등록(registered) 카드 + 전적 집계
--
-- 기획 (2026-05-25 결정):
--   - 슬롯(status='draft'): 편집 가능. 라인업 빌더 작업장.
--   - 등록 카드(status='registered'): 변경 불가. 경기장에 영구 등록. 도전 받으며 전적 누적.
--   - 본인 중복 등록 차단: 같은 사용자가 동일 lineup_hash를 등록 X (다른 사람과는 동일 hash 허용)
--   - 등록 카드는 모든 사용자가 read 가능 (공개 풀)
--   - 전적: bp_records에 home/away lineup_id 기록 → view로 집계
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- 1. bp_lineups 컬럼 추가
-- ============================================================
alter table public.bp_lineups
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'registered'));

alter table public.bp_lineups
  add column if not exists description text;

alter table public.bp_lineups
  add column if not exists lineup_hash text;

-- 본인 중복 방지: 같은 사용자가 같은 라인업을 한 번만 등록
create unique index if not exists bp_lineups_owner_hash_unique
  on public.bp_lineups (owner_user_id, lineup_hash)
  where status = 'registered' and lineup_hash is not null;

-- 등록 카드 조회 인덱스 (정렬용)
create index if not exists bp_lineups_registered_idx
  on public.bp_lineups (created_at desc) where status = 'registered';

-- ============================================================
-- 2. 등록 카드 잠금 — 핵심 필드 변경 차단 (description만 수정 허용)
-- ============================================================
create or replace function public.bp_lineups_immutable_when_registered()
returns trigger language plpgsql as $$
begin
  if OLD.status = 'registered' then
    if NEW.batting is distinct from OLD.batting
       or NEW.pitching is distinct from OLD.pitching
       or NEW.name is distinct from OLD.name
       or NEW.lineup_hash is distinct from OLD.lineup_hash
       or NEW.team_id is distinct from OLD.team_id
       or NEW.status is distinct from OLD.status then
      raise exception '등록된 라인업은 변경할 수 없습니다 (description만 수정 가능)';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists bp_lineups_immutable_check on public.bp_lineups;
create trigger bp_lineups_immutable_check
  before update on public.bp_lineups
  for each row execute function public.bp_lineups_immutable_when_registered();

-- ============================================================
-- 3. RLS 보강 — 등록 카드는 모든 인증 사용자가 read 가능
-- ============================================================
drop policy if exists "bp_lineups_select" on public.bp_lineups;
create policy "bp_lineups_select"
on public.bp_lineups for select
to authenticated
using (
  owner_user_id = auth.uid()
  or status = 'registered'
);

-- ============================================================
-- 4. bp_records에 라인업 ID 연결 — 전적 집계용
-- ============================================================
alter table public.bp_records
  add column if not exists home_lineup_id uuid references public.bp_lineups(id) on delete set null;

alter table public.bp_records
  add column if not exists away_lineup_id uuid references public.bp_lineups(id) on delete set null;

create index if not exists bp_records_home_lineup_idx
  on public.bp_records (home_lineup_id) where home_lineup_id is not null;

create index if not exists bp_records_away_lineup_idx
  on public.bp_records (away_lineup_id) where away_lineup_id is not null;

-- ============================================================
-- 5. 전적 집계 view — 라인업별 wins/losses/draws/matches
-- ============================================================
create or replace view public.bp_lineup_stats as
with lineup_results as (
  select
    home_lineup_id as lineup_id,
    case when (final_score->>'home')::int > (final_score->>'away')::int then 1 else 0 end as win,
    case when (final_score->>'home')::int < (final_score->>'away')::int then 1 else 0 end as loss,
    case when (final_score->>'home')::int = (final_score->>'away')::int then 1 else 0 end as draw
  from public.bp_records
  where home_lineup_id is not null
  union all
  select
    away_lineup_id as lineup_id,
    case when (final_score->>'away')::int > (final_score->>'home')::int then 1 else 0 end as win,
    case when (final_score->>'away')::int < (final_score->>'home')::int then 1 else 0 end as loss,
    case when (final_score->>'home')::int = (final_score->>'away')::int then 1 else 0 end as draw
  from public.bp_records
  where away_lineup_id is not null
)
select
  lineup_id,
  count(*)::int as matches,
  coalesce(sum(win), 0)::int as wins,
  coalesce(sum(loss), 0)::int as losses,
  coalesce(sum(draw), 0)::int as draws
from lineup_results
group by lineup_id;

-- view에 RLS는 안 걸림 (Supabase view는 정의된 테이블의 RLS를 따름).
-- bp_records가 본인 row만 보이지만, 집계 view는 통계만 노출하므로 권한 확장 필요.
-- 해결: security definer 함수로 감싸기.
create or replace function public.get_lineup_stats(p_lineup_id uuid)
returns table (matches int, wins int, losses int, draws int)
language sql
security definer
set search_path = public
as $$
  select
    coalesce(s.matches, 0) as matches,
    coalesce(s.wins, 0) as wins,
    coalesce(s.losses, 0) as losses,
    coalesce(s.draws, 0) as draws
  from (values (p_lineup_id)) t(id)
  left join public.bp_lineup_stats s on s.lineup_id = t.id
  limit 1;
$$;

-- 여러 라인업 동시 조회용 — UI에서 카드 6개 한번에 stats 가져올 때
create or replace function public.get_lineup_stats_bulk(p_lineup_ids uuid[])
returns table (lineup_id uuid, matches int, wins int, losses int, draws int)
language sql
security definer
set search_path = public
as $$
  select
    t.id as lineup_id,
    coalesce(s.matches, 0)::int as matches,
    coalesce(s.wins, 0)::int as wins,
    coalesce(s.losses, 0)::int as losses,
    coalesce(s.draws, 0)::int as draws
  from unnest(p_lineup_ids) as t(id)
  left join public.bp_lineup_stats s on s.lineup_id = t.id;
$$;

-- ============================================================
-- 6. 등록 카드 정렬 함수 — 메인 노출용 (승률 위주, 표본 5경기 가중)
-- ============================================================
-- 정렬 키:
--   1) least(matches, 5) desc — 5경기 이상이면 동등(5), 미만이면 매치 수 우선
--   2) wins / nullif(matches, 0) desc — 승률 (매치 0은 마지막)
--   3) matches desc — 동률 시 더 많이 뛴 순
create or replace function public.list_registered_lineups_by_winrate(p_limit int)
returns table (
  lineup_id uuid,
  matches int,
  wins int,
  losses int,
  draws int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id as lineup_id,
    coalesce(s.matches, 0)::int as matches,
    coalesce(s.wins, 0)::int as wins,
    coalesce(s.losses, 0)::int as losses,
    coalesce(s.draws, 0)::int as draws
  from public.bp_lineups l
  left join public.bp_lineup_stats s on s.lineup_id = l.id
  where l.status = 'registered'
  order by
    least(coalesce(s.matches, 0), 5) desc,
    case when coalesce(s.matches, 0) > 0
         then coalesce(s.wins, 0)::numeric / coalesce(s.matches, 0)
         else 0 end desc,
    coalesce(s.matches, 0) desc,
    l.created_at desc
  limit p_limit;
$$;

-- ============================================================
-- 7. 코멘트
-- ============================================================
comment on column public.bp_lineups.status is
  'draft: 편집 가능한 슬롯. registered: 경기장 등록 카드 (변경 불가).';
comment on column public.bp_lineups.description is
  '등록 카드 설명. 예: "기아 김도영 4번 최강 라인업!"';
comment on column public.bp_lineups.lineup_hash is
  '라인업 고유 해시 (타순 9 + 투수 9 + 포지션 정렬). 본인 중복 등록 방지.';
comment on column public.bp_records.home_lineup_id is
  '홈팀 라인업 ID (bp_lineups.id) — 라인업 전적 집계용. 라인업 삭제 시 NULL.';
comment on column public.bp_records.away_lineup_id is
  '원정팀 라인업 ID (bp_lineups.id) — 라인업 전적 집계용. 라인업 삭제 시 NULL.';
