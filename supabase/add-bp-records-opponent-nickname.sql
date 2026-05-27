-- BallPlay — bp_records에 상대 닉네임 스냅샷 컬럼 추가 + mirror 트리거 갱신.
--
-- 의미:
--   opponent_nickname = 이 row의 owner 입장에서 "상대" 닉네임 (경기 당시 스냅샷).
--   - 도전자가 INSERT할 때: 클라이언트가 공개 라인업 owner 닉네임을 넣음.
--   - mirror row: 트리거가 INSERT한 사람(NEW.owner_user_id) 닉네임을 profiles에서 lookup.
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

-- ============================================================
-- 1. 컬럼 추가
-- ============================================================
alter table public.bp_records
  add column if not exists opponent_nickname text;

comment on column public.bp_records.opponent_nickname is
  '기록 owner 입장 상대 닉네임 스냅샷. mirror row는 트리거가 도전자 profiles.nickname으로 채움.';

-- ============================================================
-- 2. mirror 함수 — opponent_nickname 포함
-- ============================================================
create or replace function public.bp_records_mirror_for_opponent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opp_owner_id uuid;
  opp_lineup_id uuid;
  mirror_opponent_nickname text;
begin
  if NEW.source not in ('public', 'friend') then
    return NEW;
  end if;

  if coalesce(current_setting('bp.mirror_in_progress', true), '') = 'true' then
    return NEW;
  end if;

  if NEW.source = 'public' then
    if NEW.user_side = 'home' then
      opp_lineup_id := NEW.away_lineup_id;
    else
      opp_lineup_id := NEW.home_lineup_id;
    end if;
    if opp_lineup_id is null then
      return NEW;
    end if;
    select owner_user_id into opp_owner_id
    from public.bp_lineups
    where id = opp_lineup_id;
  else
    if NEW.bp_match_id is null then
      return NEW;
    end if;
    select case when NEW.user_side = 'home' then away_owner_id else home_owner_id end
    into opp_owner_id
    from public.bp_matches
    where id = NEW.bp_match_id;
  end if;

  if opp_owner_id is null or opp_owner_id = NEW.owner_user_id then
    return NEW;
  end if;

  if exists (
    select 1 from public.bp_records
    where owner_user_id = opp_owner_id
      and source = NEW.source
      and seed = NEW.seed
      and created_at >= NEW.created_at - interval '5 minutes'
  ) then
    return NEW;
  end if;

  -- mirror row의 상대 = 지금 INSERT한 사람(도전자/먼저 저장한 쪽)
  select nullif(trim(p.nickname), '')
  into mirror_opponent_nickname
  from public.profiles p
  where p.id = NEW.owner_user_id;

  if mirror_opponent_nickname is null then
    mirror_opponent_nickname := '익명';
  end if;

  perform set_config('bp.mirror_in_progress', 'true', true);

  insert into public.bp_records (
    owner_user_id, source, bp_match_id, user_side,
    engine_version, seed, input, result,
    home_team_id, away_team_id, home_label, away_label,
    final_score, mvp_player_id, mvp_name, is_walkoff, total_innings,
    name, home_lineup_id, away_lineup_id, opponent_nickname
  ) values (
    opp_owner_id, NEW.source, NEW.bp_match_id,
    case when NEW.user_side = 'home' then 'away' else 'home' end,
    NEW.engine_version, NEW.seed, NEW.input, NEW.result,
    NEW.home_team_id, NEW.away_team_id, NEW.home_label, NEW.away_label,
    NEW.final_score, NEW.mvp_player_id, NEW.mvp_name, NEW.is_walkoff, NEW.total_innings,
    NEW.name, NEW.home_lineup_id, NEW.away_lineup_id, mirror_opponent_nickname
  );

  perform set_config('bp.mirror_in_progress', 'false', true);

  return NEW;
end;
$$;

drop trigger if exists bp_records_mirror_trigger on public.bp_records;
create trigger bp_records_mirror_trigger
  after insert on public.bp_records
  for each row execute function public.bp_records_mirror_for_opponent();

-- ============================================================
-- 확인용 (선택)
-- ============================================================
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'bp_records' and column_name = 'opponent_nickname';
--
-- select created_at, owner_user_id, user_side, opponent_nickname, home_label, away_label
-- from public.bp_records
-- order by created_at desc
-- limit 10;
