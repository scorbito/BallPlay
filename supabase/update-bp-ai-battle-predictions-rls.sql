-- 1. 양팀 분석글(home/away)이 모두 등록되었는지 안전하게 확인하는 security definer 함수 생성
-- RLS 정책 내에서 동일 테이블을 직접 조회할 때 발생하는 infinite recursion(무한 재귀)을 방지합니다.
create or replace function public.bp_ai_battle_predictions_is_released(g_id uuid)
returns boolean security definer as $$
begin
  return exists (
    select 1 from public.bp_ai_battle_predictions
    where game_id = g_id and target_side = 'home'
  ) and exists (
    select 1 from public.bp_ai_battle_predictions
    where game_id = g_id and target_side = 'away'
  );
end;
$$ language plpgsql;

-- 2. 기존 시간(published_at) 기반 select 정책 제거
drop policy if exists "bp_ai_battle_predictions_read_published" on public.bp_ai_battle_predictions;

-- 3. 양팀 데이터가 모두 등록되었을 때만 일반 사용자가 조회할 수 있는 새 select 정책 적용
create policy "bp_ai_battle_predictions_read_published"
on public.bp_ai_battle_predictions for select
to anon, authenticated
using (
  public.bp_ai_battle_predictions_is_released(game_id)
);
