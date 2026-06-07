-- BallPlay bp_ai_weekly_series / bp_ai_weekly_series_predictions
-- 월요일용 "이번 주 AI 시리즈 예측" 표준 테이블.
--
-- 목적:
--   - 일일 AI 승리팀 예측(bp_ai_predictions)은 game_id 1경기 단위.
--   - 주간 예측은 2~3연전 "시리즈" 단위라 별도 테이블로 분리한다.
--   - 다른 AI(GPT/Gemini/Claude)가 같은 series_id에 각 1개 예측 row를 입력한다.
--
-- 실행:
--   Supabase SQL Editor에서 1회 실행. idempotent.

create table if not exists public.bp_ai_weekly_series (
  id uuid primary key default gen_random_uuid(),

  -- ISO week의 월요일. 예: 2026-06-08
  week_start_date date not null,

  -- 주중/주말 구분. 화면에서는 주중 5개, 주말 5개 섹션으로 사용.
  series_group text not null
    check (series_group in ('early', 'weekend')),

  -- 시리즈 기간. 보통 화-목, 금-일.
  series_start_date date not null,
  series_end_date date not null,

  -- 시리즈 매치업. home/away는 공식 일정의 첫 경기 기준 또는 운영자가 정한 표기 기준.
  home_team_id text not null references public.teams(id),
  away_team_id text not null references public.teams(id),

  -- 포함 경기 id 목록. 일정 변경/우천취소 대응을 위해 jsonb로 둔다.
  -- 예: ["uuid1", "uuid2", "uuid3"]
  game_ids jsonb not null default '[]'::jsonb,

  -- 카드 상단/상세에 표시할 운영 문구.
  label text not null default '3연전',
  headline text not null,

  -- 운영 상태.
  status text not null default 'scheduled'
    check (status in ('scheduled', 'in_progress', 'finished', 'canceled')),

  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bp_ai_weekly_series_team_check check (home_team_id <> away_team_id),
  constraint bp_ai_weekly_series_date_check check (series_start_date <= series_end_date),
  unique (week_start_date, series_group, home_team_id, away_team_id)
);

create index if not exists bp_ai_weekly_series_week_idx
  on public.bp_ai_weekly_series (week_start_date desc, series_group, series_start_date);

create index if not exists bp_ai_weekly_series_published_idx
  on public.bp_ai_weekly_series (published_at desc);

create table if not exists public.bp_ai_weekly_series_predictions (
  id uuid primary key default gen_random_uuid(),

  series_id uuid not null references public.bp_ai_weekly_series(id) on delete cascade,
  week_start_date date not null,

  ai_provider text not null
    check (ai_provider in ('gpt', 'gemini', 'claude')),
  model_name text,

  -- 예측 우세 팀.
  predicted_winner_team_id text not null references public.teams(id),

  -- 사람이 읽는 결과 라벨.
  -- 권장값: sweep_win, winning, split, losing, sweep_loss
  predicted_result text not null
    check (predicted_result in ('sweep_win', 'winning', 'split', 'losing', 'sweep_loss')),

  -- 예상 승패. 3연전이면 2-1, 3-0 등. 2연전이면 1-1, 2-0 등도 가능.
  predicted_wins int not null check (predicted_wins >= 0 and predicted_wins <= 3),
  predicted_losses int not null check (predicted_losses >= 0 and predicted_losses <= 3),

  confidence numeric not null check (confidence >= 0.5 and confidence <= 1.0),

  -- 목록 카드용 짧은 키워드와 상세 페이지용 문장.
  key_factor text not null,
  one_liner text not null,
  detailed_analysis text not null,

  -- 시리즈 종료 후 채점. MVP에서는 null 유지 가능.
  is_correct boolean,
  actual_winner_team_id text references public.teams(id),
  actual_home_wins int check (actual_home_wins is null or actual_home_wins >= 0),
  actual_away_wins int check (actual_away_wins is null or actual_away_wins >= 0),

  published_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (series_id, ai_provider)
);

create index if not exists bp_ai_weekly_series_predictions_week_idx
  on public.bp_ai_weekly_series_predictions (week_start_date desc, ai_provider);

create index if not exists bp_ai_weekly_series_predictions_series_idx
  on public.bp_ai_weekly_series_predictions (series_id);

create or replace function public.bp_ai_weekly_series_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bp_ai_weekly_series_touch on public.bp_ai_weekly_series;
create trigger bp_ai_weekly_series_touch
  before update on public.bp_ai_weekly_series
  for each row execute function public.bp_ai_weekly_series_touch_updated_at();

drop trigger if exists bp_ai_weekly_series_predictions_touch on public.bp_ai_weekly_series_predictions;
create trigger bp_ai_weekly_series_predictions_touch
  before update on public.bp_ai_weekly_series_predictions
  for each row execute function public.bp_ai_weekly_series_touch_updated_at();

alter table public.bp_ai_weekly_series enable row level security;
alter table public.bp_ai_weekly_series_predictions enable row level security;

drop policy if exists "bp_ai_weekly_series_read_published" on public.bp_ai_weekly_series;
create policy "bp_ai_weekly_series_read_published"
on public.bp_ai_weekly_series for select
to anon, authenticated
using (published_at <= now());

drop policy if exists "bp_ai_weekly_series_predictions_read_published" on public.bp_ai_weekly_series_predictions;
create policy "bp_ai_weekly_series_predictions_read_published"
on public.bp_ai_weekly_series_predictions for select
to anon, authenticated
using (
  published_at <= now()
  and exists (
    select 1
    from public.bp_ai_weekly_series s
    where s.id = series_id
      and s.published_at <= now()
  )
);

-- INSERT/UPDATE/DELETE 정책 없음: service_role 또는 운영자 서버 작업만 작성.

comment on table public.bp_ai_weekly_series is
  '월요일 주간 시리즈 AI 예측의 시리즈 단위 메타 테이블. week_start_date + series_group 기준 조회.';

comment on table public.bp_ai_weekly_series_predictions is
  '월요일 주간 시리즈 AI 예측. series_id당 AI provider 1개 row.';
