-- BallPlay — 공개 매치 & 친구 대전 결과를 양쪽 모두 저장.
-- 이전: 도전한 사용자만 bp_records에 INSERT → 라인업 owner는 자기 라인업 전적이 바뀌어도
--        어떤 매치였는지 못 봄.
-- 변경: 트리거로 상대방 owner_user_id의 mirror row 자동 INSERT.
--        owner는 들어와서 "전적이 달라졌네 → 누가 어떤 라인업으로 도전했는지" 확인 + 재생 가능.
--
-- 적용 범위:
--   - source='public': 도전자가 INSERT → 공개 라인업 owner도 mirror 저장
--   - source='friend': 매치 결과 화면 진입한 쪽이 INSERT → 상대(bp_match 기준)에게도 mirror 저장
--   - 그 외 source는 무시 (현재는 'public'/'friend'만 존재)
--
-- 재귀 방지: trigger 내부에서 INSERT 시 transaction-local session 변수로 가드.
-- 권한: SECURITY DEFINER로 RLS 우회 INSERT (상대 owner_user_id로 row 만드는 게 RLS에 막힘).
--
-- 본 SQL은 idempotent — Supabase SQL Editor에서 1회 실행.

create or replace function public.bp_records_mirror_for_opponent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  opp_owner_id uuid;
  opp_lineup_id uuid;
begin
  -- AI 등 다른 source는 mirror X
  if NEW.source not in ('public', 'friend') then
    return NEW;
  end if;

  -- 재귀 방지 — mirror INSERT가 또 trigger를 firing하는 걸 차단.
  -- transaction-local(is_local=true)이므로 다른 세션엔 영향 없음.
  if coalesce(current_setting('bp.mirror_in_progress', true), '') = 'true' then
    return NEW;
  end if;

  -- 상대 owner_user_id 식별
  if NEW.source = 'public' then
    -- 공개 매치: bp_lineups에서 owner lookup
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
    -- 친구 대전: bp_matches에서 상대 owner lookup
    if NEW.bp_match_id is null then
      return NEW;
    end if;
    select case when NEW.user_side = 'home' then away_owner_id else home_owner_id end
    into opp_owner_id
    from public.bp_matches
    where id = NEW.bp_match_id;
  end if;

  -- 상대가 없거나(라인업 삭제됨/익명 게스트만 join) 자기 자신이면 skip
  if opp_owner_id is null or opp_owner_id = NEW.owner_user_id then
    return NEW;
  end if;

  -- 이미 mirror가 만들어진 매치(seed + source + owner 조합)면 skip — 중복 안전장치.
  -- 5분 window는 같은 seed 우연 충돌 가능성 거의 0인 cushion.
  if exists (
    select 1 from public.bp_records
    where owner_user_id = opp_owner_id
      and source = NEW.source
      and seed = NEW.seed
      and created_at >= NEW.created_at - interval '5 minutes'
  ) then
    return NEW;
  end if;

  -- mirror INSERT 시작 — 재귀 가드 ON
  perform set_config('bp.mirror_in_progress', 'true', true);

  insert into public.bp_records (
    owner_user_id, source, bp_match_id, user_side,
    engine_version, seed, input, result,
    home_team_id, away_team_id, home_label, away_label,
    final_score, mvp_player_id, mvp_name, is_walkoff, total_innings,
    name, home_lineup_id, away_lineup_id
  ) values (
    opp_owner_id, NEW.source, NEW.bp_match_id,
    case when NEW.user_side = 'home' then 'away' else 'home' end,
    NEW.engine_version, NEW.seed, NEW.input, NEW.result,
    NEW.home_team_id, NEW.away_team_id, NEW.home_label, NEW.away_label,
    NEW.final_score, NEW.mvp_player_id, NEW.mvp_name, NEW.is_walkoff, NEW.total_innings,
    NEW.name, NEW.home_lineup_id, NEW.away_lineup_id
  );

  -- 가드 OFF
  perform set_config('bp.mirror_in_progress', 'false', true);

  return NEW;
end;
$$;

-- 트리거 재생성 (idempotent)
drop trigger if exists bp_records_mirror_trigger on public.bp_records;
create trigger bp_records_mirror_trigger
  after insert on public.bp_records
  for each row execute function public.bp_records_mirror_for_opponent();

-- ============================================================
-- 중복 row 정리 (unique index 생성 전 필수)
-- ============================================================
-- 과거 race condition / replay 버그로 같은 (owner, source, seed) 조합이 2번 이상
-- 저장된 row가 있을 수 있음. unique index 생성하려면 먼저 중복 제거.
-- 가장 오래된 row(원본) 1개만 남기고 나머지 삭제.
delete from public.bp_records
where id in (
  select id from (
    select id, row_number() over (
      partition by owner_user_id, source, seed
      order by created_at asc, id asc
    ) as rn
    from public.bp_records
    where source in ('public', 'friend')
  ) t
  where rn > 1
);

-- ============================================================
-- 중복 방지 unique index (owner + source + seed)
-- ============================================================
-- 친구 대전에서 양쪽 클라이언트가 동시에 ResultScreen 도달하는 race를 막음:
--   1. A가 자기 row INSERT → trigger가 B에게 mirror INSERT
--   2. B가 자기 row INSERT → trigger는 mirror skip (이미 있음)
--      하지만 B의 INSERT 자체는 통과 → B에게 row 2개 생김 (중복)
-- partial index로 같은 (owner, source, seed) 두 번째 INSERT를 23505로 거부.
-- seed는 53bit 난수라 다른 매치끼리 우연 충돌 가능성 사실상 0.
-- 클라이언트는 23505를 "이미 저장됨"으로 graceful 처리.
create unique index if not exists bp_records_owner_match_unique
  on public.bp_records (owner_user_id, source, seed)
  where source in ('public', 'friend');

-- ============================================================
-- 확인용 쿼리
-- ============================================================
-- 트리거 등록 확인:
-- select tgname, tgenabled, tgrelid::regclass
-- from pg_trigger
-- where tgname = 'bp_records_mirror_trigger';
--
-- 최근 매치 양쪽 row 짝 확인:
-- select created_at, owner_user_id, source, user_side, seed, final_score
-- from public.bp_records
-- order by created_at desc
-- limit 10;
