// ราคาที่เจ้าหน้าที่ตั้งไว้ (ค่าเช่าแผงประจำรายแถว + ค่าขยะแผง) เก็บในเครื่องนี้ (localStorage) · หน้าประชาชนอ่านตอนเปิดหน้า
// ค่าที่ไม่ถูกต้องจะถูกข้าม แล้วใช้ค่าตั้งต้นแทน · ยังไม่มี backend
const MARKET_RATES_KEY = 'market:rates';
interface StoredRates { rows: Record<string, number>; stallWaste: number }

function applyStoredRates(planRows: { id: string; monthlyRate?: number }[], rates: { stallWaste: number }) {
  try {
    const raw = JSON.parse(localStorage.getItem(MARKET_RATES_KEY) || 'null') as Partial<StoredRates> | null;
    if (!raw || typeof raw !== 'object') return;
    for (const row of planRows) {
      const value = Number(raw.rows?.[row.id]);
      if (Number.isFinite(value) && value >= 0) row.monthlyRate = value;
    }
    const waste = Number(raw.stallWaste);
    if (Number.isFinite(waste) && waste >= 0) rates.stallWaste = waste;
  } catch { }
}

function saveStoredRates(planRows: { id: string; monthlyRate?: number }[], rates: { stallWaste: number }) {
  const rows: Record<string, number> = {};
  for (const row of planRows) rows[row.id] = Number(row.monthlyRate) || 0;
  try { localStorage.setItem(MARKET_RATES_KEY, JSON.stringify({ rows, stallWaste: rates.stallWaste } as StoredRates)); } catch { }
}
