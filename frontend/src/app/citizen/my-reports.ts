// เรื่องร้องเรียนที่ส่งจากเครื่องนี้ — จำไว้ในเบราว์เซอร์ เผื่อลูกบ้านปิดหน้าสำเร็จแล้วลืมเลขอ้างอิง
// เก็บเฉพาะเลขอ้างอิง/เบอร์/ชื่อฟอร์ม/เวลา (ไม่เก็บเนื้อหาเรื่อง) สูงสุด 20 เรื่อง
export type MyReport = { refNo: string; phone: string; title: string; at: string };

const KEY = 'citizen-my-reports';
const MAX = 20;
const listeners = new Set<() => void>();

export const subscribeMyReports = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener('storage', cb);
  return () => { listeners.delete(cb); window.removeEventListener('storage', cb); };
};

/** ค่าดิบใน storage (string ที่เทียบค่าได้ — ใช้เป็น snapshot ของ useSyncExternalStore) */
export const readMyReportsRaw = (): string => {
  try { return localStorage.getItem(KEY) || ''; } catch { return ''; }
};

export const parseMyReports = (raw: string): MyReport[] => {
  try {
    const a = JSON.parse(raw || '[]');
    return Array.isArray(a) ? a.filter((r) => r && typeof r.refNo === 'string') : [];
  } catch { return []; }
};

export function saveMyReport(r: MyReport) {
  const next = [r, ...parseMyReports(readMyReportsRaw()).filter((x) => x.refNo !== r.refNo)].slice(0, MAX);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* โหมดส่วนตัว — ข้าม */ }
  listeners.forEach((f) => f());
}
