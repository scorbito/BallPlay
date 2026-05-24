/** Promise를 timeout과 경쟁시킴.
 *  - promise가 ms 안에 settle되면 그 결과 반환
 *  - timeout이면 onTimeout 결과 반환 (없으면 throw)
 *
 *  사용 케이스: iOS Safari 백그라운드 후 복귀 시 Supabase auth.refreshSession() 같은
 *  fetch가 limbo 상태로 영원히 hang하는 문제 회피. 정해진 시간 안에 안 끝나면
 *  포기하고 진행 (다음 fetch에서 401 나면 SDK가 자동 재시도). */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout?: () => T
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => {
      if (onTimeout) {
        try {
          resolve(onTimeout());
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error(`timeout after ${ms}ms`));
      }
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer !== null) clearTimeout(timer);
  });
}
