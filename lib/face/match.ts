// 닮은 선수 찾기 — 선수 임베딩 로드와 유사도 검색.
//
// 임베딩은 빌드 타임 산출물이다(scripts/poc-face-fetch-photos.mjs 로 사진 수집 →
// /poc-face 페이지에서 추출 → public/face/embeddings.bin 커밋). 런타임에는 계산하지 않는다.
//
// 205명 × 128차원은 전수 내적이 1ms 미만이라 ANN 인덱스가 필요 없다.
// 벡터가 L2 정규화되어 있으므로 코사인 유사도 = 단순 내적.

export const FACE_EMBEDDING_DIM = 128;

const EMBEDDINGS_URL = "/face/embeddings.bin";
const PLAYERS_URL = "/face/players.json";

export type FacePlayer = {
  id: string;
  name: string;
  team: string;
  no: number | null;
  pos: string;
  /** 프로필 사진이 존재하는 시즌. scripts/poc-face-fill-photo-year.mjs 로 채운다. */
  y?: number | null;
};

export type FaceMatch = {
  player: FacePlayer;
  /**
   * 코사인 유사도 원값. 화면에 그대로 노출하면 안 된다 —
   * 서로 다른 사람끼리도 0.9 대에 몰려서 변별력이 없다(아래 SYNC_ANCHORS 주석 참고).
   */
  similarity: number;
  /** 화면에 보여주는 싱크로율(60~99). 같은 사진이면 항상 같은 값이 나온다. */
  syncRate: number;
};

type FaceIndex = {
  players: FacePlayer[];
  /** players 와 같은 순서로 이어붙인 [n × DIM] 평면 배열. */
  vectors: Float32Array;
};

let cached: FaceIndex | null = null;
let inflight: Promise<FaceIndex> | null = null;

/** 선수 인덱스 로드 — 탭 재진입 시 재다운로드하지 않도록 모듈 단위로 캐시한다. */
export async function loadFaceIndex(): Promise<FaceIndex> {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const [playersRes, binRes] = await Promise.all([fetch(PLAYERS_URL), fetch(EMBEDDINGS_URL)]);
    if (!playersRes.ok || !binRes.ok) {
      throw new Error("선수 데이터를 불러오지 못했습니다.");
    }
    const players = (await playersRes.json()) as FacePlayer[];
    const vectors = new Float32Array(await binRes.arrayBuffer());

    if (vectors.length !== players.length * FACE_EMBEDDING_DIM) {
      // 한쪽만 갱신하고 배포하면 순서가 어긋나 엉뚱한 선수가 나온다. 조용히 넘기지 않는다.
      throw new Error(
        `임베딩 길이 불일치: 선수 ${players.length}명인데 벡터는 ${vectors.length / FACE_EMBEDDING_DIM}개입니다.`
      );
    }

    cached = { players, vectors };
    inflight = null;
    return cached;
  })();

  try {
    return await inflight;
  } catch (err) {
    inflight = null;
    throw err;
  }
}

/** L2 정규화 — 정규화된 벡터끼리는 내적이 곧 코사인 유사도가 된다. */
export function l2normalize(vector: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
  const norm = Math.sqrt(sum) || 1;
  const out = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i += 1) out[i] = vector[i] / norm;
  return out;
}

/**
 * z-score → 싱크로율 앵커. 선형 보간한다.
 *
 * 코사인 유사도 절댓값은 쓸 수 없다. 205명 임베딩으로 20,910쌍을 실측해 보니
 * 서로 다른 사람인데도 중앙값 0.933, 최솟값조차 0.710이었다. 벡터가 좁은 원뿔에
 * 분포해서 "0.9면 많이 닮음" 같은 절대 기준이 성립하지 않는다.
 *
 * 그래서 상대 지표를 쓴다. 질의 사진과 205명의 유사도 분포에서 1위가 평균보다
 * 몇 표준편차 위인지(z)를 본다. 사진 품질·조명이 달라 절대값이 통째로 흔들려도
 * z 는 그 영향을 상쇄한다.
 *
 * 앵커는 선수끼리의 z 분포(p0 0.92 / p50 1.23 / p75 1.35 / p95 3.07 / max 5.34)를
 * 기준으로 잡았다. 중앙값이 80% 근처에 오고, 상위 5%만 95%를 넘는다.
 */
const SYNC_ANCHORS: Array<[z: number, score: number]> = [
  [0.7, 62],
  [1.0, 72],
  [1.2, 80],
  [1.5, 85],
  [2.0, 90],
  [3.0, 95],
  [5.0, 99]
];

function zToSyncRate(z: number): number {
  const first = SYNC_ANCHORS[0];
  const last = SYNC_ANCHORS[SYNC_ANCHORS.length - 1];
  if (z <= first[0]) return first[1];
  if (z >= last[0]) return last[1];

  for (let i = 1; i < SYNC_ANCHORS.length; i += 1) {
    const [z1, s1] = SYNC_ANCHORS[i];
    if (z > z1) continue;
    const [z0, s0] = SYNC_ANCHORS[i - 1];
    const t = (z - z0) / (z1 - z0);
    return Math.round(s0 + (s1 - s0) * t);
  }
  return last[1];
}

/** 정규화된 질의 벡터로 상위 N명을 찾는다. 205건 전수 비교. */
export function findTopMatches(index: FaceIndex, query: Float32Array, topN = 5): FaceMatch[] {
  const { players, vectors } = index;
  const count = players.length;
  const sims = new Float64Array(count);

  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    const offset = i * FACE_EMBEDDING_DIM;
    let dot = 0;
    for (let d = 0; d < FACE_EMBEDDING_DIM; d += 1) dot += query[d] * vectors[offset + d];
    sims[i] = dot;
    sum += dot;
  }

  // 싱크로율의 기준선. 전체 분포에서 얼마나 튀는지를 봐야 의미가 생긴다.
  const mean = sum / count;
  let variance = 0;
  for (let i = 0; i < count; i += 1) variance += (sims[i] - mean) ** 2;
  const sd = Math.sqrt(variance / count) || 1e-6;

  const scored: FaceMatch[] = new Array(count);
  for (let i = 0; i < count; i += 1) {
    scored[i] = {
      player: players[i],
      similarity: sims[i],
      syncRate: zToSyncRate((sims[i] - mean) / sd)
    };
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, topN);
}

/** KBO 공식 선수 기록 페이지. */
export function kboPlayerUrl(player: FacePlayer): string {
  const path = player.pos === "투수" ? "PitcherDetail" : "HitterDetail";
  return `https://www.koreabaseball.com/Record/Player/${path}/Basic.aspx?playerId=${player.id}`;
}

// 프로필 사진 주소는 lib/kbo/playerPhoto.ts 로 옮겼다(워들 결과 화면과 공용).
