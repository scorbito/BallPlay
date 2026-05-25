-- BallPlay 예측 적중률 랭킹 RPC.
--
-- 정책:
--   - 기간: 'today' | 'week' | 'month' | 'season'(전체)
--   - 최소 경기 수 필터 (p_min_games) — 1경기 100% 적중자가 1등 되는 것 방지
--   - 채점된 예측(is_judged=true)만 집계
--   - 잠금된 예측(locked_at not null)만 집계 — draft 제외
--   - 익명 사용자도 포함 — 자동 닉네임 그대로 노출
--   - SECURITY DEFINER — RLS 우회해 전체 사용자 집계 가능. 노출되는 건 집계 지표 + 프로필 표시 필드만.
--
-- 본 SQL은 idempotent — 1회 실행.

create or replace function public.get_prediction_ranking(
  p_period text default 'season',
  p_min_games int default 5,
  p_limit int default 20
)
returns table (
  rank int,
  user_id uuid,
  nickname text,
  main_team_id text,
  avatar_image_url text,
  total int,
  correct int,
  rate numeric  -- 0.0 ~ 1.0 (소수점, 클라이언트에서 %로 변환)
)
language sql
stable
security definer
set search_path = public
as $$
  with date_range as (
    select
      case p_period
        when 'today' then (now() at time zone 'Asia/Seoul')::date
        when 'week'  then (now() at time zone 'Asia/Seoul')::date - interval '6 days'
        when 'month' then (now() at time zone 'Asia/Seoul')::date - interval '29 days'
        else null  -- season = 전체, 필터 없음
      end::date as from_date
  ),
  aggregated as (
    select
      r.user_id,
      count(*) filter (where r.is_judged) as total,
      count(*) filter (where r.is_correct = true) as correct
    from public.bp_prediction_results r, date_range dr
    where r.locked_at is not null
      and (dr.from_date is null or r.game_date >= dr.from_date)
    group by r.user_id
  ),
  filtered as (
    select
      a.user_id,
      a.total::int as total,
      a.correct::int as correct,
      (a.correct::numeric / nullif(a.total, 0)) as rate
    from aggregated a
    where a.total >= p_min_games
  ),
  ranked as (
    select
      row_number() over (order by f.rate desc nulls last, f.total desc, f.user_id asc)::int as rank,
      f.*
    from filtered f
  )
  select
    r.rank,
    r.user_id,
    p.nickname,
    p.main_team_id,
    p.avatar_image_url,
    r.total,
    r.correct,
    r.rate
  from ranked r
  left join public.profiles p on p.id = r.user_id
  order by r.rank
  limit p_limit;
$$;

comment on function public.get_prediction_ranking is
  '예측 적중률 랭킹. period: today/week/month/season. min_games 임계값 이상만, 채점된 예측만 집계.';

-- ============================================================
-- 권한 — 익명 포함 인증된 모든 사용자에게 실행 허용
-- ============================================================
grant execute on function public.get_prediction_ranking(text, int, int) to authenticated;
