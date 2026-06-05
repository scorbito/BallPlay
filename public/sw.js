/* 야구놀이터 웹 푸시 서비스 워커 (정적 파일).
 * - push: 서버 payload({ title, body, url, icon }) 로 알림 표시
 * - notificationclick: 알림 닫고 url 열기 (이미 열린 탭 있으면 focus)
 * Phase 1 — 푸시 전용. 오프라인 캐싱 등은 다루지 않음.
 */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {};
  }

  const title = payload.title || "야구놀이터";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/assets/mascot-default.png",
    badge: payload.icon || "/assets/mascot-default.png",
    data: { url: payload.url || "/" },
    tag: payload.tag || "ballplay-push"
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // 이미 열린 탭이 있으면 그 탭으로 이동 + focus.
        for (const client of clientList) {
          if ("focus" in client) {
            try {
              if ("navigate" in client) client.navigate(targetUrl);
            } catch (e) {
              /* navigate 실패해도 focus 는 시도 */
            }
            return client.focus();
          }
        }
        // 열린 탭이 없으면 새 창.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
