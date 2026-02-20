const CACHE_NAME = "qrforge-cache-v1";

// ไฟล์เริ่มต้นที่ต้องการให้โหลดเก็บไว้ทันทีที่เข้าเว็บครั้งแรก
const urlsToCache = [
  "/",
  "/manifest.json",
  "/css/custom.css",
  "/js/app.js",
  // หากมีไฟล์ icon หรือ script อื่นๆ สามารถนำมาเพิ่มตรงนี้ได้ครับ
];

// 1. Install Event: ติดตั้ง Service Worker และ Cache ไฟล์เริ่มต้น
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Opened cache");
      return cache.addAll(urlsToCache);
    }),
  );
  // บังคับให้ Service Worker ตัวใหม่ทำงานทันที
  self.skipWaiting();
});

// 2. Activate Event: ล้าง Cache เก่าทิ้งเมื่อมีการอัปเดตเวอร์ชัน (เปลี่ยนเลข v1 เป็น v2)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

// 3. Fetch Event: ดักจับการโหลดข้อมูล (Network First Strategy)
self.addEventListener("fetch", (event) => {
  // ข้ามการ Cache สำหรับ Request ที่ไม่ใช่ GET (เช่น POST ไปที่ API เพื่อสร้าง QR)
  if (event.request.method !== "GET") return;

  // สำหรับการดึงไฟล์ทั่วไป (HTML, CSS, JS, รูปภาพ)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // ถ้าโหลดจากเน็ตสำเร็จ ให้เอาไปอัปเดตใน Cache ด้วย
        // โคลน response ไว้ เพราะ response จะถูกอ่านได้แค่ครั้งเดียว
        if (response && response.status === 200 && response.type === "basic") {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // ถ้าผู้ใช้ออฟไลน์ (Network failed) ให้ไปหาใน Cache
        return caches.match(event.request);
      }),
  );
});
