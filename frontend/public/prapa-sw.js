/**
 * Service Worker ระบบประปา (/prapa) — ให้แอปเปิด/จดมิเตอร์ได้แม้สัญญาณหลุด (พื้นที่ภาคสนาม)
 *
 * ขอบเขตที่แตะ (ตั้งใจแคบ — ไม่ยุ่งระบบอื่น):
 *   • /_next/static, ฟอนต์, รูป  → cache-first (ไฟล์ hash immutable ปลอดภัย)
 *   • navigation/RSC ของ /prapa   → network-first + fallback cache (reload ออฟไลน์ได้)
 *   • /v1/ (API เงิน/รายงาน/สลิป)  → ปล่อยผ่าน network ล้วน ไม่ cache เด็ดขาด (ต้อง realtime)
 *   • หน้าอื่น (สารบรรณ ฯลฯ)        → ปล่อยผ่าน ไม่แตะ
 *
 * หมายเหตุ: ข้อมูลจดมิเตอร์ออฟไลน์เก็บแยกใน localStorage (water-offline.ts) ไม่พึ่ง SW cache
 */
const STATIC_CACHE = 'prapa-static-v1';
const SHELL_CACHE = 'prapa-shell-v1';
const KEEP = [STATIC_CACHE, SHELL_CACHE];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('prapa-') && !KEEP.includes(k)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isStaticAsset = (p) =>
  p.startsWith('/_next/static/') || p.startsWith('/fonts/') ||
  /\.(?:png|svg|jpe?g|webp|gif|ico|woff2?|ttf|otf|css)$/.test(p);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // mutation → ไม่แตะ (กันจ่ายซ้ำ/บันทึกผี)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // ข้ามโดเมน → ไม่แตะ
  if (url.pathname.startsWith('/v1/')) return;            // API → network ล้วน (เงิน/รายงานต้องสด)

  if (isStaticAsset(url.pathname)) { e.respondWith(cacheFirst(req)); return; }

  const isPrapa = url.pathname === '/prapa' || url.pathname.startsWith('/prapa/');
  if (!isPrapa) return;                                   // หน้าอื่น (สารบรรณ) → ไม่แตะ

  e.respondWith(networkFirst(req));                       // navigation/RSC/GET ของ /prapa
});

async function cacheFirst(req) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return hit || Response.error();
  }
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    // ไม่เคย cache หน้านี้ → เสิร์ฟ shell /prapa ที่เคยเปิด (บูตแอปแล้วให้ client-router พาไปต่อ)
    const shell = (await cache.match('/prapa')) || (await cache.match('/prapa/reading'));
    if (shell) return shell;
    return Response.error();
  }
}
