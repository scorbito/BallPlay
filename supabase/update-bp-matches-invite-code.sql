-- BallPlay friend match invite_code — 6자 영숫자 → 4자 숫자로 단순화.
--
-- 4자리 숫자 = 0000~9999 (10,000 코드). 친구한테 불러주기 쉬움.
-- bp_matches.invite_code의 unique 제약 그대로 유지 — 평생 누적 10,000개 매치 한도.
-- 한도 도달 시 partial unique index로 마이그레이션 (종료된 매치 코드 재사용 허용).

create or replace function public.generate_bp_match_invite_code()
returns text language plpgsql as $$
declare
  candidate text;
  exists_count int;
begin
  for attempt in 1..20 loop
    -- 0000~9999 4자리 zero-pad
    candidate := lpad(floor(random() * 10000)::int::text, 4, '0');

    select count(*) into exists_count
      from public.bp_matches
      where invite_code = candidate;

    if exists_count = 0 then
      return candidate;
    end if;
  end loop;

  -- 20회 시도 후에도 충돌 — 사실상 발생 안 함. 마지막 candidate 반환 (unique 제약이 거부하면 client retry).
  return candidate;
end;
$$;
