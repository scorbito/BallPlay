-- BallPlay: 공개 라인업도 name 변경 허용 (2026-06-01)
--
-- 배경:
--   기존 트리거 bp_lineups_immutable_when_published 가 공개 상태일 때
--   name 변경을 차단해서, 다른 브라우저에서 rename 한 결과가 DB에 안 들어가는
--   현상이 있었음. 게다가 DB write가 silent fail 되어 사용자는 "동기화됨" 으로
--   잘못 안내받음.
--
-- 정책 변경:
--   name은 표시용 라벨일 뿐 매칭/공정성에 영향 없음 (lineup_hash는 batting/
--   pitching 만으로 계산). 공개 상태에서도 name 변경 허용.
--   batting/pitching/team_id 는 여전히 잠금 (도전 받는 라인업의 핵심).
--
-- 본 SQL 은 idempotent — Supabase SQL Editor 에서 1회 실행.

create or replace function public.bp_lineups_immutable_when_published()
returns trigger language plpgsql as $$
begin
  -- 공개 상태(true → true) 유지 중에는 핵심 필드 변경 차단.
  -- 공개 ↔ 비공개 전환은 허용 (lineup_hash, description 은 클라이언트에서 정리).
  -- name 은 표시용이라 허용 (2026-06-01 정책 변경).
  if OLD.is_published = true and NEW.is_published = true then
    if NEW.batting is distinct from OLD.batting
       or NEW.pitching is distinct from OLD.pitching
       or NEW.team_id is distinct from OLD.team_id then
      raise exception '공개 라인업의 라인업 구성은 수정할 수 없습니다. 비공개로 전환 후 수정하세요.';
    end if;
  end if;
  return NEW;
end;
$$;
