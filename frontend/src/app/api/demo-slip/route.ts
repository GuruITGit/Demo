import { NextResponse } from 'next/server';

/**
 * เดโม่เท่านั้น: ตรวจสลิปจริงกับ Slip2Go ให้หน้าประชาชนเดโม่ (ไม่มี backend) — โทเคนอยู่ใน env ของ Vercel (SLIP2GO_TOKEN) ไม่อยู่ในโค้ด/เบราว์เซอร์
 * unavailable = ตรวจไม่ได้ (ไม่ตั้งโทเคน/โทเคนผิด/เชื่อมต่อไม่ได้) → หน้าเดโมส่งเข้าคิวรอเจ้าหน้าที่ตามเดิม
 * ผลที่ "สลิปไม่ผ่านจริง" (ยอด/ผู้รับไม่ตรง ปลอม ซ้ำ) คืน ok:false พร้อมเหตุผล
 */
export const runtime = 'nodejs';

const hits = new Map<string, number[]>();
const limited = (ip: string) => { // กันคนนอกยิงเปลืองโควตา: 8 ครั้ง/นาที/IP (ต่อ instance)
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now); hits.set(ip, list);
  return list.length > 8;
};
const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[^0-9.]/g, '')); return Number.isFinite(n) && n > 0 ? n : null; };
const pick = (o: any, paths: string[]) => { for (const p of paths) { const v = p.split('.').reduce((a: any, k) => (a == null ? a : a[k]), o); if (v != null && v !== '') return v; } return null; };
const key = (v: string) => String(v || '').replace(/^(นางสาว|น\.ส\.|นาย|นาง|บริษัท|องค์การบริหารส่วนตำบล|อบต\.?)/g, '').replace(/[\s.()\-]/g, '').toLowerCase();
const payeeLike = (a0: string, b0: string) => { const a = key(a0), b = key(b0); return !!a && !!b && (a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b))); };
const MSG: Record<string, string> = { '200404': 'ไม่พบสลิปในระบบธนาคาร', '200500': 'สลิปเสีย/ปลอม', '200501': 'สลิปซ้ำ', '200502': 'ธนาคารขัดข้อง ลองใหม่' };

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== '1') return NextResponse.json({ ok: false, unavailable: true, reason: 'ใช้ได้เฉพาะเดโม่' }, { status: 404 });
  const token = process.env.SLIP2GO_TOKEN;
  if (!token) return NextResponse.json({ ok: false, unavailable: true, reason: 'เดโมยังไม่ได้ตั้งโทเคน Slip2Go' });
  const ip = (req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim();
  if (limited(ip)) return NextResponse.json({ ok: false, unavailable: true, reason: 'ตรวจถี่เกินไป รอสักครู่' }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return NextResponse.json({ ok: false, unavailable: true, reason: 'ไฟล์สลิปไม่ถูกต้อง' }, { status: 400 });
  const amount = num(form?.get('amount'));
  const payee = String(form?.get('payee') || '');

  try {
    const fd = new FormData();
    fd.append('file', file, 'slip.jpg');
    const res = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
    const j: any = await res.json().catch(() => ({}));
    const code = String(j?.code ?? '');
    if (res.status === 401 || res.status === 403 || code.startsWith('401')) return NextResponse.json({ ok: false, unavailable: true, reason: 'โทเคน Slip2Go ไม่ถูกต้อง' });
    if (code !== '200000' && code !== '200200') {
      if (code === '200502' || !code) return NextResponse.json({ ok: false, unavailable: true, reason: MSG[code] || 'ตรวจสลิปไม่ได้ในขณะนี้' });
      return NextResponse.json({ ok: false, reason: `ตรวจสลิปไม่ผ่าน: ${MSG[code] || j?.message || code}` });
    }
    const d = j.data ?? {};
    const paid = num(pick(d, ['amount', 'amount.amount']));
    const transRef = pick(d, ['transRef', 'transReference', 'transactionRef', 'ref']);
    const receiver = pick(d, ['receiver.account.name', 'receiver.account.name.th', 'receiver.name']);
    if (!paid || !transRef) return NextResponse.json({ ok: false, reason: 'ตรวจสลิปไม่ผ่าน: อ่านยอดหรือเลขอ้างอิงจากสลิปไม่ได้' });
    if (amount != null && Math.abs(paid - amount) > 0.009) return NextResponse.json({ ok: false, reason: `ยอดในสลิป ${paid} บาท ไม่ตรงกับยอดที่ต้องชำระ ${amount} บาท` });
    if (payee && !(receiver && payeeLike(payee, String(receiver)))) return NextResponse.json({ ok: false, reason: 'บัญชีผู้รับในสลิปไม่ใช่บัญชีของ อบต.' });
    return NextResponse.json({ ok: true, reason: '', transRef: String(transRef), amount: paid });
  } catch {
    return NextResponse.json({ ok: false, unavailable: true, reason: 'เชื่อมต่อ Slip2Go ไม่ได้' });
  }
}
