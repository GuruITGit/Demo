#!/usr/bin/env node
/**
 * Smoke test ฟิลเตอร์รายการ + รูปแบบ error + เลขทะเบียนรับต่อปีงบ
 * (บั๊กที่พบตอนตรวจระบบ 25/07/2569 — ดู AGENTS.md)
 * ใช้: ให้ backend(4000)+DB รันอยู่ แล้ว `node scripts/smoke-filters.mjs`
 * ตัวแปร: API_BASE, ADMIN_PW
 */
const BASE = process.env.API_BASE || 'http://localhost:4000/v1';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓', m); } else { fail++; console.log('  ✗ FAIL:', m); } };

const api = async (method, path, token, body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
};
const total = (res) => res.data?.meta?.total ?? (res.data?.data?.items || res.data?.data || []).length;

(async () => {
  console.log('SMOKE: ฟิลเตอร์รายการ + error format + เลขทะเบียนต่อปีงบ\n');
  const admin = (await api('POST', '/auth/login', null, { username: 'admin', password: process.env.ADMIN_PW || 'ChangeMe@Local1' })).data?.data?.accessToken;
  if (!admin) { console.log('  ✗ login admin ไม่สำเร็จ (ตั้ง ADMIN_PW)'); process.exit(1); }

  console.log('1) ฟิลเตอร์ต้องกรองจริง (ค่าปลอมต้องได้ 0 / น้อยกว่าทั้งหมด)');
  const auditAll = total(await api('GET', '/audit/logs?limit=1', admin));
  const auditBogus = total(await api('GET', '/audit/logs?limit=1&action=NO_SUCH_ACTION', admin));
  const auditLogin = total(await api('GET', '/audit/logs?limit=1&action=LOGIN', admin));
  ok(auditBogus === 0, `audit action ปลอม → 0 (ได้ ${auditBogus}, ทั้งหมด ${auditAll})`);
  ok(auditLogin > 0 && auditLogin <= auditAll, `audit action=LOGIN → ${auditLogin} (<= ${auditAll})`);

  const auditModBogus = total(await api('GET', '/audit/logs?limit=1&module=no_such_module', admin));
  ok(auditModBogus === 0, `audit module ปลอม → 0 (ได้ ${auditModBogus})`);

  const hrAll = total(await api('GET', '/hr/employees?limit=1', admin));
  const hrBogus = total(await api('GET', '/hr/employees?limit=1&status=NO_SUCH_STATUS', admin));
  ok(hrBogus === 0, `hr status ปลอม → 0 (ได้ ${hrBogus}, ทั้งหมด ${hrAll})`);

  const projAll = total(await api('GET', '/projects?limit=1', admin));
  const proj2500 = total(await api('GET', '/projects?limit=1&fiscalYear=2500', admin));
  ok(proj2500 === 0, `projects ปีงบ 2500 → 0 (ได้ ${proj2500}, ทั้งหมด ${projAll})`);

  const meetBogus = total(await api('GET', '/meetings?limit=1&status=NO_SUCH', admin));
  ok(meetBogus === 0, `meetings status ปลอม → 0 (ได้ ${meetBogus})`);

  const leaveBogus = total(await api('GET', '/leave/requests?limit=1&status=NO_SUCH', admin));
  ok(leaveBogus === 0, `leave status ปลอม → 0 (ได้ ${leaveBogus})`);

  const notiAll = total(await api('GET', '/notifications?limit=1', admin));
  const notiUnread = total(await api('GET', '/notifications?limit=1&unreadOnly=true', admin));
  ok(notiUnread <= notiAll, `notifications unreadOnly=true → ${notiUnread} (<= ${notiAll})`);

  console.log('2) รูปแบบ error (frontend อ่าน error.message)');
  const bad = await api('POST', '/correspondence/tickets', admin, { subject: 'x' });
  ok(bad.status >= 400, `สร้างสารบรรณข้อมูลไม่ครบ → ${bad.status}`);
  ok(typeof bad.data?.error?.message === 'string' && bad.data.error.message.length > 0,
    `error.message มีข้อความ: "${bad.data?.error?.message}"`);

  console.log('3) เลขทะเบียนรับ: ซ้ำในปีงบเดียวกันไม่ได้ / ข้ามปีงบได้');
  const me = (await api('GET', '/auth/me', admin)).data;
  const org = (me.data || me).organizationId;
  const deptsRes = (await api('GET', `/organizations/${org}/departments`, admin)).data;
  const depts = deptsRes?.data || deptsRes || [];
  const deptId = depts[0]?.id;
  if (!deptId) { console.log('  (ข้าม — หากองไม่ได้)'); }
  else {
    const num = `TEST-${Date.now()}`;
    const base = { registerBook: 'R_MAIN', documentNumber: 'x/1', fromOrg: 'ทดสอบ', toPerson: 'ทดสอบ', departmentIds: [deptId] };
    const a = await api('POST', '/correspondence/tickets', admin, { ...base, subject: '[smoke] เลขปีนี้', receiveRegNumber: num, fiscalYear: 2569 });
    ok(a.status === 201, `สร้างเลข ${num} ปีงบ 2569 → ${a.status}`);
    const dup = await api('POST', '/correspondence/tickets', admin, { ...base, subject: '[smoke] เลขซ้ำปีเดียวกัน', receiveRegNumber: num, fiscalYear: 2569 });
    ok(dup.status === 400 && /ถูกใช้แล้ว/.test(dup.data?.error?.message || ''), `เลขซ้ำปีงบเดียวกัน → 400 "${dup.data?.error?.message}"`);
    const nextYear = await api('POST', '/correspondence/tickets', admin, { ...base, subject: '[smoke] เลขเดิมปีงบใหม่', receiveRegNumber: num, fiscalYear: 2570 });
    ok(nextYear.status === 201, `เลขเดิมแต่ปีงบ 2570 → ${nextYear.status} (ต้องสร้างได้)`);
    for (const t of [a, nextYear]) {
      const id = t.data?.data?.id; if (id) await api('DELETE', `/correspondence/tickets/${id}`, admin);
    }
    const reuse = await api('POST', '/correspondence/tickets', admin, { ...base, subject: '[smoke] ใช้เลขซ้ำหลังลบ', receiveRegNumber: num, fiscalYear: 2569 });
    ok(reuse.status === 201, `เลขของเรื่องที่ถูกลบแล้ว นำกลับมาใช้ได้ → ${reuse.status}`);
    const id = reuse.data?.data?.id; if (id) await api('DELETE', `/correspondence/tickets/${id}`, admin);
  }

  console.log(`\nผลรวม: ผ่าน ${pass} / ไม่ผ่าน ${fail}`);
  process.exit(fail ? 1 : 0);
})();
