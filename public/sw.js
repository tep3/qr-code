const CACHE_NAME = "qr-app-cache-v1";

// ไฟล์เริ่มต้นที่ต้องการ Cache ไว้ให้โหลดแบบ Offline ได้
const urlsToCache = ["/", "/css/custom.css", "/js/app.js", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // ใช้ catch เพื่อไม่ให้พังถ้าหาไฟล์บางตัวไม่เจอตอน install
      return cache
        .addAll(urlsToCache)
        .catch((err) => console.log("Cache addAll error:", err));
    }),
  );
});

self.addEventListener("activate", (event) => {
  // ลบ Cache เก่าทิ้งเมื่อมีการอัปเดตเวอร์ชัน (เปลี่ยนเลข CACHE_NAME)
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
});

self.addEventListener("fetch", (event) => {
  // ========================================================
  // [จุดแก้ปัญหา] ข้ามการ Cache หากไม่ใช่ http หรือ https
  // (เช่น Request จาก chrome-extension:// จะไม่ถูกนำมาแคช)
  // ========================================================
  if (!event.request.url.startsWith("http")) {
    return;
  }

  // ข้ามการ Cache สำหรับ API Request (ให้ดึงข้อมูลใหม่เสมอ)
  if (event.request.url.includes("/api/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // 1. ถ้าเจอข้อมูลใน Cache ให้ส่งกลับไปเลย (ทำงานเร็วขึ้น/รองรับ Offline)
      if (response) {
        return response;
      }

      // 2. ถ้าไม่เจอ ให้ไปดึงข้อมูลจาก Network ตามปกติ
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest)
        .then((response) => {
          // ตรวจสอบความถูกต้องของ Response ก่อนแคช
          if (
            !response ||
            response.status !== 200 ||
            response.type !== "basic"
          ) {
            return response;
          }

          // สำเนา Response ไว้สำหรับนำไปใส่ใน Cache
          const responseToCache = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            // เช็คโปรโตคอลอีกครั้งเพื่อความชัวร์ 100%
            if (event.request.url.startsWith("http")) {
              cache.put(event.request, responseToCache);
            }
          });

          return response;
        })
        .catch((err) => {
          console.log("Fetch failed; returning offline page instead.", err);
          // สามารถเพิ่มโค้ดให้ Return หน้า Offline.html ได้ในอนาคตถ้าต้องการ
        });
    }),
  );
});
