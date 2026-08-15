-- 라인업 예측에 수비 위치 보너스 점수 추가.
--
-- 타순(적중·타순정확)이 메인 지표이고 수비는 덤이다. 지명타자나 좌익/우익 같은 자리는
-- 감독이 상대 선발에 따라 수시로 바꿔 맞히기가 매우 어렵기 때문에 별도 지표로 둔다.
--
-- 이미 채점된 과거 행은 null 로 남는다(그때는 수비를 세지 않았다). 화면에서는
-- null 이면 수비 항목을 감춘다.

alter table public.bp_lineup_predictions
  add column if not exists position_count smallint;

comment on column public.bp_lineup_predictions.position_count is
  '수비 위치까지 맞은 수(0~9). 보너스 지표이며 타순 채점과 독립적이다.';
