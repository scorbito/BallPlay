# KBO 시즌 스탯 스크래퍼 사용법

`scripts/scrape-kbo-stats.mjs` — KBO 공식 사이트(koreabaseball.com)에서 시즌 타자/투수 스탯을 받아 `data/kbo_players_2026.json` 갱신.

## 1회 시드 절차

```bash
# 0) 로스터가 먼저 있어야 함 (없으면 아래 한 번 실행)
npm run scrape:rosters

# 1) 폼 구조 확인 — 첫 실행 전 한 번
npm run scrape:stats:probe

# 2) 한 팀만 dry-run으로 검증 (두산)
npm run scrape:stats:one

# 3) 결과 확인 후 10팀 전체 실행
npm run scrape:stats
```

## 옵션

```bash
node scripts/scrape-kbo-stats.mjs --year=2026          # 시즌 지정
node scripts/scrape-kbo-stats.mjs --team=lg            # 단일 팀
node scripts/scrape-kbo-stats.mjs --no-futures         # 1군만 (2군 skip)
node scripts/scrape-kbo-stats.mjs --probe              # 폼 필드/테이블 디버그 출력
```

## 매너

- 페이지 사이 1.5초 딜레이 (KBO 사이트는 부하 여유 있지만 보수적으로)
- User-Agent에 봇 식별자 명시 (`BallPlay-Seed/0.1 (contact: dev@ballplay.local)`)
- **시즌당 1회 시드 + 변경 시점만 수동 재실행**. 정기 cron 금지.

## 매칭 동작

- KBO 통계 페이지에는 등번호가 없어서 `data/rosters/{team}.json`의 **선수명**으로 매칭.
- 동명이인은 `seasonGames > 0`인 1군 우선.
- 매칭 실패한 1군 기록 보유 선수는 실행 마지막에 리포트 출력 — 그 경우 로스터 갱신 또는 수동 보정 필요.

## 출력 스키마

`data/kbo_players_2026.json`은 `lib/sim/statsLoader.ts`가 직접 import. 스키마는 `lib/sim/types.ts`의 `SimBatter`/`SimPitcher`와 동일.

## 문제 해결

- `! ddlTeam not found` → KBO 사이트의 폼 필드명이 바뀌었거나 페이지 로드 실패. `--probe`로 현재 select name 확인 후 `findFormFieldName` 후보에 추가.
- `(no table.tData found)` → 통계 테이블 클래스 변경. `--probe`로 실제 class 확인 후 `scrapeStatsPage`의 선택자 수정.
- 매칭률이 낮음 → 한자명/별명/외국인 표기 차이일 수 있음. `findPlayerInRoster`에 정규화 로직 추가.
