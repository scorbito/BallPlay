# KBO 선수 명단 스크래퍼 사용법

`scripts/scrape-kbo-rosters.mjs`는 KBO 공식 사이트(koreabaseball.com)에서 10개 구단의 선수 명단을 긁어와 `data/rosters/{teamId}.json`에 저장합니다.

## 빠른 실행

```bash
# 10개 팀 전체 스크래핑 후 data/rosters/*.json에 저장
npm run scrape:rosters

# 한 팀만
node scripts/scrape-kbo-rosters.mjs --team=doosan

# 결과만 미리 보기 (파일 저장 X)
node scripts/scrape-kbo-rosters.mjs --dry-run

# 셀렉터가 안 잡힐 때 — 첫 팀의 HTML 일부를 콘솔에 출력
npm run scrape:rosters:debug
```

## 트레이드 / 명단 변경이 있을 때

1. `npm run scrape:rosters` 다시 실행
2. `git status`로 `data/rosters/*.json` 변경 확인
3. 적절히 commit + push (또는 로컬만)
4. 라인업 빌더는 자동으로 새 명단을 사용

## 스크립트가 0명을 반환하거나 깨질 때

KBO 사이트 HTML 구조가 바뀐 거예요. 다음 순서로 진단:

### 1. HTML이 진짜 받아졌는지 확인
```bash
npm run scrape:rosters:debug
```
출력 첫 줄에 "처음 3000자"가 나옵니다. 안에 `<table>`이 보이지 않거나 자바스크립트 로더만 보이면 → **클라이언트 사이드 렌더링 사이트**일 가능성. 그러면 cheerio로는 안 되고 Playwright 같은 헤드리스 브라우저가 필요합니다.

### 2. 테이블은 있는데 0명 나올 때
HTML은 받아졌지만 셀렉터가 안 맞는 경우. `scripts/scrape-kbo-rosters.mjs`의 `SELECTORS` 상수를 수정:

```js
const SELECTORS = {
  row: "table.tEx tbody tr",  // ← 실제 HTML에서 본 클래스명으로
  cells: {
    jerseyNumber: 0,  // ← 등번호가 몇 번째 셀인지 (0부터)
    name: 1,
    position: 2,
    handedness: 3
  }
};
```

`--debug` 출력에서 `<table class="...">`와 `<td>` 구조를 보면서 맞춥니다.

### 3. URL 자체가 바뀌었을 때
`KBO_ROSTER_URL` 함수 안의 URL을 수정. 브라우저에서 KBO 사이트 들어가 팀별 선수 페이지 URL 확인 후 반영.

## 포지션 매핑 한계

KBO는 보통 **투수 / 포수 / 내야수 / 외야수**로만 분류합니다. 우리 시스템은 9개 포지션을 구분하므로:

- **투수** → `P` ✓
- **포수** → `C` ✓
- **내야수** → 기본 `3B` (라인업에서 수동 변경)
- **외야수** → 기본 `CF` (라인업에서 수동 변경)
- **지명타자** → `DH`

세부 포지션이 필요하면 KBO 선수 상세 페이지를 추가로 스크래핑해야 합니다. 일단 MVP는 위 기본값으로.

## 자동화 (추후)

매주 자동 갱신이 필요해지면:
- Vercel Cron Job + `/api/cron/sync-rosters` 라우트로 서버 사이드 실행
- 결과를 `ballplay_player_rosters` 새 테이블에 저장 (운영 코드와 격리)
- 라인업 빌더가 DB 우선, JSON fallback

지금은 수동 실행으로 충분 — 트레이드 빈도 낮음.

## 에티켓

- 팀 사이 1초 딜레이 (`setTimeout`)로 사이트 부담 최소화
- User-Agent에 브라우저 표기, Referer 명시
- 너무 자주(매분 단위) 돌리지 않기 — 주 1회 정도면 충분

문제 생기면 `--debug` 출력을 같이 보면서 셀렉터 잡으면 됩니다.
