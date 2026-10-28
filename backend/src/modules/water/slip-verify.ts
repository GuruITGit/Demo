/**
 * ตรวจสลิปโอนเงินกับผู้ให้บริการภายนอก (อ่าน QR บนสลิป → ยืนยันกับธนาคาร)
 * รองรับ EasySlip / SlipOK — คืนผลรูปแบบกลาง (normalized) ให้ service ใช้เทียบกับบิล
 *
 * ⚠️ ชื่อฟิลด์ใน response ของแต่ละเจ้าอาจปรับได้ — อ่านแบบ defensive (ลองหลายชื่อ)
 *    ถ้าต่อ key จริงแล้วค่าไม่มา ให้ดู raw ใน log แล้วปรับ pick() ให้ตรง
 */
export type SlipVerifyResult = {
  ok: boolean;
  amount: number | null;
  transRef: string | null;
  receiverName: string | null;
  receiverId: string | null;   // เลขบัญชี/พร้อมเพย์ปลายทาง (mask)
  error?: string;
  raw?: any;
};

const num = (v: any): number | null => {
  if (v == null) return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};
const pick = (obj: any, paths: string[]): any => {
  for (const p of paths) {
    const val = p.split('.').reduce((o: any, k) => (o == null ? o : o[k]), obj);
    if (val != null && val !== '') return val;
  }
  return null;
};

async function verifyEasySlip(token: string, image: Buffer, mime: string): Promise<SlipVerifyResult> {
  // EasySlip API v2 — POST /verify/bank (multipart field ชื่อ "image") · ข้อมูลสลิปซ้อนใน data.rawSlip
  const fd = new FormData();
  fd.append('image', new Blob([new Uint8Array(image)], { type: mime || 'image/jpeg' }), 'slip.jpg');
  fd.append('checkDuplicate', 'true');
  const res = await fetch('https://api.easyslip.com/v2/verify/bank', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || j.success !== true) {
    return { ok: false, amount: null, transRef: null, receiverName: null, receiverId: null,
      error: pick(j, ['error.message', 'error.code', 'message']) || `HTTP ${res.status}`, raw: j };
  }
  const d = j.data ?? {};
  const s = d.rawSlip ?? d;
  const amount = num(pick(s, ['amount.amount', 'amount']) ?? pick(d, ['amountInSlip']));
  const transRef = pick(s, ['transRef', 'transactionRef', 'ref']);
  return {
    ok: !!(amount && transRef),
    amount, transRef: transRef ? String(transRef) : null,
    receiverName: pick(s, ['receiver.account.name.th', 'receiver.account.name.en', 'receiver.account.name']),
    // รวมทุกเลขบัญชี/พร้อมเพย์ปลายทาง (bank + proxy) เพราะโอนพร้อมเพย์เลขจะอยู่ที่ proxy
    receiverId: [pick(s, ['receiver.account.proxy.account']), pick(s, ['receiver.account.bank.account'])].filter(Boolean).join(' ') || null,
    raw: d,
  };
}

async function verifySlipOk(token: string, image: Buffer, mime: string): Promise<SlipVerifyResult> {
  // SlipOK: token = "<branchId>:<apiKey>" (endpoint ต้องมี branch id)
  const [branchId, apiKey] = token.includes(':') ? token.split(':') : ['', token];
  const fd = new FormData();
  fd.append('files', new Blob([new Uint8Array(image)], { type: mime || 'image/jpeg' }), 'slip.jpg');
  fd.append('log', 'true');
  const res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
    method: 'POST', headers: { 'x-authorization': apiKey }, body: fd,
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok || j.success === false) return { ok: false, amount: null, transRef: null, receiverName: null, receiverId: null, error: pick(j, ['message', 'error']) || `HTTP ${res.status}`, raw: j };
  const d = j.data ?? j;
  const amount = num(pick(d, ['amount', 'transAmount']));
  const transRef = pick(d, ['transRef', 'transactionRef', 'ref']);
  return {
    ok: !!(amount && transRef),
    amount, transRef: transRef ? String(transRef) : null,
    receiverName: pick(d, ['receiverName', 'receiver.name', 'receiver.displayName']),
    receiverId: pick(d, ['receiverId', 'receiver.account', 'receiver.proxy']),
    raw: d,
  };
}

async function verifySlip2Go(token: string, image: Buffer, mime: string): Promise<SlipVerifyResult> {
  // slip2go: POST /api/verify-slip/qr-image/info · multipart field "file" · Auth Bearer
  // ตอบ HTTP 200 เสมอ แยกด้วย code: 200000=Slip found, 200200=valid (ผ่าน) · อื่น ๆ (200401/402/404/500/501)=ไม่ผ่าน
  const fd = new FormData();
  fd.append('file', new Blob([new Uint8Array(image)], { type: mime || 'image/jpeg' }), 'slip.jpg');
  const res = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
  });
  const j: any = await res.json().catch(() => ({}));
  const code = String(pick(j, ['code']) || '');
  const CODE_MSG: Record<string, string> = {
    '200401': 'บัญชีผู้รับไม่ตรง', '200402': 'ยอดโอนไม่ตรงเงื่อนไข', '200403': 'วันที่โอนไม่ตรง',
    '200404': 'ไม่พบสลิปในระบบธนาคาร', '200500': 'สลิปเสีย/ปลอม', '200501': 'สลิปซ้ำ', '200502': 'ธนาคารขัดข้อง ลองใหม่',
  };
  if (!res.ok || !(code === '200000' || code === '200200')) {
    return { ok: false, amount: null, transRef: null, receiverName: null, receiverId: null,
      error: CODE_MSG[code] || pick(j, ['message']) || `code ${code || res.status}`, raw: j };
  }
  const d = j.data ?? {};
  const amount = num(pick(d, ['amount', 'amount.amount']));
  const transRef = pick(d, ['transRef', 'transReference', 'transactionRef', 'ref']);
  return {
    ok: !!(amount && transRef),
    amount, transRef: transRef ? String(transRef) : null,
    receiverName: pick(d, ['receiver.account.name', 'receiver.account.name.th', 'receiver.name']),
    receiverId: [pick(d, ['receiver.account.proxy.account']), pick(d, ['receiver.account.bank.account'])].filter(Boolean).join(' ') || null,
    raw: d,
  };
}
/**
 * ตรวจสลิปโดยไล่ผู้ให้บริการทีละเจ้าตามลำดับ (เจ้าแรกโทเคนหมด/ล่ม → ใช้เจ้าถัดไปอัตโนมัติ)
 * แยก 2 กรณี:
 *  - เจ้านั้น "ใช้ไม่ได้" (token ผิด/โทเคนหมด/เน็ตล่ม) → ลองเจ้าถัดไป
 *  - เจ้านั้นตอบชัดว่า "สลิปไม่ผ่าน" (ปลอม/ซ้ำ/ยอดไม่ตรง/ไม่พบ) → หยุด ไม่ต้องถามเจ้าอื่น
 */
export async function verifySlipMulti(
  providers: { provider: string; token: string }[], image: Buffer, mime: string,
): Promise<SlipVerifyResult & { usedProvider?: string }> {
  const list = (providers || []).filter((p) => p?.provider && p?.token);
  if (!list.length) return { ok: false, amount: null, transRef: null, receiverName: null, receiverId: null, error: 'ยังไม่ได้ตั้งผู้ให้บริการตรวจสลิป' };
  // ข้อความที่แปลว่า "สลิปไม่ผ่านจริง ๆ" (ไม่ใช่ปัญหาของผู้ให้บริการ) → ไม่ต้องลองเจ้าอื่น
  const DEFINITIVE = /ปลอม|ซ้ำ|ไม่พบสลิป|ไม่ตรง|SLIP_NOT_FOUND|SLIP_PENDING/i;
  let last: SlipVerifyResult | null = null;
  for (const p of list) {
    const r = await verifySlip(p.provider, p.token, image, mime);
    if (r.ok) return { ...r, usedProvider: p.provider };
    last = r;
    if (r.error && DEFINITIVE.test(r.error)) return { ...r, usedProvider: p.provider };
    // ไม่ผ่านเพราะเจ้านี้ใช้ไม่ได้ → ลองเจ้าถัดไป
  }
  return { ...(last as SlipVerifyResult), usedProvider: list[list.length - 1].provider };
}

/** เรียกตรวจสลิปตามผู้ให้บริการที่ตั้งไว้ — โยน error ถ้า provider ไม่รองรับ */
export async function verifySlip(provider: string, token: string, image: Buffer, mime: string): Promise<SlipVerifyResult> {
  if (!token) return { ok: false, amount: null, transRef: null, receiverName: null, receiverId: null, error: 'ยังไม่ได้ตั้งค่า token ตรวจสลิป' };
  try {
    if (provider === 'easyslip') return await verifyEasySlip(token, image, mime);
    if (provider === 'slipok') return await verifySlipOk(token, image, mime);
    if (provider === 'slip2go') return await verifySlip2Go(token, image, mime);
    return { ok: false, amount: null, transRef: null, receiverName: null, receiverId: null, error: `ไม่รองรับผู้ให้บริการ "${provider}"` };
  } catch (e: any) {
    return { ok: false, amount: null, transRef: null, receiverName: null, receiverId: null, error: 'เชื่อมต่อบริการตรวจสลิปไม่ได้: ' + (e?.message || e) };
  }
}
