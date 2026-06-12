---
name: ai-battle-input
description: Create and insert BallPlay KBO AI 승리회로/승부대결 battle predictions into Supabase. Use when the user says "승부대결 입력해줘", "AI 승리회로 배틀 입력", "원정팀/홈팀 의견 분석해서 DB 등록", or asks Codex to analyze daily KBO matchups using DB/news/fetched data and write rows to public.bp_ai_battle_predictions.
---

# AI Battle Input

## Overview

Use this skill to create daily BallPlay AI battle predictions and insert them into `public.bp_ai_battle_predictions`.

This is not a joke-prediction workflow. Every row must find a real, data-backed reason the assigned side can win, even when that side is an underdog.

## Role Rules

- `gpt` owns away teams: `target_side = "away"`, `predicted_winner_team_id = games.away_team_id`.
- `gemini` owns home teams: `target_side = "home"`, `predicted_winner_team_id = games.home_team_id`.
- `claude` is not used for this battle workflow unless the user explicitly changes the plan.
- If the user does not name a provider and you are Codex, use `gpt`.

## Workflow

1. Resolve the KST date.
   - Prefer the user's requested date.
   - Otherwise use current KST date.
   - Use ISO date format: `YYYY-MM-DD`.
2. Read the project context.
   - Read `docs/ai승리팀대결_기획서.md`.
   - Read `references/ballplay-ai-battle.md` in this skill.
   - Inspect existing project scripts for the target date before creating new ones.
3. Gather factual input.
   - Use local DB/fetched data first: `scripts/today-fetched-data.json`, `scripts/quant-fetched-data.json`, `scripts/weekly-stats-summary.json`, and any date-specific fetch outputs.
   - Query Supabase when local files are missing or stale.
   - Use news already stored in DB/local data when available.
   - Browse only when the user asks for live/latest data or local/DB news is insufficient.
4. Create one row per game for the assigned provider.
   - The chosen winner must match the assigned side, not the objectively likelier team.
   - `key_factor`: concise factual factor.
   - `one_liner`: one strong, factual summary.
   - `detailed_analysis`: explain the assigned side's win route using concrete stats/news.
   - `counter_argument`: directly answer the opponent's strongest edge with a factual weakness or variance path.
5. Insert safely.
   - Build a JSON file with a top-level object: `{ "game_date", "ai_provider", "model_name", "published_at", "rows" }`.
   - Run `scripts/upsert-battle-predictions.mjs` from this skill with the JSON path.
   - The script deletes only matching `game_date + ai_provider + game_ids`, then inserts the new rows.
6. Verify.
   - Query `bp_ai_battle_predictions` for `game_date` and `ai_provider`.
   - Confirm row count equals game count.
   - Confirm every row has the expected `target_side` and `predicted_winner_team_id`.
   - Report concise registration results to the user.

## Required Row Shape

Each row in the payload `rows` array must include:

```json
{
  "game_id": "uuid",
  "target_side": "away",
  "predicted_winner_team_id": "ssg",
  "key_factor": "SSG 타선 OPS",
  "one_liner": "...",
  "detailed_analysis": "...",
  "counter_argument": "..."
}
```

Do not include `ai_provider`, `game_date`, `model_name`, or `published_at` inside each row unless there is a specific reason. The upsert script applies those top-level values.

## Writing Standard

- Avoid unsupported claims such as "분위기가 좋다" unless a news item or metric supports it.
- Prefer concrete metrics: OPS, AVG, OBP, SLG, ERA, WHIP, K9, BB9, HR9, recent lineup performance, injuries, roster changes, travel/rest, ballpark, weather.
- When a side is clearly weaker, find a narrow but plausible route: starter volatility, bullpen fatigue, opponent injury, platoon edge, ballpark fit, low sample upside, or recent news-backed momentum.
- Keep the tone confident, but do not invent facts.

## Useful Commands

From the BallPlay project root:

```powershell
node .agents/skills/ai-battle-input/scripts/upsert-battle-predictions.mjs scratch/battle-payload-YYYY-MM-DD-gpt.json
```

Use the same script for `gemini` if the payload sets `ai_provider` to `gemini` and every row is `target_side = "home"`.
