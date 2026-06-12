# BallPlay AI Battle Reference

## Table

Target table: `public.bp_ai_battle_predictions`

Required columns for insert:

- `game_id`: UUID from `public.games.id`
- `game_date`: KST game date, `YYYY-MM-DD`
- `target_side`: `home` or `away`
- `ai_provider`: `gemini`, `gpt`, or `claude`; daily battle normally uses only `gemini` and `gpt`
- `model_name`: current model identifier
- `predicted_winner_team_id`: `public.teams.id`
- `key_factor`: short factual factor
- `one_liner`: card summary
- `detailed_analysis`: detailed win path
- `counter_argument`: rebuttal against opponent strength
- `published_at`: normally `YYYY-MM-DDT09:00:00+09:00`

Unique key:

- `(game_id, target_side, ai_provider)`

Public read policy:

- Rows are visible when `published_at <= now()`.

## Provider Mapping

Use this fixed mapping unless the user explicitly requests otherwise:

| provider | target_side | winner team |
| --- | --- | --- |
| `gemini` | `home` | `games.home_team_id` |
| `gpt` | `away` | `games.away_team_id` |

## Preferred Local Data Sources

Check these project files first when present:

- `docs/ai승리팀대결_기획서.md`
- `scripts/today-fetched-data.json`
- `scripts/quant-fetched-data.json`
- `scripts/weekly-stats-summary.json`
- Existing date/provider scripts under `scripts/`
- Scratch checks under `scratch/`

Expected local JSON contents:

- `today-fetched-data.json`: games, recent lineups, team news
- `quant-fetched-data.json`: standings, starter stats, team offense
- `weekly-stats-summary.json`: weekly team hitting/pitching summary

## Supabase Access

Existing project scripts load credentials from `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Use service role only for the actual write. Verification reads can use the same service client.

## Safety Rules

- Delete only rows for the same `game_date`, same `ai_provider`, and the target `game_id` list.
- Do not delete another provider's rows.
- Do not delete all rows for a date unless the user explicitly asks.
- Verify inserted rows immediately after writing.
- If game count is zero or source data is stale/missing, stop and explain what is missing.

## Payload Example

```json
{
  "game_date": "2026-06-09",
  "ai_provider": "gpt",
  "model_name": "gpt-5-codex",
  "published_at": "2026-06-09T09:00:00+09:00",
  "rows": [
    {
      "game_id": "583ecf6c-f87f-4c68-87e6-29add37a77fa",
      "target_side": "away",
      "predicted_winner_team_id": "ssg",
      "key_factor": "SSG 타선 OPS",
      "one_liner": "SSG는 최근 팀 OPS 우위를 앞세워 잠실 원정에서도 반전 루트를 만들 수 있습니다.",
      "detailed_analysis": "Use concrete stats and news here.",
      "counter_argument": "Answer the home team's strongest edge with a factual weakness or variance route."
    }
  ]
}
```
