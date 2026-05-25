-- BallPlay bp_lineups 공개/비공개 모델로 회귀 (2026-05-25)
--
-- 모델 변경:
--   기존: status='draft'(슬롯) + status='registered'(등록 카드, 변경 불가, 별도 row)
--   변경: is_published(공개=잠금, 비공개=편집) — 슬롯 자체가 공개 라인업
--
-- 정책:
--   - 공개 라인업: 수정 불가 + 공개 풀에 노출 + 도전 받음 + 전적 누적 (본인 도전한 경기만)
--   - 비공개 라인업: 자유 편집 + AI/self 매치만 가능
--   - 공개 → 비공개 전환: 전적 리셋 (클라이언트에서 bp_records DELETE 호출)
--   - 본인이 같은 라인업(hash) 중복 공개 불가
--   - 친구 대전은 전적 누적 X (source='friend')
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- 1. 기존 등록 카드(status='registered') row 정리
--    슬롯 모델로 회귀하면서 별도 row였던 등록 카드는 더 이상 의미 없음.
--    데이터 손실 — 사용자가 미리 이해한 상태에서 실행.
-- ============================================================
delete from public.bp_lineups where status = 'registered';

-- ============================================================
-- 2. 본인 중복 unique 인덱스 — status 기반 → is_published 기반
-- ============================================================
drop index if exists bp_lineups_owner_hash_unique;
create unique index if not exists bp_lineups_owner_hash_unique
  on public.bp_lineups (owner_user_id, lineup_hash)
  where is_published = true and lineup_hash is not null;

-- ============================================================
-- 3. 락 trigger — status='registered' 기반 → is_published=true 기반
--    공개 상태에서 핵심 필드 변경 차단. is_published 자체 토글은 허용.
-- ============================================================
drop trigger if exists bp_lineups_immutable_check on public.bp_lineups;
drop function if exists public.bp_lineups_immutable_when_registered();

create or replace function public.bp_lineups_immutable_when_published()
returns trigger language plpgsql as $$
begin
  -- 공개 상태(true → true) 유지 중에는 핵심 필드 변경 차단.
  -- 공개 ↔ 비공개 전환은 허용 (lineup_hash, description은 클라이언트에서 정리).
  if OLD.is_published = true and NEW.is_published = true then
    if NEW.batting is distinct from OLD.batting
       or NEW.pitching is distinct from OLD.pitching
       or NEW.name is distinct from OLD.name
       or NEW.team_id is distinct from OLD.team_id then
      raise exception '공개 라인업은 수정할 수 없습니다. 비공개로 전환 후 수정하세요.';
    end if;
  end if;
  return NEW;
end;
$$;

create trigger bp_lineups_immutable_check
  before update on public.bp_lineups
  for each row execute function public.bp_lineups_immutable_when_published();

-- ============================================================
-- 4. RLS select — status 조건 → is_published 조건
-- ============================================================
drop policy if exists "bp_lineups_select" on public.bp_lineups;
create policy "bp_lineups_select"
on public.bp_lineups for select
to authenticated
using (
  owner_user_id = auth.uid()
  or is_published = true
);

-- ============================================================
-- 5. 전적 집계 view — 본인이 도전한 경기만 집계
--    이전: home/away_lineup_id 양쪽 다 집계 (수동적 전적 포함)
--    변경: bp_records의 user_side를 보고 본인 측 lineup_id만 집계
--    source='friend'는 친선 → 전적 X
-- ============================================================
create or replace view public.bp_lineup_stats as
with own_matches as (
  select
    case when user_side = 'home' then home_lineup_id else away_lineup_id end as lineup_id,
    case
      when user_side = 'home' and (final_score->>'home')::int > (final_score->>'away')::int then 1
      when user_side = 'away' and (final_score->>'away')::int > (final_score->>'home')::int then 1
      else 0
    end as win,
    case
      when user_side = 'home' and (final_score->>'home')::int < (final_score->>'away')::int then 1
      when user_side = 'away' and (final_score->>'away')::int < (final_score->>'home')::int then 1
      else 0
    end as loss,
    case when (final_score->>'home')::int = (final_score->>'away')::int then 1 else 0 end as draw
  from public.bp_records
  where source = 'public'  -- friend는 친선 매치, 전적 누적 X
)
select
  lineup_id,
  count(*)::int as matches,
  coalesce(sum(win), 0)::int as wins,
  coalesce(sum(loss), 0)::int as losses,
  coalesce(sum(draw), 0)::int as draws
from own_matches
where lineup_id is not null
group by lineup_id;

-- ============================================================
-- 6. 정렬 RPC — 등록 카드 기반 → is_published 기반
-- ============================================================
drop function if exists public.list_registered_lineups_by_winrate(int);

create or replace function public.list_published_lineups_by_winrate(p_limit int)
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
  where l.is_published = true
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
-- 7. status / description 컬럼은 데이터 유지 (drop X). 새 코드에서 무시.
--    추후 마이그레이션 안정화 후 drop 가능.
-- ============================================================

-- 코멘트
comment on view public.bp_lineup_stats is
  '본인이 도전한 매치만 집계 (user_side 기반). source=friend는 친선이라 제외.';
comment on function public.list_published_lineups_by_winrate is
  '공개 라인업을 승률 위주로 정렬 (5경기 가중). 본인 도전 매치만 집계.';
