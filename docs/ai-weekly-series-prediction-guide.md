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

## AI 제공자별 입력 책임

각 에이전트는 자신에게 배정된 `ai_provider` row만 입력하거나 수정해야 한다.

- GPT 작업자는 `ai_provider = 'gpt'` row만 insert/upsert/update한다.
- Gemini 작업자는 `ai_provider = 'gemini'` row만 insert/upsert/update한다.
- Claude 작업자는 `ai_provider = 'claude'` row만 insert/upsert/update한다.
- 어떤 경우에도 다른 에이전트의 `ai_provider` row를 함께 입력하거나 덮어쓰면 안 된다.
- 여러 AI 예측을 한 번에 담은 JSON을 사용하더라도, 실제 DB 입력 단계에서는 반드시 자신의 `ai_provider`만 필터링해서 저장한다.
- `bp_ai_weekly_series` 시리즈 기본 정보는 공통으로 upsert할 수 있지만, `headline`은 GPT가 작성한 값을 기준으로 유지하고 `bp_ai_weekly_series_predictions`는 본인 provider row만 갱신한다.
- 다른 에이전트 예측이 비어 있거나 오래된 값처럼 보여도 임의로 생성, 수정, 삭제하지 않는다.

이 규칙을 어기면 다른 에이전트의 예측이 잘못 덮어써져 화면에 다른 내용이 노출될 수 있다.

## 시리즈 제목 작성 책임

`bp_ai_weekly_series.headline`은 화면의 시리즈 카드에 표시되는 제목 문구이며, GPT 작업자가 작성한다.

- GPT 작업자는 주간 시리즈 입력 시 각 시리즈의 `headline`을 직접 작성하고 DB에 반영한다.
- Gemini, Claude 등 다른 에이전트는 기존 `headline`을 새 문구로 덮어쓰면 안 된다.
- 다른 에이전트가 `bp_ai_weekly_series`를 upsert해야 할 때는 기존 `headline`을 유지하거나, 이미 저장된 값을 그대로 재사용한다.
- `headline`이 비어 있거나 수정이 필요하면 GPT 작업자에게 다시 작성하도록 요청한다.
- `headline`에는 AI 이름, DB, 스냅샷, 입력 데이터 같은 내부 작업 표현을 쓰지 않는다.
- `headline`은 1문장으로 쓰고, 선발 매치업/타선 흐름/순위 경쟁/분위기 같은 실제 경기 관전 포인트가 드러나게 작성한다.

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
2. 생성된 `series_id`를 기준으로 `bp_ai_weekly_series_predictions`에 자신의 `ai_provider` 예측만 넣는다.
3. 화면에 노출하려면 `bp_ai_weekly_series.published_at`이 현재 시간보다 과거여야 한다.

주의:

- 한 에이전트가 `gpt`, `gemini`, `claude` 예측 3개를 한 번에 입력하면 안 된다.
- upsert 충돌 기준은 `series_id, ai_provider`를 사용하되, payload의 `ai_provider`는 반드시 현재 작업자에게 배정된 값 하나로 고정한다.
- 입력 후에는 해당 provider row 수와 모델명, 예측 내용만 검증한다. 다른 provider row는 존재 여부만 확인하고 값을 바꾸지 않는다.

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
- `one_liner`는 화면 카드에 보이는 시리즈 예측 요약이다.
- `one_liner`는 2문장으로 작성해 화면에서 2줄 정도로 보이게 한다.
- `one_liner` 첫 문장은 핵심 선발/타선/흐름 근거를 말하고, 두 번째 문장은 예측 승자와 시리즈 흐름을 쉽게 설명한다.
- `one_liner`는 3문장 이상으로 길게 쓰지 않는다.
- `detailed_analysis`는 펼쳐보기 영역에 들어가는 상세 설명이다.
- `key_factor`는 `선발 안정감`, `불펜 우위`, `타선 흐름`처럼 짧게 쓴다.
- `confidence`는 0.50 이상 1.00 이하로 넣는다.
- 확정적인 표현보다 예측형 표현을 사용한다.

## 선발 로테이션 분석 기준

주간 시리즈 예측은 반드시 선발투수 로테이션을 먼저 분석한 뒤 작성한다.

분석 순서:

1. 이번 주 각 날짜별 예상 선발투수를 먼저 정리한다.
2. 공식 예고 선발이 있으면 공식 예고를 우선한다.
3. 공식 예고 전이면 최근 등판일, 휴식일, 시즌 선발 등판 흐름, 1군 엔트리 변동, 우천취소, 부상/휴식/관리 기사, 감독 코멘트를 함께 확인해 예상 선발을 만든다.
4. 지난주에 대체선발이 나왔으면 그 원인을 반드시 분석한다.
5. 대체선발 원인이 해소됐는지 확인해 이번 주에 정상 로테이션 투수가 복귀할지, 대체선발이 계속 나올지 판단한다.
6. 선발투수 예측을 완료한 뒤 그 매치업을 기반으로 시리즈 승자, 예상 승패, `key_factor`, `one_liner`, `detailed_analysis`를 작성한다.

대체선발 분석 기준:

- 부상, 1군 말소, 휴식, 구위 저하, 관리형 6선발, 우천취소, 더블헤더/연전 부담을 구분한다.
- 단순히 지난주 실제 등판 순서를 다음 주에 그대로 적용하지 않는다.
- 정상 로테이션 투수의 복귀 가능성이 있으면 기사, 엔트리, 최근 등판 간격을 확인해 반영한다.
- 우천취소로 등판하지 못한 투수는 다음 시리즈 재활용 가능성을 따로 판단한다.
- 5선발 경쟁, 6선발 운영, 임시 대체선발은 서로 다르게 본다.
- 변동 가능성이 큰 경기는 `detailed_analysis`에 자연스럽게 위험 요인으로 언급하되, 확정 선발처럼 단정하지 않는다.

주간 시리즈 예측에서 선발 분석은 타선, 불펜, 홈/원정, 최근 흐름보다 먼저 확인해야 하는 핵심 전제다.

## 추천 문장 톤

좋은 예:

- `두산은 선발 매치업에서 계산이 더 서고, 중심 타선도 득점권에서 버틸 힘이 있습니다. 롯데가 초반에 흔들면 접전이 될 수 있지만, 전체 흐름은 두산 2승 1패 쪽으로 봅니다.`
- `롯데는 김진욱 카드로 첫 경기 흐름을 잡을 수 있고, SSG는 중심 타선의 한 방이 변수입니다. 선발 불안이 이어지면 롯데가 문학에서 2승 1패를 만들 가능성이 있습니다.`
- `불펜 소모까지 고려하면 주말로 갈수록 한화 쪽 기대값이 높아집니다. 선발이 초반 실점을 막아주면 한화가 후반 한 번의 장타로 시리즈를 가져갈 수 있습니다.`

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
- 각 시리즈의 날짜별 예상 선발투수를 먼저 정리했는지 확인한다.
- 지난주 대체선발이 있었다면 원인과 이번 주 지속/복귀 가능성을 확인했는지 점검한다.
- 우천취소, 1군 말소, 부상, 휴식, 관리형 6선발 운영 여부를 선발 예측에 반영했는지 확인한다.
- 각 시리즈에 `gpt`, `gemini`, `claude` 예측이 모두 있는지 확인한다.
- 현재 작업자가 자신의 `ai_provider` row만 insert/upsert/update했는지 확인한다.
- 다른 에이전트의 `ai_provider` row를 함께 입력하거나 덮어쓰는 루프, JSON 전체 입력, 다중 provider upsert가 없는지 확인한다.
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
