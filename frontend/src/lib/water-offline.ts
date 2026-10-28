/**
 * ออฟไลน์จดมิเตอร์ (v1) — สำหรับพื้นที่สัญญาณไม่แน่นอน
 * เก็บใน localStorage: (1) cache รายชื่อผู้ใช้น้ำต่อหมู่/งวด (2) คิวการจดที่ยังไม่ sync
 * หลักการกันข้อมูลหาย: การจดออฟไลน์เข้าคิว + มาร์กในเครื่องทันที · ลบออกจากคิว "เฉพาะเมื่อ server ยืนยันสำเร็จ"
 */
const CACHE_PREFIX = 'prapa-cache-members:';
const QUEUE_KEY = 'prapa-reading-queue';

export type QueuedReading = {
  id: string; // uuid ในเครื่อง (idempotency)
  customerId: string; customerCode: string; fullName: string;
  villageNo: number; year: number; month: number;
  currReading: number; issueType: string; phone?: string; gps?: string; note?: string;
  queuedAt: number;
};

const read = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const write = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ── cache รายชื่อต่อหมู่/งวด
export const cacheKey = (village: number | string, year: number, month: number) => `${CACHE_PREFIX}${village}-${year}-${month}`;
export function cacheMembers(village: number | string, year: number, month: number, data: any[]) {
  write(cacheKey(village, year, month), { at: Date.now(), data });
}
export function getCachedMembers(village: number | string, year: number, month: number): any[] | null {
  const c = read(cacheKey(village, year, month));
  return c?.data ?? null;
}

// ── คิวการจด
export function getQueue(): QueuedReading[] { return read(QUEUE_KEY) || []; }
export function queueReading(r: Omit<QueuedReading, 'id' | 'queuedAt'>): QueuedReading {
  const q = getQueue();
  const item: QueuedReading = { ...r, id: (crypto as any).randomUUID?.() || String(Date.now() + Math.random()), queuedAt: Date.now() };
  // ถ้ามีคิวของรายเดียวกัน+งวดเดียวกันอยู่แล้ว → แทนที่ (จดทับ)
  const filtered = q.filter((x) => !(x.customerId === r.customerId && x.year === r.year && x.month === r.month));
  write(QUEUE_KEY, [...filtered, item]);
  return item;
}
export function removeFromQueue(id: string) { write(QUEUE_KEY, getQueue().filter((x) => x.id !== id)); }
export function queueCountForVillage(village: number | string, year: number, month: number) {
  return getQueue().filter((x) => String(x.villageNo) === String(village) && x.year === year && x.month === month).length;
}

/** ส่งคิวขึ้น server ทีละรายการ — คืนจำนวนที่สำเร็จ/ล้มเหลว · ลบออกจากคิวเฉพาะที่สำเร็จ */
export async function flushQueue(post: (r: QueuedReading) => Promise<void>): Promise<{ ok: number; fail: number }> {
  let ok = 0, fail = 0;
  for (const item of getQueue()) {
    try { await post(item); removeFromQueue(item.id); ok++; }
    catch { fail++; } // ล้มเหลว → คงไว้ในคิว ลองใหม่รอบหน้า
  }
  return { ok, fail };
}
