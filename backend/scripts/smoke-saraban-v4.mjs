#!/usr/bin/env node
/**
 * Smoke test สารบรรณ (ส่งต่อแบบไดนามิก — migration 1700000069000)
 * ทุกขั้นต้องลาก "ลายเซ็นของฉัน" ไปวางบนเอกสาร (overlay_layout) ก่อนส่ง — สคริปต์วางให้ก่อนกดส่งทุกครั้ง
 * ใช้: ให้ backend(4000)+DB รันอยู่ แล้ว `node scripts/smoke-saraban-v4.mjs`
 * ต้องมีบัญชี seed: admin, dir_finance, dir_eng, dir_health, clerk, mayor
 *   รหัส admin = ADMIN_PW / INITIAL_ADMIN_PASSWORD · คนอื่น = SEED_DEMO_PASSWORD (ค่า fallback ของ seed)
 */
const BASE = process.env.API_BASE || 'http://localhost:4000/v1';
const SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const DEMO_PW = process.env.SEED_DEMO_PASSWORD || 'ChangeMe@Local1';
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
const unwrap = (d) => d?.data ?? d;
const loginFull = async (u, p) => unwrap((await api('POST', '/auth/login', null, { username: u, password: p })).data);

(async () => {
  console.log('SMOKE สารบรรณ: ส่งต่อแบบไดนามิก + เซ็นทุกการส่ง + ตีกลับ + สิทธิ์\n');
  const A = await loginFull('admin', process.env.ADMIN_PW || process.env.INITIAL_ADMIN_PASSWORD || 'eeeeeeee');
  if (!A?.accessToken) { console.error('ล็อกอิน admin ไม่ได้ — backend รันอยู่ไหม? / รหัสถูกไหม?'); process.exit(2); }
  const accts = {};
  for (const u of ['dir_finance', 'dir_eng', 'dir_health', 'clerk', 'mayor']) {
    accts[u] = await loginFull(u, DEMO_PW);
    if (!accts[u]?.accessToken) { console.error(`ล็อกอิน ${u} ไม่ได้ — ต้องมีบัญชี seed`); process.exit(3); }
  }
  const admin = A.accessToken;
  const [fin, eng, health, clerk, mayor] = ['dir_finance', 'dir_eng', 'dir_health', 'clerk', 'mayor'].map((u) => accts[u]);
  // วางลายเซ็นของผู้กดลงบนเอกสาร (เก็บของคนอื่นไว้ครบ) — ไม่ใช่ผู้ถือเรื่องจะได้ 403 ซึ่งไม่เป็นไรสำหรับเคสที่คาดว่าส่งไม่ได้
  const uidOf = new Map([[admin, A.user.id], ...[fin, eng, health, clerk, mayor].map((x) => [x.accessToken, x.user.id])]);
  const sigItem = (uid) => ({ id: `sig-${uid}`, type: 'signature', page: 0, x: 10, y: 10, w: 20, h: 8, props: { ownerId: uid, sig: SIG } });
  const signDoc = async (tok, id) => {
    const uid = uidOf.get(tok);
    const cur = unwrap((await api('GET', `/correspondence/tickets/${id}`, tok)).data)?.overlayLayout;
    const items = (cur?.items || []).filter((it) => it.id !== `sig-${uid}`);
    return api('PATCH', `/correspondence/tickets/${id}/v4/overlay`, tok, { layout: { version: 2, pages: [{ src: 'blank' }], items: [...items, sigItem(uid)] } });
  };
  const rawAct = (tok, id, body) => api('POST', `/correspondence/tickets/${id}/v4/action`, tok, body);
  const act = async (tok, id, body) => { await signDoc(tok, id); return rawAct(tok, id, body); };
  const back = (tok, id, body) => api('POST', `/correspondence/tickets/${id}/v4/return`, tok, body);
  const get = (tok, id) => api('GET', `/correspondence/tickets/${id}`, tok);
  const base = (extra) => ({
    receiveRegNumber: `SMK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    externalDocNumber: 'บร 0023.1/9999', docDate: '2026-08-10', sourceOrg: 'อำเภอโนนดินแดง',
    subject: 'SMOKE สารบรรณไดนามิก', recipient: 'นายก อบต.', body: 'ทดสอบ', purposes: ['เพื่อทราบ'], urgencyLevel: 'ด่วน',
    overlayLayout: { version: 2, pages: [{ src: 'blank' }], items: [sigItem(A.user.id)] },
    ...extra,
  });

  console.log('1) สร้างเรื่อง — ต้องเซ็น + ต้องเลือกผู้รับ');
  ok((await api('POST', '/correspondence/tickets/v4', admin, base({ toUserId: fin.user.id }))).status === 400, 'ไม่เซ็น → 400');
  ok((await api('POST', '/correspondence/tickets/v4', admin, base({ signatureImage: SIG }))).status === 400, 'ไม่เลือกผู้รับ → 400');
  ok((await api('POST', '/correspondence/tickets/v4', admin, base({ signatureImage: SIG, toUserId: fin.user.id, overlayLayout: undefined }))).status === 400, 'ไม่ได้ลากลายเซ็นบนเอกสาร → 400');
  const created = await api('POST', '/correspondence/tickets/v4', admin, base({ signatureImage: SIG, toUserId: fin.user.id }));
  ok(created.status === 201, 'สร้าง + เซ็น + ส่ง ผอ.กองคลัง → 201');
  const c = unwrap(created.data);
  const id = c.id;
  ok(c.currentStep === 'PENDING_PERSON' && c.currentHolderUserId === fin.user.id, 'ขั้น = PENDING_PERSON · ผู้ถือ = ผอ.กองคลัง');
  ok(typeof c.statusLabel === 'string' && c.statusLabel.includes(fin.user.fullNameTh), `statusLabel = "${c.statusLabel}"`);
  ok((c.stepSignatures || []).length === 1, 'ลายเซ็นผู้ลงรับถูกบันทึก (1)');

  console.log('2) กล่องงาน "รอฉัน"');
  const todoFin = unwrap((await api('GET', '/correspondence/tickets/inbox?box=todo&limit=100', fin.accessToken)).data);
  const inFin = (todoFin?.items || todoFin || []).some?.((t) => t.id === id);
  ok(inFin, 'อยู่ใน "รอฉัน" ของผู้ถือเรื่อง');

  console.log('3) ส่งต่อ — เฉพาะผู้ถือเรื่อง + ต้องเซ็น');
  ok((await act(eng.accessToken, id, { type: 'forward', signatureImage: SIG, toClerk: true })).status === 403, 'คนที่ไม่ใช่ผู้ถือเรื่องส่งต่อ → 403');
  ok((await rawAct(fin.accessToken, id, { type: 'forward', signatureImage: SIG, toUserId: eng.user.id })).status === 400, 'ยังไม่ได้วางลายเซ็นบนเอกสาร → 400');
  ok((await signDoc(eng.accessToken, id)).status === 403, 'คนที่ไม่ใช่ผู้ถือเรื่องแก้เอกสาร → 403');
  ok((await act(fin.accessToken, id, { type: 'forward', toUserId: eng.user.id })).status === 400, 'ไม่เซ็นแล้วส่ง → 400');
  ok((await act(fin.accessToken, id, { type: 'forward', signatureImage: SIG, toUserId: fin.user.id })).status === 400, 'ส่งให้ตัวเอง → 400');
  ok((await act(fin.accessToken, id, { type: 'sign_send', signatureImage: SIG })).status === 400, 'ผู้ถือเรื่องทั่วไปส่งนายกไม่ได้ (sign_send) → 400');
  const f1 = await act(fin.accessToken, id, { type: 'forward', signatureImage: SIG, toUserId: eng.user.id, note: 'ส่งกองช่างดำเนินการ', deptRegNumber: 'กค-001/2569' });
  ok(f1.status === 201 && unwrap(f1.data).currentHolderUserId === eng.user.id, 'ผอ.คลัง เซ็น → ส่งต่อ ผอ.กองช่าง (กองอื่น)');
  ok(unwrap(f1.data).deptRegNumber === 'กค-001/2569', 'เลขทะเบียนรับกอง (ไม่บังคับ) ถูกบันทึก');
  ok((await get(eng.accessToken, id)).status === 200, 'ผอ.กองช่าง (ผู้รับ) เปิดดูเรื่องได้');
  ok((await get(health.accessToken, id)).status !== 200, 'กองที่ไม่เกี่ยว (สาธารณสุข) เปิดดูไม่ได้');
  ok((await signDoc(fin.accessToken, id)).status === 403, 'ส่งต่อไปแล้ว → แก้เอกสารไม่ได้ (ดูอย่างเดียว)');
  const noFinSig = { version: 2, pages: [{ src: 'blank' }], items: [sigItem(A.user.id), sigItem(eng.user.id)] };
  ok((await api('PATCH', `/correspondence/tickets/${id}/v4/overlay`, eng.accessToken, { layout: noFinSig })).status === 400, 'ลบลายเซ็นของคนอื่น → 400');

  console.log('4) ส่งปลัด → ปลัดทำได้แค่ส่งนายก / ตีกลับ');
  const f2 = await act(eng.accessToken, id, { type: 'forward', signatureImage: SIG, toClerk: true });
  ok(unwrap(f2.data).currentStep === 'PENDING_CLERK', 'ผอ.กองช่าง เซ็น → ส่งปลัด');
  ok((await act(clerk.accessToken, id, { type: 'forward', signatureImage: SIG, toUserId: fin.user.id })).status === 400, 'ปลัดส่งต่อให้กองไม่ได้ → 400');
  ok((await back(health.accessToken, id, { note: 'x' })).status === 403, 'คนไม่เกี่ยวตีกลับ → 403');
  const b1 = await back(clerk.accessToken, id, { note: 'แก้ไขเอกสาร' });
  ok(unwrap(b1.data).currentStep === 'PENDING_PERSON' && unwrap(b1.data).currentHolderUserId === eng.user.id, 'ปลัดตีกลับ → กลับไปหาผู้ส่ง (ผอ.กองช่าง)');
  await act(eng.accessToken, id, { type: 'forward', signatureImage: SIG, toClerk: true });
  ok((await act(clerk.accessToken, id, { type: 'sign_send' })).status === 400, 'ปลัดไม่เซ็น → 400');
  const s1 = await act(clerk.accessToken, id, { type: 'sign_send', signatureImage: SIG });
  ok(unwrap(s1.data).currentStep === 'PENDING_MAYOR', 'ปลัดเซ็น → ส่งนายก');

  console.log('5) นายก ตีกลับปลัด / ลงนามปิดงาน');
  const b2 = await back(mayor.accessToken, id, { note: 'ขอข้อมูลเพิ่ม' });
  ok(unwrap(b2.data).currentStep === 'PENDING_CLERK', 'นายกตีกลับ → ปลัด');
  await act(clerk.accessToken, id, { type: 'sign_send', signatureImage: SIG });
  const done = await act(mayor.accessToken, id, { type: 'sign_send', signatureImage: SIG });
  ok(unwrap(done.data).currentStep === 'COMPLETED', 'นายกเซ็น → เสร็จสิ้น');
  ok((await back(mayor.accessToken, id, { note: 'x' })).status === 400, 'ตีกลับเรื่องที่เสร็จแล้ว → 400');
  const tl = unwrap((await get(admin, id)).data)?.timeline || [];
  ok(tl.length >= 9, `ไทม์ไลน์ครบ (${tl.length} รายการ)`);

  console.log('6) ส่งปลัดตรงตอนสร้าง + ส่งกลับผู้ลงรับ');
  const d2 = unwrap((await api('POST', '/correspondence/tickets/v4', admin, base({ signatureImage: SIG, toClerk: true }))).data);
  ok(d2?.currentStep === 'PENDING_CLERK', 'สร้างแล้วส่งปลัดตรง');
  const d3 = unwrap((await api('POST', '/correspondence/tickets/v4', admin, base({ signatureImage: SIG, toUserId: fin.user.id }))).data);
  await act(fin.accessToken, d3.id, { type: 'forward', signatureImage: SIG, toUserId: eng.user.id });
  const toC = await back(eng.accessToken, d3.id, { note: 'ไม่เกี่ยวข้องกับตน', toCreator: true });
  ok(unwrap(toC.data).currentHolderUserId === A.user.id, 'ส่งกลับผู้ลงรับ → ผู้ถือ = คนสร้าง');

  console.log('7) เรื่องชั้นลับ — ผู้รับต่อกองเห็นได้ กองอื่นไม่เห็น');
  const sec = unwrap((await api('POST', '/correspondence/tickets/v4', admin, base({ signatureImage: SIG, toUserId: fin.user.id, confidentiality: 'ลับ' }))).data);
  await act(fin.accessToken, sec.id, { type: 'forward', signatureImage: SIG, toUserId: eng.user.id });
  ok((await get(eng.accessToken, sec.id)).status === 200, 'ผู้รับ (กองช่าง) เปิดเรื่องลับได้');
  ok((await get(health.accessToken, sec.id)).status !== 200, 'กองสาธารณสุขเปิดเรื่องลับไม่ได้');

  console.log(`\nรวม: ผ่าน ${pass} · ล้มเหลว ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
