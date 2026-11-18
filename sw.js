// 오프라인에서도 가계부가 열리도록 앱 파일을 기기에 보관한다.
// 앱 파일을 고친 뒤 다시 올릴 때는 VERSION 숫자를 올려야 휴대폰이 새 버전을 받는다.
const VERSION = "ledger-v5";
const APP_FILES = ["./", "./index.html", "./manifest.webmanifest?v=pig", "./icon-pig-192.png", "./icon-pig-512.png", "./apple-touch-icon-pig.png"];

self.addEventListener("install", (event) => {
  // cache: "reload" — 브라우저에 남은 예전 파일 대신 서버에서 새로 받는다.
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(APP_FILES.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameOrigin && !isFont) return;

  // 페이지 자체: 온라인이면 항상 최신 버전, 오프라인이면 보관해 둔 사본.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req, { cache: "no-cache" })
        .then((res) => {
          if (res && res.ok) caches.open(VERSION).then((c) => c.put("./index.html", res.clone()));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // 아이콘·글꼴 등: 보관해 둔 사본을 먼저 쓰고, 뒤에서 새로 받아 둔다.
  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
