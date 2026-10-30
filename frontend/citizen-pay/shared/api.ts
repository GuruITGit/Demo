// เชื่อมหน้าประชาชน (static) กับ API จริง: /v1/citizen/pay/* (สาธารณะ ไม่ต้องล็อกอิน)
// ถ้าเข้าถึง API ไม่ได้ (เช่นเดโม่บน Vercel) payApi คืน null แล้วหน้าจะใช้ข้อมูลตัวอย่างเดิม
const PAY_API = '/v1/citizen/pay';
class PayApiError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } }
const MONTH_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
/** "2569-10" → "ตุลาคม 2569" */
const periodToThai = (p: string) => { const [y, m] = String(p).split('-'); return `${MONTH_TH[Number(m) - 1] ?? m} ${y}`; };

/** เรียก API สาธารณะ: คืนค่า data · null = เข้าถึงไม่ได้ (ไม่ใช่ JSON) · โยน PayApiError เมื่อ backend ตอบว่าผิดพลาด */
async function payApi<T>(path: string, init?: RequestInit): Promise<T | null> {
  let r: Response;
  try { r = await fetch(PAY_API + path, init); } catch { return null; }
  const j = await r.json().catch(() => null);
  if (!j || typeof j !== 'object') return null;
  if (!r.ok || j.success === false) throw new PayApiError(j?.error?.message || 'ทำรายการไม่สำเร็จ', r.status);
  return j.data as T;
}

/** ใช้ค่าช่องทางรับเงิน/ราคาจากระบบจริง เขียนทับค่าตั้งต้นใน PAYMENT */
function applyPayConfig(c: any): void {
  Object.assign(PAYMENT, {
    promptpayId: c.promptpayId || '', promptpayType: c.promptpayType || 'mobile', payeeName: c.payeeName || '',
    accountBank: c.accountBank || '', accountNo: c.accountNo || '', cashPlace: c.cashPlace || PAYMENT.cashPlace, cashHours: c.cashHours || PAYMENT.cashHours, contactPhone: c.contactPhone || '',
    demo: false,
  });
}
