# AI 예측 기능 기획서

> 작성일: 2026-05-26
> 상태: 기획 초안 (구현 시작 전)
> 관련: [product-spec.md](product-spec.md) §11 v4+ "일일 승부 예측" 확장

---

## 1. 개요

오늘 KBO 경기에 대해 **3개의 최상위 AI 모델**(Claude Opus 4.7, GPT-5.5, Gemini 3.1 Pro)이 각각 독립적으로 분석·예측한 결과를 매일 자동 생성·표시한다.

사람이 직접 추측하는 기존 `bp_predictions` 게임과 **독립**된 정보 제공 콘텐츠.

### 핵심 가치
- **"3 AI 비교"** — 시장에 없는 차별적 콘텐츠
- 매일 새벽 자동 생성 → 운영 부담 0
- 사후 누적 적중률 통계 → SNS 공유 자산
- "Claude는 통계 위주, GPT는 객관적, Gemini는 균형" 같은 AI별 분석 스타일 차이가 콘텐츠 가치

---

## 2. 데이터 입력 — AI에게 무엇을 주는가

### 확보 가능 (✅)

| 데이터 | 출처 | 갱신 |
|---|---|---|
| **선발 투수** (★★★★★) | KBO 공식 (예고선발) | 일 1회 (오후 cron) |
| 양 팀 시즌 스탯 | Statiz | 주 1~2회 |
| 양 팀 최근 10경기 폼 | Statiz | 일 1회 (핵심 선수만) |
| 구장·홈/원정 | KBO 일정 | 자동 |
| 팀 타선 통계 (vs LHP/RHP, 좌우 비율) | 시즌 스탯에서 계산 | 자동 |

### 확보 불가 (❌)

| 데이터 | 영향 | 대응 |
|---|---|---|
| **타자 라인업** (경기 1~2시간 전 발표) | ~5~10% 손실 | 출장 빈도 상위 9명 = 예상 라인업 |
| 부상자 명단 | 미세 | v1.1+ |
| 뉴스·팀 분위기 | 미세 | v1.1+ |

→ 가장 중요한 변수 **선발 투수**가 확보되어 AI 예측 품질 80~90% 유지.

### 컨텍스트 빌더 — 경기당 입력 구조

```
[경기 정보]
- 일시·구장·홈팀·원정팀

[선발 투수] (양 팀 각각) ★★★★★
- 이름, ERA, WHIP, K/9, BB/9
- vs LHB / vs RHB OPS
- 최근 10경기 폼

[팀 타선 통계] (양 팀 각각) ★★★★
- 팀 OPS, vs LHP / vs RHP
- 홈런·도루·득점
- 좌타/우타 비율

[예상 라인업] (양 팀 각각) ★★★ — "예상" 라벨 명시
- 출장 빈도 Top 9명
- 각 선수의 핵심 스탯·핸드

[양 팀 최근 10경기] ★★★
- 승패, 평균 득점

[참고 메모 — AI에게 명시]
"타자 라인업은 경기 직전 발표라 수집 불가.
출장 빈도 상위 9명 기준 예상 라인업입니다.
선발 투수와 팀 통계는 정확합니다."
```

토큰 추정: 사용자 프롬프트 ~1.5~2K (시스템 프롬프트 캐싱 별도)

---

## 3. AI 모델 — 3사 병렬 호출

| 모델 | 1회 비용 | 월 (15회/일 × 30일) | 캐싱 적용 시 |
|---|---|---|---|
| **Claude Opus 4.7** ($5/$25) | ~$0.022 | ~$10 | ~$3 |
| **GPT-5.5** (추정 $1.25/$10) | ~$0.0075 | ~$3.4 | ~$2.5 |
| **Gemini 3.1 Pro** ($2/$12) | ~$0.010 | ~$4.5 | ~$3 |
| **합계** | | **~₩25,000/월** | **~₩11,000/월** |

**Provider 추상화: Vercel AI SDK** (`ai` 패키지 + `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`)

`Promise.allSettled` — 한 AI 실패해도 나머지로 진행.

---

## 4. 프롬프트 설계

### 시스템 프롬프트 (캐싱 대상, ~1500 토큰)

```
당신은 한국 프로야구 KBO를 깊이 이해하는 야구 분석가입니다.

[2026 시즌 컨텍스트]
- 10개 구단: 한화·LG·KT·SSG·NC·키움·삼성·롯데·KIA·두산
- 정규 시즌 144경기, 9이닝 + 무승부 12이닝
- 구장 특성: 잠실(투수 친화), 사직(타자 친화), 문학(중립) 등

[분석 원칙]
- 시즌 스탯과 최근 10경기 폼 모두 고려
- 선발 투수 매치업이 가장 큰 변수
- 라인업 좌우 상성, 구장 보정 반영
- 단기 변동성 인정, 확률 기반 합리적 판단

[출력 형식 — Zod schema로 강제]
다음 JSON 형식으로 응답:
{
  predicted_winner_team_id: enum,
  predicted_score: { home: int, away: int } | null,
  confidence: 0.50~1.00,
  one_liner: string (50자 이내, 카드 표시용),
  key_factor: enum(선발|타선|최근폼|구장|상성),
  detailed_analysis: string (200~300자, 펼침 표시용),
  factors: { pitcher_matchup, lineup_form, ballpark, recent_form } (각 한 줄, 옵션)
}
```

### 사용자 프롬프트 (경기별, ~800 토큰)

§2의 컨텍스트 빌더 출력을 그대로 전달.

---

## 5. 응답 스키마 (Zod)

```ts
import { z } from 'zod'

const TEAM_IDS = ['doosan','lg','kt','ssg','nc','kiwoom','samsung','lotte','kia','hanwha'] as const

const PredictionSchema = z.object({
  // 예측
  predicted_winner_team_id: z.enum(TEAM_IDS),
  predicted_score: z.object({
    home: z.number().int().min(0).max(30),
    away: z.number().int().min(0).max(30),
  }).nullable(),
  confidence: z.number().min(0.50).max(1.00),
  
  // 카드 표시 (항상)
  one_liner: z.string().max(60),
  key_factor: z.enum(['선발', '타선', '최근폼', '구장', '상성']),
  
  // 펼침 표시
  detailed_analysis: z.string().max(400),
  factors: z.object({
    pitcher_matchup: z.string().optional(),
    lineup_form: z.string().optional(),
    ballpark: z.string().optional(),
    recent_form: z.string().optional(),
  }).optional(),
})
```

---

## 6. DB 스키마

### 메인 테이블

```sql
create table bp_ai_predictions (
  id uuid primary key default gen_random_uuid(),
  
  -- 키
  game_id text not null,
  game_date date not null,
  ai_provider text not null,         -- 'anthropic-opus-4-7' / 'openai-gpt-5-5' / 'google-gemini-3-1-pro'
  model_version text not null,       -- 정확한 모델 ID (변경 추적)
  
  -- 예측 결과
  predicted_winner_team_id text not null,
  predicted_score_home int,
  predicted_score_away int,
  confidence numeric(3,2),
  
  -- 표시용
  one_liner text not null,
  key_factor text,
  detailed_analysis text,
  factors jsonb,
  
  -- 메타
  raw_response jsonb,                -- 디버깅·사후 분석
  input_tokens int,
  output_tokens int,
  cost_usd numeric(8,5),
  generated_at timestamptz default now(),
  
  -- 사후 채점
  is_correct boolean,                -- null = 미채점
  judged_at timestamptz,
  
  unique(game_id, ai_provider)       -- 한 경기당 AI별 1회만
);

create index on bp_ai_predictions (game_date desc, ai_provider);
create index on bp_ai_predictions (ai_provider, is_correct);

-- RLS
alter table bp_ai_predictions enable row level security;
create policy "bp_ai_predictions_read_all" on bp_ai_predictions
  for select to authenticated, anon using (true);
-- 쓰기는 service_role만 (cron job)
```

### 적중률 view

```sql
create view bp_ai_accuracy as
select
  ai_provider,
  count(*) filter (where is_correct is not null) as judged,
  count(*) filter (where is_correct = true) as correct,
  round(
    100.0 * count(*) filter (where is_correct = true)::numeric
    / nullif(count(*) filter (where is_correct is not null), 0),
    1
  ) as accuracy_pct
from bp_ai_predictions
group by ai_provider;
```

---

## 7. Cron 구조 — Vercel Cron 무료 tier

### Hobby plan 한도
**일 2회까지 무료** → v1엔 충분

### 새벽 6시 KST (`/api/cron/morning`)
1. 어제 경기 결과 fetch → `games` 테이블 갱신
2. AI 예측 채점 (어제 예측 vs 결과) — §9 참조
3. 최근 10경기 폼 갱신 (어제 출장 핵심 선수만 ~50명)
4. 오늘 경기 일정 fetch

### 오후 4시 KST (`/api/cron/afternoon`)
1. 오늘 선발 투수 fetch (예고선발 페이지)
2. 컨텍스트 빌더 실행 (양 팀 데이터 조립)
3. 3 AI 병렬 호출 → `bp_ai_predictions` 저장
4. 비용 추적 (월 hard cap 체크)

### `vercel.json`
```json
{
  "crons": [
    { "path": "/api/cron/morning", "schedule": "0 21 * * *" },
    { "path": "/api/cron/afternoon", "schedule": "0 7 * * *" }
  ]
}
```
UTC 기준: 새벽 6시 KST = 21:00 UTC 전날, 오후 4시 KST = 07:00 UTC

---

## 8. UI 설계

### 위치
**별도 "예측" 탭 또는 홈 카드** (현재 사람 예측 탭이 있으면 그쪽 확장).

### 카드 (접힘 상태)

```
┌─────────────────────────────────┐
│ 🤖 오늘의 AI 분석 (5/26)         │
│ 두산 vs LG · 18:30 잠실         │
├─────────────────────────────────┤
│ GPT-5.5       두산 5-3   65%   │
│ → 선발 김민우 좌타 상성         │
│ [▼ 자세히]                       │
│                                 │
│ Claude 4.7    LG 4-2     58%   │
│ → 타선 깊이 우위                │
│ [▼ 자세히]                       │
│                                 │
│ Gemini Pro    두산 6-4   72%   │
│ → 잠실 홈 + 최근 폼            │
│ [▼ 자세히]                       │
├─────────────────────────────────┤
│ 👤 내 예측: [두산] [LG]         │
└─────────────────────────────────┘
```

### 카드 (펼침 상태)

```
GPT-5.5      두산 5-3   65%
→ 선발 김민우 좌타 상성

두산 선발 김민우는 vs LHB OPS 0.680으로
좌타진 LG에 강하며, 잠실 구장은 투수 친화.
다만 LG 타선이 최근 5경기 OPS 0.790으로
폼이 올라와 1~3점 차 박빙 예상.

선발 매치업: 두산 우위
라인업 폼: LG 약간 우위
구장: 잠실 투수 친화
최근 폼: 두산 6승 4패, LG 5승 5패

[▲ 접기]
```

### 별도 페이지 "AI 적중률 랭킹"

```
이번 시즌 누적 (5월 1일~)
1위 Claude 4.7    62.3%  (213/342)
2위 GPT-5.5       59.6%  (204/342)
3위 Gemini Pro    54.7%  (187/342)
```

→ SNS 공유 가능한 자동 생성 카드 (Satori 활용).

---

## 9. 사후 채점 로직

```sql
-- /api/cron/morning 내부
update bp_ai_predictions p
set 
  is_correct = (p.predicted_winner_team_id = g.actual_winner_team_id),
  judged_at = now()
from games g
where g.id = p.game_id
  and g.status = 'finished'
  and p.is_correct is null
  and g.actual_winner_team_id is not null;
```

채점되면 `bp_ai_accuracy` view 자동 갱신.

---

## 10. 에러·운영 정책

| 항목 | 정책 |
|---|---|
| 한 AI 실패 | 나머지로 진행 (`Promise.allSettled`) |
| 타임아웃 | 각 호출 60초 |
| 재시도 | 1회 (실패 시 그날 그 AI 제외 — 통계 분모에서 차감) |
| 비용 hard cap | 월 ₩50,000 초과 시 cron 정지 + Slack 알림 |
| Schema 위반 응답 | `raw_response`에 보관 + Sentry 로깅, 그날 그 AI 예측 패스 |
| 모델 deprecation | `model_version`에 정확한 ID 박아둠 — 추후 마이그레이션 추적 |

---

## 11. 법적·UX 주의

[product-spec.md §9 법적 가이드](product-spec.md) 와 정합:

- **AI 예측은 정보 제공만**, 사용자 포인트 보상 없음 (사람 예측과 분리)
- 면책 문구 (예측 카드 하단 또는 상세 모달):
  > AI 분석은 정보 제공 목적이며, 실제 경기 결과를 보장하지 않습니다.
- "예측" 단어보다 **"AI 분석"** / **"AI 추측"** 톤 우선
- 베팅 사이트 연관·외부 링크 X
- 출처 표기:
  > 데이터: Statiz, KBO 공식 / 분석: OpenAI · Anthropic · Google

---

## 12. 데이터 갱신 전략 (요약)

| 데이터 | 갱신 주기 | 방법 |
|---|---|---|
| 시즌 누적 스탯 | 주 1~2회 | Statiz 수동/주간 sync (현행 유지) |
| **최근 10경기 폼** | **일 1회 (새벽 cron)** | Statiz, 핵심 선수 ~50명만 + 24h 캐싱 |
| 로스터·부상자 | 주 1~2회 | 기존 sync 유지 |
| 오늘 일정 | 일 1회 | 기존 `fetchGames.ts` |
| **선발 투수** | **일 1회 오후** | KBO 공식 예고선발 |
| 타자 라인업 | ❌ 수집 불가 | 출장 빈도 기반 예상 라인업으로 대체 |

### Statiz 매너 (1인 운영 사이트 보호)

- 어제 출장한 선수만 fetch (~50건/일)
- 요청 간 1.5~2초 간격
- User-Agent에 연락처 명시
- 매일 동일 시각에 고정 (트래픽 패턴 예측 가능)
- 출처 표기 "데이터: Statiz"

---

## 13. 구현 작업 순서 (제안)

1. **DB 마이그레이션** (`bp_ai_predictions` + view + RLS) — 1시간
2. **Vercel AI SDK 설치** + Provider 추상화 레이어 — 1~2시간
3. **컨텍스트 빌더** (`lib/ai/buildGameContext.ts`) — 3~4시간
4. **프롬프트 작성·튜닝** (3 AI에 1회씩 수동 호출로 응답 품질 검증) — 3~4시간
5. **AI 호출 모듈** (`lib/ai/predictGame.ts`) — 2~3시간
6. **Cron API 라우트** (`app/api/cron/afternoon/route.ts`) — 1~2시간
7. **채점 cron** (`app/api/cron/morning/route.ts`) — 1시간
8. **UI 컴포넌트** (`components/domain/predictions/AiPredictionCard.tsx`) — 3~4시간
9. **적중률 랭킹 페이지** — 2시간
10. **통합 테스트 + 폴리시** — 2~3시간

**총 ~20시간 (2.5~3일 집중 작업)**

---

## 14. 결정 필요 항목

이 기획서 확정 전 결정해야 할 5가지:

1. **테이블** — `bp_ai_predictions` 신규 추가 OK? (RLS: read public, write service_role)
2. **Cron 환경** — Vercel Cron 무료 tier (일 2회) 사용? 아니면 Supabase Edge Function?
3. **표시 위치** — 별도 "예측" 탭 확장? 홈 카드? 둘 다?
4. **모델 확정** — Claude Opus 4.7 / GPT-5.5 / Gemini 3.1 Pro? 또는 Gemini는 3.5 Flash로 비용 절감?
5. **AI 예측 vs 사람 예측 UI** — 통합? 분리?

---

## 15. 향후 확장 (v1.1+)

- 부상자 정보 자동 통합
- 뉴스 사전 정제 (팀 분위기 한 줄)
- AI 예측 트렌드 그래프 (시간 흐름)
- "AI 예측 베스트 적중" 매치 자동 큐레이션
- AI별 분석 스타일 메타 분석 ("Claude는 어떤 변수를 자주 본다")
- 사용자 ↔ AI 적중률 비교 ("당신은 GPT보다 정확합니다")
- 콜드 시즌 변형: "역대 명경기 재예측" 콘텐츠
