// KBO 공식 프로필 사진 주소.
//
// 우리 서버에 사본을 두지 않고 KBO CDN을 그대로 참조한다(인라인 링크). 사진 파일을 내려받아
// 재배포하는 것과 달리 원본 서버가 전송 주체로 남고, 이미지 트래픽도 우리 쪽에 잡히지 않는다.
// 핫링크 차단·Referer 검사가 없고 Access-Control-Allow-Origin 도 열려 있는 것을 확인했다.
//
// 원본 해상도는 94×118이다. 표시 크기를 그보다 키우면 뭉개지므로 주의.

const CDN = "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle";

/** 사진이 존재하는 시즌을 모를 때 쓰는 기본값. 경로에 연도가 들어가는 구조다. */
const DEFAULT_YEAR = 2026;

/**
 * @param playerId KBO playerId (로스터의 팀-등번호 id 가 아니다)
 * @param year 사진이 존재하는 시즌. 생략하면 최신 시즌으로 시도한다.
 */
export function kboPlayerPhotoUrl(playerId: string, year?: number | null): string {
  return `${CDN}/${year ?? DEFAULT_YEAR}/${playerId}.jpg`;
}
