#!/usr/bin/env node
/**
 * Smoke test โมดูลน้ำประปา — ทะเบียนผู้ใช้น้ำ + หนังสือแจ้งค้างชำระ
 * ใช้: ให้ backend(4000)+DB รันอยู่ แล้ว `ADMIN_PW=... node scripts/smoke-water-notice.mjs`
 * ข้อมูลที่สร้างระหว่างเทสจะถูกลบทิ้งเมื่อจบ
 */
const BASE = process.env.API_BASE || 'http://localhost:4000/v1';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };
const api = async (m, p, t, b) => {
  const r = await fetch(BASE + p, {
    method: m,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
    body: b ? JSON.stringify(b) : undefined,
  });
  let d = null; try { d = await r.json(); } catch {}
  return { status: r.status, data: d };
};

(async () => {
  console.log('SMOKE: น้ำประปา — ทะเบียน + หนังสือแจ้งค้างชำระ\n');
  const admin = (await api('POST', '/auth/login', null, { username: 'admin', password: process.env.ADMIN_PW })).data?.data?.accessToken;
  if (!admin) { console.log('  ✗ login ไม่สำเร็จ (ตั้ง ADMIN_PW)'); process.exit(1); }

  console.log('1) ทะเบียนผู้ใช้น้ำ');
  const villages = (await api('GET', '/water/customers/villages', admin)).data?.data || [];
  ok(villages.length >= 13, `มี ${villages.length} หมู่ (ลำนางรอง 13 หมู่ ไม่มีหมู่ 3)`);
  ok(!villages.some((v) => v.villageNo === 3), 'ไม่มีหมู่ 3 (ตรงกับพื้นที่จริง)');

  const all = await api('GET', '/water/customers?limit=1', admin);
  ok(all.data?.meta?.total > 2000, `ผู้ใช้น้ำทั้งหมด ${all.data?.meta?.total} ราย`);

  const found = (await api('GET', '/water/customers?search=00169', admin)).data?.data || [];
  ok(found[0]?.fullName === 'นางทองสา คำเกิด' && found[0]?.villageNo === 10,
    `ค้นรหัส 00169 → ${found[0]?.fullName} หมู่ ${found[0]?.villageNo} (ตรงกับแบบฟอร์มจริงของ อบต.)`);

  const byName = (await api('GET', `/water/customers?search=${encodeURIComponent('ทองสา')}`, admin)).data?.data || [];
  ok(byName.length > 0, `ค้นด้วยชื่อบางส่วน "ทองสา" → เจอ ${byName.length} ราย`);

  const m10 = await api('GET', '/water/customers?villageNo=10&limit=1', admin);
  ok(m10.data?.meta?.total > 0 && m10.data.meta.total < all.data.meta.total,
    `กรองหมู่ 10 → ${m10.data?.meta?.total} ราย (น้อยกว่าทั้งหมด)`);

  console.log('\n2) ออกหนังสือแจ้งค้างชำระ');
  const cust = found[0];
  const base = {
    noticeDate: '2026-07-15',
    customerId: cust.id, customerCode: cust.customerCode, fullName: cust.fullName, villageNo: cust.villageNo,
    periodMonth: 6, periodYear: 2569, amount: 101,
  };

  // เลขที่หนังสือมาจากทะเบียนส่งของ อบต. — ไม่กรอกต้องออกหนังสือได้ แล้วเว้นว่างไว้ในกระดาษ
  const created = await api('POST', '/water/notices', admin, base);
  const n = created.data?.data;
  ok(created.status === 201, 'ออกหนังสือโดยไม่ระบุเลขที่ได้');
  ok(n?.docNumber === null, `ไม่กรอกเลขที่ → เก็บเป็นค่าว่าง (ได้ ${JSON.stringify(n?.docNumber)})`);
  ok(n?.amountText === 'หนึ่งร้อยเอ็ดบาทถ้วน',
    `จำนวนเงินเป็นตัวอักษร: "${n?.amountText}" (ต้องเป็น "หนึ่งร้อยเอ็ดบาทถ้วน" ตามแบบฟอร์มจริง)`);
  ok(String(n?.noticeDate).startsWith('2026-07-15'), `วันที่หนังสือ ${n?.noticeDate}`);
  ok(Number(n?.amount) === 101, `ยอด ${n?.amount} บาท`);

  const withNo = await api('POST', '/water/notices', admin, { ...base, docNumber: 9142 });
  ok(withNo.data?.data?.docNumber === 9142,
    `กรอกเลขที่เอง → ได้ ${withNo.data?.data?.docNumber}/${withNo.data?.data?.docYear}`);

  const dupNo = await api('POST', '/water/notices', admin, { ...base, docNumber: 9142 });
  ok(dupNo.status === 409, `เลขที่ซ้ำในปีเดียวกัน → ${dupNo.status} "${dupNo.data?.error?.message || ''}"`);

  const badAmount = await api('POST', '/water/notices', admin, {
    noticeDate: '2026-07-15', customerCode: cust.customerCode, fullName: cust.fullName,
    periodMonth: 6, periodYear: 2569, amount: 0,
  });
  ok(badAmount.status === 400, 'ยอด 0 บาท ออกหนังสือไม่ได้');

  const badMonth = await api('POST', '/water/notices', admin, {
    noticeDate: '2026-07-15', customerCode: cust.customerCode, fullName: cust.fullName,
    periodMonth: 13, periodYear: 2569, amount: 50,
  });
  ok(badMonth.status === 400, 'เดือนที่ 13 ออกหนังสือไม่ได้');

  console.log('\n3) อ่านย้อนหลัง / พิมพ์ซ้ำ');
  const one = (await api('GET', `/water/notices/${n.id}`, admin)).data?.data;
  ok(one?.amountText === n.amountText, 'เปิดดูซ้ำได้ข้อความจำนวนเงินเดิม (พิมพ์ซ้ำแล้วเหมือนเดิม)');
  ok(one?.fullName === cust.fullName, 'ชื่อผู้รับถูกเก็บเป็น snapshot ในตัวหนังสือ');

  const list = await api('GET', '/water/notices?periodMonth=6&periodYear=2569', admin);
  ok((list.data?.data || []).some((x) => x.id === n.id), 'กรองตามเดือน/ปี แล้วเจอหนังสือที่เพิ่งออก');

  const summary = (await api('GET', '/water/notices/summary', admin)).data?.data;
  ok(summary?.totals?.total >= 1, `สรุปรวม ${summary?.totals?.total} ฉบับ · ${summary?.totals?.amount} บาท`);

  console.log('\n4) ไฟล์ PDF (เรนเดอร์ที่ server ให้ได้กระดาษเหมือนกันทุกเครื่อง)');
  const pdfRes = await fetch(BASE + `/water/notices/${n.id}/pdf`, { headers: { Authorization: 'Bearer ' + admin } });
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  ok(pdfRes.status === 200 && pdfRes.headers.get('content-type') === 'application/pdf',
    `ได้ไฟล์ PDF (${pdfRes.status}, ${Math.round(pdfBuf.length / 1024)} KB)`);
  ok(pdfBuf.subarray(0, 4).toString() === '%PDF', 'ไฟล์ที่ได้เป็น PDF จริง');
  // หนังสือ 1 ฉบับต้องพิมพ์ลงกระดาษแผ่นเดียว ไม่ล้นไปหน้า 2
  const pages = (pdfBuf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok(pages === 1, `เอกสารมี ${pages} หน้า (ต้องพอดี 1 หน้า)`);

  console.log('\n5) ล้างข้อมูลทดสอบ');
  await api('DELETE', `/water/notices/${withNo.data?.data?.id}`, admin);
  const del = await api('DELETE', `/water/notices/${n.id}`, admin);
  ok(del.status === 200, `ลบหนังสือทดสอบแล้ว — ${del.data?.data?.message}`);
  const gone = await api('GET', `/water/notices/${n.id}`, admin);
  ok(gone.status === 404, 'เปิดหนังสือที่ลบแล้วไม่ได้');

  console.log(`\nสรุป: ผ่าน ${pass} / ล้มเหลว ${fail}`);
  process.exit(fail ? 1 : 0);
})();
