# AI 주간 시리즈 예측 데이터 입력 매뉴얼

## 목적

월요일에는 일일 경기 예측 대신 이번 주 시리즈 예측을 보여준다.

- 초반 시리즈: 화요일-목요일
- 주말 시리즈: 금요일-일요일
- 한 주 기준 최대 10개 시리즈
- 각 시리즈마다 GPT, Gemini, Claude가 각각 예측 1개씩 작성

이 문서는 다른 AI 또는 운영자가 같은 DB 표준으로 주간 예측 데이터를 넣기 위한 기준이다.

## 관련 SQL

테이블 생성 SQL:

- `supabase/add-bp-ai-weekly-series-predictions.sql`

주요 테이블:

- `bp_ai_weekly_series`: 이번 주 시리즈 기본 정보
- `bp_ai_weekly_series_predictions`: 시리즈별 AI 예측 상세

## 날짜 기준

`week_start_date`는 한국시간 기준 월요일 날짜를 사용한다.

예시:

- 2026년 6월 8일 월요일 주간 예측: `2026-06-08`
- 화-목 시리즈도 `week_start_date = '2026-06-08'`
- 금-일 시리즈도 `week_start_date = '2026-06-08'`

## 시리즈 그룹

`series_group`은 아래 값만 사용한다.

| 값 | 의미 |
| --- | --- |
| `early` | 주중 초반 시리즈, 보통 화-목 |
| `weekend` | 주말 시리즈, 보통 금-일 |

## AI 제공자

`ai_provider`는 아래 값만 사용한다.

| 값 | 화면 표시 |
| --- | --- |
| `gpt` | GPT |
| `gemini` | Gemini |
| `claude` | Claude |

한 시리즈에는 AI별로 1개씩, 총 3개의 예측을 넣는다.

## 예측 결과 코드

`predicted_result`는 아래 값만 사용한다.

| 값 | 의미 | 예시 문구 |
| --- | --- | --- |
| `sweep_win` | 예측 팀 스윕승 | 두산 스윕승 |
| `winning` | 예측 팀 위닝 시리즈 | 두산 위닝 |
| `split` | 균형 또는 동률 성격 | 팽팽한 시리즈 |
| `losing` | 예측 팀 루징 시리즈 | 두산 루징 |
| `sweep_loss` | 예측 팀 스윕패 | 두산 스윕패 |

일반적인 3연전에서는 `winning`을 가장 많이 사용한다.

## 입력 순서

1. `bp_ai_weekly_series`에 시리즈 정보를 먼저 넣는다.
2. 생성된 `series_id`를 기준으로 `bp_ai_weekly_series_predictions`에 AI 예측 3개를 넣는다.
3. 화면에 노출하려면 `bp_ai_weekly_series.published_at`이 현재 시간보다 과거여야 한다.

## 시리즈 입력 기준

`bp_ai_weekly_series`에는 실제 일정 기준으로 하나의 맞대결을 하나의 row로 넣는다.

필수 입력:

- `week_start_date`
- `series_group`
- `series_start_date`
- `series_end_date`
- `home_team_id`
- `away_team_id`
- `headline`
- `published_at`

권장 입력:

- `game_ids`: 해당 시리즈에 포함된 실제 경기 ID 배열
- `label`: `3연전`, `2연전` 등

`home_team_id`와 `away_team_id`는 서로 달라야 한다.

## AI 예측 작성 기준

`bp_ai_weekly_series_predictions`에는 AI별 예측을 넣는다.

필수 입력:

- `series_id`
- `week_start_date`
- `ai_provider`
- `predicted_winner_team_id`
- `predicted_result`
- `predicted_wins`
- `predicted_losses`
- `confidence`
- `key_factor`
- `one_liner`
- `detailed_analysis`

작성 기준:

- `predicted_winner_team_id`는 해당 시리즈의 두 팀 중 하나여야 한다.
- `one_liner`는 화면 카드에 보이는 짧은 한 줄 설명이다.
- `detailed_analysis`는 펼쳐보기 영역에 들어가는 상세 설명이다.
- `key_factor`는 `선발 안정감`, `불펜 우위`, `타선 흐름`처럼 짧게 쓴다.
- `confidence`는 0.50 이상 1.00 이하로 넣는다.
- 확정적인 표현보다 예측형 표현을 사용한다.

## 추천 문장 톤

좋은 예:

- `두산은 선발 매치업에서 계산이 더 서는 시리즈입니다.`
- `롯데 타선이 초반에 살아나면 예상보다 접전이 될 수 있습니다.`
- `불펜 소모까지 고려하면 주말로 갈수록 한화 쪽 기대값이 높습니다.`

피해야 할 예:

- `무조건 이깁니다.`
- `100% 확정입니다.`
- 근거 없이 단정하는 문장

## 입력 예시

```sql
with upserted_series as (
  insert into public.bp_ai_weekly_series (
    week_start_date,
    series_group,
    series_start_date,
    series_end_date,
    home_team_id,
    away_team_id,
    game_ids,
    label,
    headline,
    published_at
  )
  values (
    '2026-06-08',
    'early',
    '2026-06-09',
    '2026-06-11',
    'doosan',
    'lotte',
    '["game_id_1", "game_id_2", "game_id_3"]'::jsonb,
    '3연전',
    '두산 선발진과 롯데 타선 흐름이 맞붙는 주중 시리즈입니다.',
    now()
  )
  on conflict (week_start_date, series_group, home_team_id, away_team_id)
  do update set
    series_start_date = excluded.series_start_date,
    series_end_date = excluded.series_end_date,
    game_ids = excluded.game_ids,
    label = excluded.label,
    headline = excluded.headline,
    published_at = excluded.published_at
  returning id
)
insert into public.bp_ai_weekly_series_predictions (
  series_id,
  week_start_date,
  ai_provider,
  model_name,
  predicted_winner_team_id,
  predicted_result,
  predicted_wins,
  predicted_losses,
  confidence,
  key_factor,
  one_liner,
  detailed_analysis
)
select
  id,
  '2026-06-08',
  'gpt',
  'gpt-5',
  'doosan',
  'winning',
  2,
  1,
  0.64,
  '선발 안정감',
  '두산은 선발 매치업에서 계산이 더 서는 시리즈입니다.',
  '두산은 선발진의 이닝 소화 기대치가 높고, 초반 실점을 줄일 가능성이 있습니다. 롯데는 타선 흐름이 살아나면 충분히 접전을 만들 수 있지만, 불펜으로 넘어가는 시점에서 변수가 큽니다. 전체적으로는 두산의 2승 1패 가능성을 더 높게 봅니다.'
from upserted_series
on conflict (series_id, ai_provider)
do update set
  model_name = excluded.model_name,
  predicted_winner_team_id = excluded.predicted_winner_team_id,
  predicted_result = excluded.predicted_result,
  predicted_wins = excluded.predicted_wins,
  predicted_losses = excluded.predicted_losses,
  confidence = excluded.confidence,
  key_factor = excluded.key_factor,
  one_liner = excluded.one_liner,
  detailed_analysis = excluded.detailed_analysis;
```

## 다른 AI에게 요청할 입력 포맷

다른 AI에게는 아래 JSON 형식으로 결과를 달라고 요청하면 된다.

```json
{
  "week_start_date": "2026-06-08",
  "series": [
    {
      "series_group": "early",
      "series_start_date": "2026-06-09",
      "series_end_date": "2026-06-11",
      "home_team_id": "doosan",
      "away_team_id": "lotte",
      "label": "3연전",
      "headline": "두산 선발진과 롯데 타선 흐름이 맞붙는 주중 시리즈입니다.",
      "predictions": [
        {
          "ai_provider": "gpt",
          "model_name": "gpt-5",
          "predicted_winner_team_id": "doosan",
          "predicted_result": "winning",
          "predicted_wins": 2,
          "predicted_losses": 1,
          "confidence": 0.64,
          "key_factor": "선발 안정감",
          "one_liner": "두산은 선발 매치업에서 계산이 더 서는 시리즈입니다.",
          "detailed_analysis": "두산은 선발진의 이닝 소화 기대치가 높고..."
        }
      ]
    }
  ]
}
```

## 검수 체크리스트

입력 전에 아래를 확인한다.

- 한 주에 `early` 5개, `weekend` 5개 시리즈가 있는지 확인한다.
- 각 시리즈에 `gpt`, `gemini`, `claude` 예측이 모두 있는지 확인한다.
- `predicted_winner_team_id`가 해당 시리즈의 두 팀 중 하나인지 확인한다.
- 3연전이면 `predicted_wins + predicted_losses = 3`인지 확인한다.
- `published_at`이 비어 있거나 미래 시간이면 화면에 노출되지 않는다.
- 같은 시리즈를 다시 넣을 때는 중복 insert가 아니라 upsert로 갱신한다.

## 화면 조회 예시

```sql
select
  s.id,
  s.week_start_date,
  s.series_group,
  s.series_start_date,
  s.series_end_date,
  s.home_team_id,
  s.away_team_id,
  s.label,
  s.headline,
  p.ai_provider,
  p.predicted_winner_team_id,
  p.predicted_result,
  p.predicted_wins,
  p.predicted_losses,
  p.confidence,
  p.key_factor,
  p.one_liner,
  p.detailed_analysis
from public.bp_ai_weekly_series s
left join public.bp_ai_weekly_series_predictions p
  on p.series_id = s.id
where s.week_start_date = '2026-06-08'
  and s.published_at <= now()
order by
  case s.series_group when 'early' then 1 else 2 end,
  s.series_start_date,
  s.created_at,
  case p.ai_provider
    when 'gpt' then 1
    when 'gemini' then 2
    when 'claude' then 3
    else 9
  end;
```

## 결과 채점 기준

시리즈가 끝난 뒤 실제 결과를 기록할 때는 아래 기준을 사용한다.

- 취소 경기는 승패 계산에서 제외한다.
- 실제 승수가 더 많은 팀을 `actual_winner_team_id`로 기록한다.
- AI의 `predicted_winner_team_id`와 `actual_winner_team_id`가 같으면 `is_correct = true`.
- 경기가 부족해서 판단하기 애매한 경우 `is_correct`는 `null`로 유지한다.

