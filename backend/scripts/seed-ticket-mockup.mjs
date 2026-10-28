#!/usr/bin/env node
/**
 * สร้างข้อมูลสารบรรณ v4 จำลอง (mockup) หลายสถานะ — ไว้เทสหน้า /correspondence/tickets
 * (รายการ, แท็บ, ตัวกรอง, badge สถานะ/ชั้นความลับ) ด้วยข้อมูลที่หลากหลายกว่าสร้างเองทีละเรื่อง
 *
 * ใช้: ให้ backend(4000)+DB รันอยู่ แล้ว `node scripts/seed-ticket-mockup.mjs`
 * เลขทะเบียนขึ้นต้นด้วย "MOCK-" ทั้งหมด — ลบทิ้งทีหลังได้ง่ายผ่านปุ่ม "ลบ" ในหน้าเว็บ (admin)
 * admin ขับทุก step ได้ (isAdmin bypass actor check) เหมือน smoke-saraban-v4.mjs
 */
const BASE = process.env.API_BASE || 'http://localhost:4000/v1';
const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const api = async (method, path, token, body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const unwrap = (d) => d?.data ?? d;
const login = async (u, p) => unwrap((await api('POST', '/auth/login', null, { username: u, password: p })).data)?.accessToken;

const URGENCY = ['ปกติ', 'ด่วน', 'ด่วนมาก', 'ด่วนที่สุด'];
const SOURCES = [
  'ที่ทำการปกครองอำเภอโนนดินแดง', 'สำนักงานจังหวัดบุรีรัมย์',
  'โรงพยาบาลส่งเสริมสุขภาพตำบล', 'ประชาชนในพื้นที่', 'กรมส่งเสริมการปกครองท้องถิ่น',
];

const CASES = [
  { subject: 'ขอความร่วมมือสำรวจข้อมูลผู้สูงอายุในพื้นที่', confidentiality: 'ปกติ' },
  { subject: 'ขออนุมัติงบประมาณซ่อมแซมถนนสายบ้านโนนสูง', confidentiality: 'ปกติ' },
  { subject: 'แจ้งผลการตรวจสอบบ่อบาดาลสาธารณะ', confidentiality: 'ปกติ' },
  { subject: 'ขอเชิญประชุมคณะกรรมการพัฒนาท้องถิ่น', confidentiality: 'ปกติ' },
  { subject: 'รายงานผลการดำเนินงานโครงการส่งเสริมอาชีพ', confidentiality: 'ปกติ' },
  { subject: 'ขอความอนุเคราะห์รถบรรทุกน้ำช่วยภัยแล้ง', confidentiality: 'ปกติ' },
  { subject: 'แจ้งเตือนการชำระภาษีที่ดินและสิ่งปลูกสร้างประจำปี', confidentiality: 'ปกติ' },
  { subject: 'ขออนุญาตใช้สถานที่จัดงานประเพณีลอยกระทง', confidentiality: 'ปกติ' },
  { subject: 'รายงานการเกิดอุบัติเหตุทางถนนในพื้นที่', confidentiality: 'ลับ' },
  { subject: 'ขอรับการสนับสนุนเครื่องกรองน้ำสำหรับโรงเรียน', confidentiality: 'ปกติ' },
  { subject: 'แจ้งปัญหาไฟฟ้าสาธารณะดับในหมู่บ้าน', confidentiality: 'ปกติ' },
  { subject: 'ขอความเห็นชอบแผนพัฒนาท้องถิ่น 5 ปี', confidentiality: 'ปกติ' },
  { subject: 'รายงานผลการฉีดวัคซีนป้องกันโรคพิษสุนัขบ้า', confidentiality: 'ปกติ' },
  { subject: 'ขอสนับสนุนงบประมาณก่อสร้างฝายชะลอน้ำ', confidentiality: 'ปกติ' },
  { subject: 'เรื่องร้องเรียนการทุจริตจัดซื้อจัดจ้าง', confidentiality: 'ลับมาก' },
  { subject: 'ขอเชิญร่วมพิธีวางศิลาฤกษ์อาคารเอนกประสงค์', confidentiality: 'ปกติ' },
  { subject: 'รายงานความคืบหน้าการแก้ไขปัญหาขยะมูลฝอย', confidentiality: 'ปกติ' },
  { subject: 'ขอความร่วมมือป้องกันและควบคุมโรคไข้เลือดออก', confidentiality: 'ปกติ' },
];

// กระจาย 18 เคสไปครบทุกสถานะของ workflow v4 (เรียงตาม CASES ด้านบน)
const TARGET_STEP = [
  'PENDING_OWNER_HEAD', 'PENDING_OWNER_HEAD', 'PENDING_OWNER_HEAD', 'PENDING_OWNER_HEAD',
  'PENDING_OWNER_CLERK', 'PENDING_OWNER_CLERK',
  'PENDING_RELATED_HEAD', 'PENDING_RELATED_HEAD',
  'PENDING_RELATED_CLERK', 'PENDING_RELATED_CLERK',
  'PENDING_CLERK', 'PENDING_CLERK',
  'PENDING_MAYOR', 'PENDING_MAYOR',
  'COMPLETED', 'COMPLETED', 'COMPLETED',
  'RETURNED',
];
const ORDER = ['PENDING_OWNER_HEAD', 'PENDING_OWNER_CLERK', 'PENDING_RELATED_HEAD', 'PENDING_RELATED_CLERK', 'PENDING_CLERK', 'PENDING_MAYOR', 'COMPLETED'];

(async () => {
  console.log('สร้างข้อมูลสารบรรณจำลอง (mockup) สำหรับเทสหน้า /correspondence/tickets\n');
  const admin = await login(process.env.ADMIN_USER || process.env.INITIAL_ADMIN_USERNAME || 'admin', process.env.ADMIN_PW || process.env.INITIAL_ADMIN_PASSWORD || 'eeeeeeee');
  if (!admin) { console.error('ล็อกอิน admin ไม่ได้ — backend รันอยู่ไหม? / รหัสถูกไหม?'); process.exit(2); }

  const me = unwrap((await api('GET', '/auth/me', admin)).data);
  const org = me.organizationId;
  const depts = unwrap((await api('GET', `/organizations/${org}/departments`, admin)).data);
  const withHead = depts.filter((d) => d.headUserId);
  if (withHead.length < 2) {
    console.error(`ต้องมีอย่างน้อย 2 กองที่ตั้ง "หัวหน้ากอง" (headUserId) ไว้ก่อน — ตอนนี้มี ${withHead.length} กอง\nไปตั้งที่หน้า /settings หรือหน้าจัดการกองก่อน แล้วรันสคริปต์นี้ใหม่`);
    process.exit(3);
  }

  let n = 0;
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    const target = TARGET_STEP[i] || 'PENDING_OWNER_HEAD';
    const ownerDept = withHead[i % withHead.length];
    const relatedDept = withHead[(i + 1) % withHead.length];
    const urgency = URGENCY[i % URGENCY.length];
    const sourceOrg = SOURCES[i % SOURCES.length];

    const created = await api('POST', '/correspondence/tickets/v4', admin, {
      receiveRegNumber: `MOCK-${Date.now()}-${i}`,
      externalDocNumber: `บร ${1000 + i}/2569`,
      docDate: '2026-09-15',
      sourceOrg,
      subject: c.subject,
      recipient: 'นายกองค์การบริหารส่วนตำบล',
      body: `เอกสารทดสอบ (mockup) ลำดับที่ ${i + 1} — ${c.subject}`,
      urgencyLevel: urgency,
      confidentiality: c.confidentiality,
      purposes: ['เพื่อทราบ'],
      assignedHeadUserId: ownerDept.headUserId,
    });
    if (created.status !== 201) { console.log(`  ✗ สร้างเรื่อง #${i + 1} ไม่สำเร็จ:`, created.data); continue; }
    const id = unwrap(created.data).id;

    const advance = (type, extra) => api('POST', `/correspondence/tickets/${id}/v4/action`, admin, { type, ...extra });

    const targetIdx = target === 'RETURNED' ? 1 : ORDER.indexOf(target);
    if (targetIdx >= 1) await advance('owner_route', { relatedDeptId: relatedDept.id, relatedHeadUserId: relatedDept.headUserId, ownerClerkUserId: ownerDept.headUserId, note: 'มอบกองที่เกี่ยวข้อง' });
    if (targetIdx >= 2) await advance('sign_send', { signatureImage: SIG });
    if (targetIdx >= 3) await advance('sign_route', { signatureImage: SIG, relatedClerkUserId: relatedDept.headUserId });
    if (targetIdx >= 4) await advance('sign_register', { signatureImage: SIG, deptRegNumber: `กค-${100 + i}/2569` });
    if (targetIdx >= 5) await advance('sign_send', { signatureImage: SIG });
    if (targetIdx >= 6) await advance('sign_send', { signatureImage: SIG });

    if (target === 'RETURNED') {
      await api('POST', `/correspondence/tickets/${id}/v4/return`, admin, { note: 'ขอข้อมูลเพิ่มเติมก่อนดำเนินการต่อ' });
    }

    n++;
    console.log(`  ✓ #${i + 1} "${c.subject.slice(0, 32)}..." → ${target}`);
  }

  console.log(`\nสร้างเสร็จ ${n}/${CASES.length} เรื่อง — เข้าไปดูที่ http://localhost:3000/correspondence/tickets ได้เลย`);
})().catch((e) => { console.error('ERROR:', e); process.exit(2); });
