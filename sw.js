/* Pikachu Mermaid — Service Worker（离线缓存） */
const CACHE_NAME = "pikachu-mermaid-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./mermaid.min.js",
  "./Pikachu_Mermaid.ico",
  "./icon-192x192.png",
  "./icon-512x512.png",
  "./manifest.webmanifest"
];

// 安装：预缓存核心资源
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// 接收页面指令后立即接管（用于「有新版本 → 点此刷新」）
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// 请求：缓存优先，回退网络；非 GET 请求直接放行
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((resp) => {
          // 只缓存同源成功响应
          if (resp && resp.ok && new URL(event.request.url).origin === self.location.origin) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return resp;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
