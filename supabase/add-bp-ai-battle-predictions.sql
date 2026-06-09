-- BallPlay bp_ai_battle_predictions — AI 편파 승리회로 배틀 예측 데이터 테이블
--
-- 흐름:
--   1. AI 에이전트가 각 경기에 대해 홈팀 승리 시나리오, 원정팀 승리 시나리오를 각각 생성하여 저장
--   2. published_at <= now() 인 row 만 클라이언트가 select 가능 (09:00 KST 자동 공개)
--   3. 경기 종료 후 sync-kbo-games 또는 뷰 조인을 통해 실제 결과와 매칭해 채점
--
-- 정책:
--   - (game_id, target_side, ai_provider) unique — 한 경기 × 한 진영(home/away) × 한 AI = 1행
--   - SELECT: published_at <= now() 일 때 공개
--   - INSERT/UPDATE/DELETE: service_role 만 쓰기 가능
--

create table if not exists public.bp_ai_battle_predictions (
  id uuid primary key default gen_random_uuid(),

  -- 경기 정보
  game_id uuid not null references public.games(id) on delete cascade,
  game_date date not null,

  -- 편파 대상 진영 및 AI 프로바이더
  target_side text not null check (target_side in ('home', 'away')),
  ai_provider text not null check (ai_provider in ('gemini', 'claude', 'gpt')),
  model_name text,

  -- 수호(지지)하는 팀
  predicted_winner_team_id text not null references public.teams(id),

  -- 편파적인 분석 요소
  key_factor text not null,        -- 핵심 요인 요약 (예: '선발 매치업', '최근 타격감' 등)
  one_liner text not null,         -- 카드 노출용 편파 행복회로 요약
  detailed_analysis text not null, -- 상세 승리 시나리오
  counter_argument text not null,  -- 상대방 강점에 대한 반박 논리 (약점 찌르기)

  -- 공개 및 채점
  published_at timestamptz not null,
  is_correct boolean,              -- 실제 경기 결과와 비교해서 채점 (무승부는 false)

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- 유니크 제약
  unique (game_id, target_side, ai_provider)
);

-- ============================================================
-- 인덱스
-- ============================================================
create index if not exists bp_ai_battle_predictions_date_pub_idx
  on public.bp_ai_battle_predictions (game_date desc, published_at);

create index if not exists bp_ai_battle_predictions_game_id_idx
  on public.bp_ai_battle_predictions (game_id);

-- ============================================================
-- updated_at 자동 갱신
-- ============================================================
create or replace function public.bp_ai_battle_predictions_set_updated_at()
returns trigger language plpgsql as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;

drop trigger if exists bp_ai_battle_predictions_updated_at on public.bp_ai_battle_predictions;
create trigger bp_ai_battle_predictions_updated_at
  before update on public.bp_ai_battle_predictions
  for each row execute function public.bp_ai_battle_predictions_set_updated_at();

-- ============================================================
-- RLS 설정
-- ============================================================
alter table public.bp_ai_battle_predictions enable row level security;

drop policy if exists "bp_ai_battle_predictions_read_published" on public.bp_ai_battle_predictions;
create policy "bp_ai_battle_predictions_read_published"
on public.bp_ai_battle_predictions for select
to anon, authenticated
using (published_at <= now());

comment on table public.bp_ai_battle_predictions is
  'AI 편파 승리회로 배틀 예측 데이터. 홈/원정팀 편파 분석 시나리오와 상대팀 반박 논리를 포함합니다.';
