// face-api.js 로더 — 얼굴 검출 + 128차원 임베딩 추출.
//
// npm 의존성으로 넣지 않고 CDN에서 동적 로드한다. tfjs 까지 딸려와 번들이 수 MB 커지는데,
// 이 게임 하나 때문에 전 페이지 빌드와 배포 용량을 키울 이유가 없다. 스크립트·가중치 모두
// /play/face 진입 시점에만 받고, 이후에는 브라우저 캐시가 처리한다.
//
// 모델 조합은 public/face/embeddings.bin 을 구울 때 쓴 것과 반드시 같아야 한다.
// 임베딩은 랜드마크로 정렬한 얼굴에서 뽑히므로, 랜드마크 모델이 다르면 정렬이 어긋나
// 같은 얼굴인데도 유사도가 전반적으로 낮게 나온다.
//   현재: ssd_mobilenetv1(5.5MB) + face_landmark_68(348KB) + face_recognition(6.3MB) = 약 12MB
//   경량: tiny_face_detector(189KB) + face_landmark_68_tiny(75KB) 로 바꾸면 약 6.7MB.
//         단, 그 경우 .bin 을 같은 조합으로 다시 구워야 한다.

const FACE_API_VERSION = "1.7.15";
const SCRIPT_URL = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FACE_API_VERSION}/dist/face-api.js`;
const MODEL_URL = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FACE_API_VERSION}/model`;

/** 검출 입력 상한. 폰 원본(4000px+)을 그대로 넣으면 느리고 메모리도 튄다. */
const MAX_INPUT_SIDE = 1024;
/** 작은 사진은 키워야 얼굴이 검출된다. 선수 프로필(94×118) 임베딩도 3배로 뽑았다. */
const UPSCALE_FACTOR = 3;

type FaceApi = {
  nets: {
    ssdMobilenetv1: { loadFromUri: (url: string) => Promise<void> };
    faceLandmark68Net: { loadFromUri: (url: string) => Promise<void> };
    faceRecognitionNet: { loadFromUri: (url: string) => Promise<void> };
  };
  SsdMobilenetv1Options: new (options: { minConfidence?: number; maxResults?: number }) => unknown;
  detectSingleFace: (
    input: HTMLImageElement | HTMLCanvasElement,
    options: unknown
  ) => {
    withFaceLandmarks: () => {
      withFaceDescriptor: () => Promise<{ descriptor: Float32Array } | undefined>;
    };
  };
};

declare global {
  interface Window {
    faceapi?: FaceApi;
  }
}

let loadPromise: Promise<FaceApi> | null = null;

function injectScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-face-api="1"]');
    if (existing) {
      if (window.faceapi) resolve();
      else {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("얼굴 인식 모듈을 불러오지 못했습니다.")), {
          once: true
        });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.dataset.faceApi = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("얼굴 인식 모듈을 불러오지 못했습니다."));
    document.head.appendChild(script);
  });
}

/** 스크립트 + 가중치 로드. 여러 번 불려도 실제 로드는 한 번만 일어난다. */
export function loadFaceApi(): Promise<FaceApi> {
  if (loadPromise) return loadPromise;

  const promise = (async () => {
    await injectScript();
    const faceapi = window.faceapi;
    if (!faceapi) throw new Error("얼굴 인식 모듈을 불러오지 못했습니다.");

    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    return faceapi;
  })();

  loadPromise = promise;
  promise.catch(() => {
    // 네트워크 실패 시 재시도할 수 있게 캐시를 비운다.
    if (loadPromise === promise) loadPromise = null;
  });

  return promise;
}

/** 검출에 적당한 크기의 캔버스로 옮긴다. 큰 사진은 줄이고, 작은 사진은 키운다. */
function fitToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = longest > MAX_INPUT_SIDE ? MAX_INPUT_SIDE / longest : UPSCALE_FACTOR;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이미지를 처리하지 못했습니다.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * 사진 한 장에서 얼굴 임베딩을 뽑는다. 얼굴을 못 찾으면 null.
 * 임계값을 낮춰 한 번 더 시도하는 이유는 실제 셀카가 조명·각도가 제각각이라
 * 기본값에서 놓치는 경우가 흔하기 때문이다.
 */
export async function describeFace(image: HTMLImageElement): Promise<Float32Array | null> {
  const faceapi = await loadFaceApi();
  const canvas = fitToCanvas(image);

  const attempt = async (minConfidence: number) => {
    const detection = await faceapi
      .detectSingleFace(canvas, new faceapi.SsdMobilenetv1Options({ minConfidence }))
      .withFaceLandmarks()
      .withFaceDescriptor();
    return detection?.descriptor ?? null;
  };

  return (await attempt(0.4)) ?? (await attempt(0.15));
}

/** File → HTMLImageElement. objectUrl 은 호출 측에서 해제한다. */
export function loadImageFromFile(file: File): Promise<{ image: HTMLImageElement; objectUrl: string }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, objectUrl });
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("사진을 읽지 못했습니다. 다른 파일로 시도해 주세요."));
    };
    image.src = objectUrl;
  });
}
