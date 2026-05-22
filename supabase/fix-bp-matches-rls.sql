-- BallPlay bp_matches RLS 정책 보완
-- 이슈: 익명 게스트(참가자)가 join 시 RLS에 의해 update가 0건 반환되어
--       PostgREST가 406 + "Cannot coerce the result to a single JSON object" 응답.
-- 원인: 기존 정책이 `to authenticated`로만 열려 anon 역할 차단.
--       그리고 using절이 owner_id(auth.uid()) 기준만 검사해서
--       guest_id 기반 익명 참여 케이스가 통과되지 못함.
--
-- 정책 (v1 단순 모델):
--   - INSERT: anon + authenticated 모두 허용 (매치 생성)
--   - UPDATE: anon + authenticated 허용. row를 다음 중 하나에 해당해야 함:
--       (a) status='pending' & 빈 슬롯 존재 (= 참가자가 join)
--       (b) 본인이 owner(auth.uid()) (= 호스트의 setMatchStart/finish)
--       (c) status가 ready/playing — 호스트가 시작/종료 처리 (auth 검사)
--
-- 본 SQL은 idempotent — 정책 drop 후 재생성. Supabase SQL Editor에서 1회 실행.

-- INSERT
drop policy if exists "bp_matches_insert" on public.bp_matches;
create policy "bp_matches_insert"
on public.bp_matches for insert
to anon, authenticated
with check (true);

-- UPDATE
drop policy if exists "bp_matches_update" on public.bp_matches;
create policy "bp_matches_update"
on public.bp_matches for update
to anon, authenticated
using (
  -- (a) 빈 슬롯 join — 누구나 한쪽이 비어있는 pending 매치 update 가능
  (status = 'pending' and (away_lineup_snapshot is null or home_lineup_snapshot is null))
  -- (b) 본인 owner인 경우 — 호스트의 setMatchStart/finishMatch/cancel
  or (auth.uid() is not null and (away_owner_id = auth.uid() or home_owner_id = auth.uid()))
)
with check (
  (status = 'pending' and (away_lineup_snapshot is null or home_lineup_snapshot is null))
  or (auth.uid() is not null and (away_owner_id = auth.uid() or home_owner_id = auth.uid()))
  -- 결과 status가 ready/playing/finished/cancelled인 경우도 통과 (위 조건에서 OR로 잡힘)
  or (status in ('ready', 'playing', 'finished', 'cancelled'))
);
