/**
 * อ่านไฟล์ทะเบียนผู้ใช้น้ำที่เจ้าหน้าที่อัปโหลด → แถวข้อมูลพร้อมบันทึก
 *
 * รองรับ .csv (จาก Excel) และ .json — ชื่อคอลัมน์ยืดหยุ่นทั้งไทย/อังกฤษ
 * เพราะไฟล์ที่ อบต. ส่งมาแต่ละครั้งหัวตารางไม่เหมือนกัน
 */

export type ImportRow = { customerCode: string; fullName: string; villageNo: number | null };
/** kind: skip = แถวนี้ไม่ถูกนำเข้า · warn = นำเข้าแล้วแต่มีบางค่าไม่สมบูรณ์ */
export type ImportIssue = { line: number; reason: string; raw?: string; kind: 'skip' | 'warn' };

const MAX_ROWS = 20000;

/**
 * แปลงไบต์เป็นข้อความไทย
 *
 * Excel บนวินโดวส์ไทยเซฟ CSV เป็น TIS-620/windows-874 ไม่ใช่ UTF-8 — เปิดตรงๆ ได้ต่างดาว
 * จึงลอง UTF-8 ก่อน ถ้าเจอ replacement char (U+FFFD) แปลว่าไม่ใช่ UTF-8 ค่อยถอดแบบ TIS-620
 * (ไม่ใช้ TextDecoder('windows-874') เพราะ Node บางบิลด์ตัด ICU ตัวเต็มออก)
 */
function decodeText(buf: Buffer): string {
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '');

  let out = '';
  for (const b of buf) {
    // 0xA1–0xFB คือช่วงอักษรไทยใน TIS-620 ตรงกับ U+0E01–U+0E5B แบบ offset คงที่
    out += b >= 0xa1 && b <= 0xfb ? String.fromCharCode(b - 0xa0 + 0x0e00) : String.fromCharCode(b);
  }
  return out.replace(/^﻿/, '');
}

/** แยก CSV ทีละบรรทัด รองรับค่าที่ครอบด้วย " และมีลูกน้ำ/ขึ้นบรรทัดข้างใน */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }   // "" ข้างใน = อัญประกาศจริง
        else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; }
    else if (c === ',' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

/** ชื่อคอลัมน์ที่ยอมรับ (ตัดช่องว่าง/จุด/ขีดออกก่อนเทียบ) */
const COL = {
  code: ['รหัส', 'รหัสผู้ใช้น้ำ', 'เลขที่ผู้ใช้น้ำ', 'ผู้ใช้น้ำเลขที่', 'เลขที่', 'code', 'customercode'],
  name: ['ชื่อ', 'ชื่อสกุล', 'ชื่อนามสกุล', 'ชื่อผู้ใช้น้ำ', 'ผู้ใช้น้ำ', 'name', 'fullname'],
  moo: ['หมู่', 'หมู่ที่', 'หมูที่', 'moo', 'village', 'villageno'],
};
const norm = (s: string) => s.trim().toLowerCase().replace(/[\s._\-]/g, '');
const matchCol = (header: string, list: string[]) => {
  const h = norm(header);
  return list.some((c) => h === norm(c)) || list.some((c) => h.startsWith(norm(c)));
};

/** "๑๒๓" / "1,234" → 1234 · คืน null ถ้าไม่ใช่ตัวเลข */
function toNumber(v: string): number | null {
  const arabic = v.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)));
  const n = Number(arabic.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function parseCustomerFile(buffer: Buffer, filename: string): { rows: ImportRow[]; issues: ImportIssue[] } {
  const text = decodeText(buffer);
  const issues: ImportIssue[] = [];
  const raw: { code: string; name: string; moo: string; line: number }[] = [];

  if (/\.json$/i.test(filename) || text.trimStart().startsWith('[')) {
    let json: any;
    try { json = JSON.parse(text); } catch { throw new Error('ไฟล์ JSON อ่านไม่ออก — รูปแบบไม่ถูกต้อง'); }
    if (!Array.isArray(json)) throw new Error('ไฟล์ JSON ต้องเป็น array ของรายชื่อ เช่น [{"code":"00169","name":"...","moo":1}]');
    json.forEach((r: any, i: number) => raw.push({
      code: String(r.code ?? r.customerCode ?? r.customer_code ?? r['รหัส'] ?? ''),
      name: String(r.name ?? r.fullName ?? r.full_name ?? r['ชื่อ'] ?? ''),
      moo: String(r.moo ?? r.villageNo ?? r.village_no ?? r['หมู่'] ?? ''),
      line: i + 1,
    }));
  } else {
    const table = parseCsv(text);
    if (!table.length) throw new Error('ไฟล์ว่าง');

    const header = table[0];
    const iCode = header.findIndex((h) => matchCol(h, COL.code));
    const iName = header.findIndex((h) => matchCol(h, COL.name));
    const iMoo = header.findIndex((h) => matchCol(h, COL.moo));

    if (iCode < 0 || iName < 0) {
      throw new Error(
        `หัวตารางต้องมีคอลัมน์ "รหัส" และ "ชื่อ" (พบ: ${header.filter(Boolean).join(', ') || '—'})`,
      );
    }
    table.slice(1).forEach((r, i) => raw.push({
      code: r[iCode] ?? '', name: r[iName] ?? '', moo: iMoo >= 0 ? (r[iMoo] ?? '') : '',
      line: i + 2,   // +2 = ข้ามหัวตาราง และนับบรรทัดเริ่มที่ 1 แบบที่ผู้ใช้เห็นใน Excel
    }));
  }

  if (raw.length > MAX_ROWS) throw new Error(`ไฟล์มี ${raw.length.toLocaleString()} แถว เกินครั้งละ ${MAX_ROWS.toLocaleString()} แถว`);

  const rows: ImportRow[] = [];
  const seen = new Map<string, number>();

  for (const r of raw) {
    const code = r.code.trim();
    const name = r.name.trim().replace(/\s+/g, ' ');
    const skip = (reason: string, raw?: string) => issues.push({ line: r.line, reason, raw, kind: 'skip' });

    if (!code && !name) continue;                                        // แถวว่างท้ายไฟล์
    if (!code) { skip('ไม่มีรหัสผู้ใช้น้ำ', name); continue; }
    if (!name) { skip('ไม่มีชื่อ', code); continue; }
    if (code.length > 20) { skip('รหัสยาวเกิน 20 ตัวอักษร', code); continue; }
    if (name.length > 200) { skip('ชื่อยาวเกิน 200 ตัวอักษร', code); continue; }

    const dup = seen.get(code);
    if (dup) { skip(`รหัสซ้ำกับบรรทัดที่ ${dup} ในไฟล์เดียวกัน`, `${code} ${name}`); continue; }
    seen.set(code, r.line);

    const m = r.moo.trim() ? toNumber(r.moo) : null;
    const villageNo = m !== null && m >= 1 && m <= 99 ? Math.trunc(m) : null;
    // อ่านหมู่ไม่ออกไม่ใช่เหตุให้ทิ้งทั้งแถว — ชื่อกับรหัสยังใช้ออกหนังสือได้ แค่เตือนไว้
    if (r.moo.trim() && villageNo === null) {
      issues.push({ line: r.line, reason: `หมู่ "${r.moo.trim()}" ไม่ใช่ตัวเลข — บันทึกโดยไม่ระบุหมู่`, raw: code, kind: 'warn' });
    }

    rows.push({ customerCode: code, fullName: name, villageNo });
  }

  return { rows, issues };
}
