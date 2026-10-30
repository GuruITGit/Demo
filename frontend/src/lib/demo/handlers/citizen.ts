/**
 * เรื่องแจ้ง/ร้องเรียนจากประชาชน (พอร์ทัลสาธารณะ) + หน้าคัดกรองของเจ้าหน้าที่
 * ขั้นตอนอนุมัติ 3 ผู้เซ็น: ส่งไปกอง → ผอ.กอง → ปลัด → นายก (เซ็นด้วยลายเซ็นที่ลากวางบนเอกสารของเรื่อง)
 */
import {
  get, post, patch, del, registerSeed, paginate, uid, nowIso, byId, removeById, userBrief, badRequest, forbidden, notFound, Raw, formToRow, blobUrl,
  type Ctx, type Db, type Row,
} from '../core';
import { ORG_ID } from '../seed-base';
import { isAdmin, needPerm, notify, rolesOf } from './base';
import { composeOverlayPdf, thaiPdf } from '../pdf';

const DAY = 86400000;
const ago = (days: number, hour = 9) => { const d = new Date(Date.now() - days * DAY); d.setHours(hour, 15, 0, 0); return d.toISOString(); };
const roleNames = (db: Db, u: Row) => rolesOf(db, u.id).map((r) => r.name);
const hasAnyRole = (db: Db, u: Row, ...n: string[]) => roleNames(db, u).some((r) => n.includes(r));
const roleHolder = (db: Db, ...names: string[]) => {
  for (const n of names) { const r = db.userRoles.find((x) => db.roles.find((y) => y.id === x.roleId)?.name === n); if (r) return r.userId as string; }
  return null;
};
const refYear = () => String(new Date().getFullYear() + 543).slice(-2);

const SEEDS: { category: string; subject?: string; detail: string; name: string; phone: string; village: number; location: string; status: string; age: number; dept?: string; stage?: number; note?: string }[] = [
  { category: 'เรื่องทั่วไป', subject: 'ขอให้ซ่อมถนนหน้าโรงเรียน', detail: 'ถนนหน้าโรงเรียนชำรุดเป็นหลุมขนาดใหญ่ รถสัญจรไม่ปลอดภัย ขอให้ดำเนินการซ่อมแซมโดยเร็ว', name: 'นายสุพจน์ ใจดี', phone: '0812345601', village: 3, location: 'ถนนสายหลัก หน้าโรงเรียนบ้านหนองไผ่', status: 'in_progress', age: 6, dept: 'ENGINEERING', stage: 1 },
  { category: 'ขอใช้บริการรถส่งผู้ป่วย', detail: 'ขอใช้รถส่งผู้ป่วยไปโรงพยาบาลวันที่ 5 เวลา 8.00 น. ผู้ป่วยเดินไม่ได้', name: 'นางสมพร รักบ้าน', phone: '0812345602', village: 5, location: 'บ้านเลขที่ 22 หมู่ 5', status: 'new', age: 0 },
  { category: 'เรื่องทั่วไป', subject: 'แจ้งไฟฟ้าส่องสว่างดับ', detail: 'ไฟส่องสว่างริมถนนหมู่ 2 ดับหลายจุด ทำให้เส้นทางมืด เสี่ยงต่ออุบัติเหตุ', name: 'นายประสิทธิ์ มั่นคง', phone: '0812345603', village: 2, location: 'ถนนเข้าหมู่บ้าน หมู่ 2', status: 'new', age: 1 },
  { category: 'ขอใช้บริการรถแจกน้ำ', detail: 'ขอรถแจกน้ำอุปโภคบริโภค เนื่องจากบ่อน้ำประจำหมู่บ้านแห้ง', name: 'นางบุญเรือน สายทอง', phone: '0812345604', village: 6, location: 'ศาลาประชาคม หมู่ 6', status: 'in_progress', age: 3, dept: 'HEALTH', stage: 0 },
  { category: 'อื่นๆ', detail: 'มีสุนัขจรจัดรวมฝูงบริเวณตลาดสด ขอให้เจ้าหน้าที่เข้าจัดการ', name: 'นายวิชัย ผักสด', phone: '0812345605', village: 1, location: 'ตลาดสดประจำตำบล', status: 'in_progress', age: 9, dept: 'HEALTH', stage: 2 },
  { category: 'เรื่องทั่วไป', subject: 'ขอให้ขุดลอกคูระบายน้ำ', detail: 'ฝนตกน้ำท่วมขังหน้าบ้านหลายวัน ขอให้ขุดลอกคูระบายน้ำ', name: 'นางมะลิ แสงทอง', phone: '0812345606', village: 4, location: 'ซอยข้างวัด หมู่ 4', status: 'done', age: 20, dept: 'ENGINEERING', stage: 3, note: 'กองช่างขุดลอกคูระบายน้ำเรียบร้อยแล้ว' },
  { category: 'ขอใช้บริการรถกู้ภัย', detail: 'ขอรถกู้ภัยไปงานกีฬาประจำหมู่บ้าน วันเสาร์นี้', name: 'นายธนพล วงศ์ษา', phone: '0812345607', village: 2, location: 'สนามกีฬาหมู่ 2', status: 'done', age: 25, stage: 3, note: 'จัดรถกู้ภัยประจำจุดตามที่ขอ' },
  { category: 'เรื่องทั่วไป', subject: 'ขอตัดต้นไม้ใหญ่ริมถนน', detail: 'ต้นไม้ริมถนนกิ่งหักใกล้สายไฟ เสี่ยงอันตราย', name: 'นางอำไพ บุญรอด', phone: '0812345608', village: 3, location: 'ริมถนนสายหลัก หมู่ 3', status: 'rejected', age: 12, note: 'อยู่ในเขตทางหลวง ให้แจ้งแขวงทางหลวงชนบท' },
  { category: 'อื่นๆ', detail: 'ขอเสนอแนะให้เพิ่มจุดทิ้งขยะอันตรายในหมู่บ้าน', name: 'นางสาวกัญญา พิมพ์ดี', phone: '0812345609', village: 5, location: '-', status: 'new', age: 2 },
];

registerSeed((db) => {
  db.citizenReports = [];
  db.citizenReportComments = [];
  SEEDS.forEach((s, i) => {
    const dept = s.dept ? db.departments.find((d) => d.id === `dept-${s.dept}`) : null;
    const stage = s.stage ?? -1; // 0=ส่งกองแล้ว 1=ผอ.เซ็น 2=ปลัดเซ็น 3=นายกเซ็น
    const at = (h: number) => new Date(new Date(ago(s.age)).getTime() + h * 3600_000).toISOString();
    db.citizenReports.push({
      id: uid(), organizationId: ORG_ID, refNo: `R${refYear()}-${String(i + 1).padStart(5, '0')}`, category: s.category, title: null, subject: s.subject ?? null, detail: s.detail,
      reporterName: s.name, reporterPhone: s.phone, location: s.location, villageNo: s.village, geo: null, answers: { titlePrefix: 'นาย', houseNo: String(10 + i) }, files: [], photoUrl: null,
      status: s.status, staffNote: s.note ?? null, targetDeptId: dept?.id ?? null, formKey: null, formTitle: null, createdAt: ago(s.age), updatedAt: ago(Math.max(0, s.age - 1)),
      deptHeadSignedBy: stage >= 1 ? dept?.headUserId : null, deptHeadSignedAt: stage >= 1 ? at(5) : null,
      clerkSignedBy: stage >= 2 ? roleHolder(db, 'CLERK') : null, clerkSignedAt: stage >= 2 ? at(9) : null,
      mayorSignedBy: stage >= 3 ? roleHolder(db, 'MAYOR') : null, mayorSignedAt: stage >= 3 ? at(20) : null, docLayout: null, petitionCheckedAt: null,
    });
  });
  const first = db.citizenReports[0];
  db.citizenReportComments.push({ id: uid(), reportId: first.id, userId: 'user-head_admin', body: 'ฝากกองช่างลงพื้นที่ตรวจสอบความเสียหายและประเมินงบซ่อม', createdAt: ago(5) });
});

// ───────────── ตัวช่วย ─────────────
const view = (db: Db, r: Row): Row => {
  const dept = db.departments.find((d) => d.id === r.targetDeptId);
  return {
    ...r, docLayout: undefined, photoUrl: blobUrl(r.photoUrl), files: (r.files ?? []).map((f: Row) => ({ ...f, url: blobUrl(f.url) })),
    targetDept: dept && { id: dept.id, nameTh: dept.nameTh, headUserId: dept.headUserId },
  };
};
const nextRef = (db: Db) => `R${refYear()}-${String(db.citizenReports.filter((r) => r.refNo.startsWith(`R${refYear()}-`)).length + 1).padStart(5, '0')}`;
const digits = (s?: string | null) => String(s ?? '').replace(/\D/g, '');
const REPORT_STATUSES = ['new', 'in_progress', 'done', 'rejected'];

// ───────────── ประชาชน (สาธารณะ) ─────────────
post('/citizen/report', async (c) => {
  const f = await formToRow(c.body);
  if (!f.category?.trim() || !f.detail?.trim()) throw badRequest('กรุณาระบุประเภทและรายละเอียด');
  const r = {
    id: uid(), organizationId: ORG_ID, refNo: nextRef(c.db), category: f.category.trim(), title: f.title?.trim() || null, subject: f.subject?.trim() || null, detail: f.detail.trim(),
    reporterName: f.reporterName?.trim() || null, reporterPhone: f.reporterPhone?.trim() || null, location: f.location?.trim() || null, villageNo: f.villageNo ? Number(f.villageNo) : null,
    geo: f.geoLat && f.geoLng ? { lat: Number(f.geoLat), lng: Number(f.geoLng) } : null,
    answers: f.titlePrefix || f.houseNo ? { ...(f.titlePrefix ? { titlePrefix: f.titlePrefix } : {}), ...(f.houseNo ? { houseNo: f.houseNo } : {}) } : null,
    files: [], photoUrl: f.photo?.url ?? null, status: 'new', staffNote: null, targetDeptId: null, createdAt: nowIso(), updatedAt: nowIso(),
    deptHeadSignedAt: null, clerkSignedAt: null, mayorSignedAt: null, docLayout: null,
  };
  c.db.citizenReports.unshift(r);
  notify(c.db, c.db.userPermissions.filter((u) => u.permissionId === 'perm-complaint:manage:Report').map((u) => u.userId).concat(['user-admin']), { type: 'complaint:new', title: 'มีเรื่องแจ้งใหม่จากประชาชน', body: `${r.refNo} — ${r.category}`, actionUrl: '/citizen-reports' });
  return { refNo: r.refNo, id: r.id, status: r.status };
});
post('/citizen/report/submit', async (c) => {
  const f = await formToRow(c.body);
  let answers: Row = {};
  try { answers = f.answers ? JSON.parse(f.answers) : {}; } catch { throw badRequest('ข้อมูลฟอร์มไม่ถูกต้อง'); }
  const formTitle = String(f.formTitle || 'คำร้อง').slice(0, 200);
  const files = Object.entries(f).filter(([, v]) => v && typeof v === 'object' && (v as Row).url).map(([field, v]) => ({ field, name: (v as Row).name, url: (v as Row).url }));
  const summary = String(answers.detail || answers.problem || answers.note || Object.values(answers).find((v) => typeof v === 'string' && v.length > 8) || formTitle).slice(0, 500);
  const r = {
    id: uid(), organizationId: ORG_ID, refNo: nextRef(c.db), formKey: f.formKey ? String(f.formKey).slice(0, 60) : null, formTitle, category: formTitle, detail: summary, answers, files,
    geo: f.geoLat && f.geoLng ? { lat: Number(f.geoLat), lng: Number(f.geoLng) } : null,
    reporterName: String(f.reporterName || answers.fullName || answers.name || '').trim().slice(0, 150) || null, reporterPhone: String(f.reporterPhone || answers.phone || answers.tel || '').trim().slice(0, 30) || null,
    location: answers.location ? String(answers.location).slice(0, 500) : answers.address ? String(answers.address).slice(0, 500) : null, photoUrl: files[0]?.url ?? null,
    status: 'new', staffNote: null, targetDeptId: null, createdAt: nowIso(), updatedAt: nowIso(), deptHeadSignedAt: null, clerkSignedAt: null, mayorSignedAt: null, docLayout: null,
  };
  c.db.citizenReports.unshift(r);
  return { refNo: r.refNo, id: r.id, status: r.status };
});
get('/citizen/report/status', (c) => {
  const r = c.db.citizenReports.find((x) => x.refNo === String(c.query.refNo ?? '').trim());
  if (!r) throw notFound('เลขอ้างอิงหรือเบอร์ไม่ถูกต้อง');
  if (r.reporterPhone && c.query.phone && digits(r.reporterPhone) !== digits(c.query.phone)) throw notFound('เลขอ้างอิงหรือเบอร์ไม่ถูกต้อง');
  return { refNo: r.refNo, category: r.category, status: r.status, staffNote: r.staffNote, createdAt: r.createdAt };
});
get('/citizen/report/mine', (c) => {
  const n = String(c.query.name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (n.length < 2) throw badRequest('กรุณากรอกชื่อ-สกุล');
  const rows = c.db.citizenReports.filter((r) => String(r.reporterName ?? '').toLowerCase().replace(/\s+/g, ' ').includes(n)).slice(0, 20);
  if (!rows.length) throw notFound('ไม่พบเรื่องที่ตรงกับชื่อนี้');
  return rows.map((r) => ({ refNo: r.refNo, category: r.category, status: r.status, staffNote: r.staffNote, createdAt: r.createdAt }));
});
get('/citizen/report/suggest-names', (c) => {
  const q = String(c.query.q ?? '').trim().toLowerCase();
  if (q.length < 2) return [];
  return [...new Set(c.db.citizenReports.map((r) => r.reporterName).filter((n): n is string => !!n && n.toLowerCase().startsWith(q)))].slice(0, 8);
});
get('/citizen/report/nearest-village', (c) => ({ villageNo: 1 + (Math.abs(Math.floor(Number(c.query.lat) * 1000 + Number(c.query.lng) * 1000)) % 6) }));

// ───────────── เจ้าหน้าที่ ─────────────
get('/citizen-reports/count', (c) => {
  const rows = c.db.citizenReports;
  const since = c.query.since ? new Date(c.query.since).getTime() : null;
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  return {
    unseen: rows.filter((r) => (since ? new Date(r.createdAt).getTime() > since : r.status === 'new')).length,
    new: rows.filter((r) => r.status === 'new').length, today: rows.filter((r) => new Date(r.createdAt) >= todayStart).length, now: nowIso(),
  };
});
get('/citizen-reports/my-queue', (c) => {
  const { db, user } = c;
  const me = user!;
  const clerk = hasAnyRole(db, me, 'CLERK', 'DEPUTY_CLERK'), mayor = hasAnyRole(db, me, 'MAYOR', 'DEPUTY_MAYOR'), admin = isAdmin(db, me);
  return db.citizenReports.filter((r) => {
    const d = db.departments.find((x) => x.id === r.targetDeptId);
    if (!d) return false;
    return (!r.mayorSignedAt && admin) || (!r.deptHeadSignedAt && d.headUserId === me.id) || (r.deptHeadSignedAt && !r.clerkSignedAt && clerk) || (r.clerkSignedAt && !r.mayorSignedAt && mayor);
  }).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((r) => ({
    id: r.id, refNo: r.refNo, category: r.category, detail: r.detail, status: r.status, createdAt: r.createdAt, villageNo: r.villageNo, location: r.location,
    targetDeptName: db.departments.find((x) => x.id === r.targetDeptId)?.nameTh, deptHeadSignedAt: r.deptHeadSignedAt, clerkSignedAt: r.clerkSignedAt, mayorSignedAt: r.mayorSignedAt,
  }));
});
get('/citizen-reports/overview', (c) => {
  const { db } = c;
  const open = db.citizenReports.filter((r) => r.status === 'new' || r.status === 'in_progress');
  const days = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / DAY));
  let fresh = 0, clerk = 0, mayor = 0, stale7 = 0;
  const deptMap = new Map<string, number>(), mayorQueue: Row[] = [], items: Row[] = [];
  const titleOf = (r: Row) => r.subject || r.title || r.category || String(r.detail ?? '').slice(0, 80);
  for (const r of open) {
    const since = r.clerkSignedAt || r.deptHeadSignedAt || r.createdAt;
    const dd = days(since);
    if (dd > 7) stale7++;
    const dept = db.departments.find((d) => d.id === r.targetDeptId);
    let stage: string;
    if (!r.targetDeptId) { fresh++; stage = 'เรื่องใหม่ (ยังไม่ส่งกอง)'; }
    else if (!r.deptHeadSignedAt) { deptMap.set(dept?.nameTh ?? '-', (deptMap.get(dept?.nameTh ?? '-') ?? 0) + 1); stage = `รอ ผอ.${dept?.nameTh ?? 'กอง'}`; }
    else if (!r.clerkSignedAt) { clerk++; stage = 'รอปลัด'; }
    else { mayor++; stage = 'รอนายก'; mayorQueue.push({ id: r.id, refNo: r.refNo, subject: titleOf(r), days: dd, since }); }
    items.push({ id: r.id, refNo: r.refNo, subject: titleOf(r), detail: r.detail, deptName: dept?.nameTh, stage, days: dd, since });
  }
  const ym = nowIso().slice(0, 7);
  const done = db.citizenReports.filter((r) => r.status === 'done' && String(r.mayorSignedAt ?? r.updatedAt).slice(0, 7) === ym)
    .map((r) => ({ id: r.id, refNo: r.refNo, subject: titleOf(r), detail: r.detail, deptName: db.departments.find((d) => d.id === r.targetDeptId)?.nameTh, doneAt: r.mayorSignedAt ?? r.updatedAt }));
  return {
    total: open.length, stale7, byStep: { new: fresh, clerk, mayor, doneThisMonth: done.length, deptHead: [...deptMap.entries()].map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count) },
    mayorQueue: mayorQueue.sort((a, b) => b.days - a.days), items: items.sort((a, b) => b.days - a.days), done,
  };
});
get('/citizen-reports', (c) => {
  needPerm(c, 'complaint:read:Report');
  const { status } = c.query;
  const all = c.db.citizenReports;
  const rows = all.filter((r) => (status && REPORT_STATUSES.includes(status) ? r.status === status : r.status !== 'done')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const counts: Row = { all: 0 };
  for (const r of all) { counts[r.status] = (counts[r.status] ?? 0) + 1; if (r.status !== 'done') counts.all++; }
  const limit = [10, 20, 50].includes(Number(c.query.limit)) ? Number(c.query.limit) : 20;
  const p = paginate(rows, { ...c.query, limit }, 20);
  p.data = p.data.map((r) => view(c.db, r));
  p.meta.counts = counts;
  return p;
});
get('/citizen-reports/:id', (c) => { needPerm(c, 'complaint:read:Report'); return view(c.db, byId(c.db.citizenReports, c.params.id)); });
patch('/citizen-reports/:id', (c) => {
  needPerm(c, 'complaint:manage:Report');
  const r = byId(c.db.citizenReports, c.params.id);
  const b = c.body ?? {};
  if (b.status !== undefined) {
    if (!REPORT_STATUSES.includes(b.status)) throw badRequest('สถานะไม่ถูกต้อง');
    if (b.status === 'done' && !hasAnyRole(c.db, c.user!, 'MAYOR', 'DEPUTY_MAYOR')) throw forbidden('ปิดเรื่องเป็น "เสร็จสิ้น" ได้เฉพาะนายก/รองนายกเท่านั้น');
    r.status = b.status;
  }
  if (b.staffNote !== undefined) r.staffNote = String(b.staffNote ?? '').trim() || null;
  if (b.subject !== undefined) r.subject = String(b.subject ?? '').trim() || null;
  if (b.detail !== undefined) r.detail = String(b.detail).trim();
  if (b.reporterName !== undefined) r.reporterName = String(b.reporterName ?? '').trim() || null;
  if (b.reporterPhone !== undefined) r.reporterPhone = String(b.reporterPhone ?? '').trim() || null;
  if (b.location !== undefined) r.location = String(b.location ?? '').trim() || null;
  if (b.villageNo !== undefined) r.villageNo = String(b.villageNo ?? '').trim() ? Number(b.villageNo) : null;
  if (b.answers !== undefined) r.answers = { ...(r.answers ?? {}), ...b.answers };
  if (b.petitionChecked) r.petitionCheckedAt = nowIso();
  r.handledBy = c.user!.id; r.updatedAt = nowIso();
  return view(c.db, r);
});
patch('/citizen-reports/:id/close', (c) => {
  if (!hasAnyRole(c.db, c.user!, 'MAYOR', 'DEPUTY_MAYOR')) throw forbidden('ปิดเรื่องเป็น "เสร็จสิ้น" ได้เฉพาะนายก/รองนายกเท่านั้น');
  const r = byId(c.db.citizenReports, c.params.id);
  if (r.targetDeptId) throw badRequest('เรื่องนี้ส่งไปกองแล้ว ต้องปิดผ่านขั้นตอนอนุมัติ 3 ผู้เซ็น');
  r.status = 'done'; r.updatedAt = nowIso();
  return view(c.db, r);
});
patch('/citizen-reports/:id/route', (c) => {
  needPerm(c, 'complaint:manage:Report');
  const r = byId(c.db.citizenReports, c.params.id);
  const dept = c.db.departments.find((d) => d.id === c.body?.targetDeptId);
  if (!dept) throw badRequest('กองไม่ถูกต้อง');
  r.targetDeptId = dept.id;
  if (r.status === 'new') r.status = 'in_progress';
  r.updatedAt = nowIso();
  notify(c.db, [dept.headUserId], { type: 'complaint:route', title: 'มีเรื่องร้องเรียนส่งถึงกองของท่าน', body: `${r.refNo} — ${r.subject || r.category}`, actionUrl: '/citizen-reports' });
  return view(c.db, r);
});
patch('/citizen-reports/:id/approve', (c) => {
  const { db, user } = c;
  const me = user!;
  const r = byId(db.citizenReports, c.params.id);
  const dept = db.departments.find((d) => d.id === r.targetDeptId);
  if (!dept) throw badRequest('ยังไม่ได้ส่งไปกอง');
  const docs = r.docLayout?.docs && typeof r.docLayout.docs === 'object' ? Object.values(r.docLayout.docs) as Row[] : [];
  if (!docs.some((l) => Array.isArray(l?.items) && l.items.some((it: Row) => it?.type === 'signature' && it.props?.ownerId === me.id))) {
    throw badRequest('กรุณาเปิดเอกสารแล้ววางลายเซ็นของคุณอย่างน้อย 1 เอกสารก่อนส่งต่อ');
  }
  const admin = isAdmin(db, me);
  const now = nowIso();
  if (!r.deptHeadSignedAt) {
    if (!admin && me.id !== dept.headUserId) throw forbidden('คุณไม่ใช่หัวหน้ากองที่ถูกมอบหมายเรื่องนี้');
    r.deptHeadSignedBy = admin ? dept.headUserId || me.id : me.id; r.deptHeadSignedAt = now;
  } else if (!r.clerkSignedAt) {
    if (!admin && !hasAnyRole(db, me, 'CLERK', 'DEPUTY_CLERK')) throw forbidden('ต้องมีบทบาทปลัดจึงจะดำเนินการขั้นนี้ได้');
    r.clerkSignedBy = admin ? roleHolder(db, 'CLERK', 'DEPUTY_CLERK') || me.id : me.id; r.clerkSignedAt = now;
  } else if (!r.mayorSignedAt) {
    if (!admin && !hasAnyRole(db, me, 'MAYOR', 'DEPUTY_MAYOR')) throw forbidden('ต้องมีบทบาทนายกจึงจะดำเนินการขั้นนี้ได้');
    r.mayorSignedBy = admin ? roleHolder(db, 'MAYOR', 'DEPUTY_MAYOR') || me.id : me.id; r.mayorSignedAt = now; r.status = 'done';
  } else throw badRequest('เรื่องนี้อนุมัติครบทุกขั้นแล้ว');
  r.updatedAt = now;
  return view(db, r);
});
patch('/citizen-reports/:id/signature', (c) => {
  const r = byId(c.db.citizenReports, c.params.id);
  const slot = c.body?.slot as 'deptHead' | 'clerk' | 'mayor';
  const sig = String(c.body?.signatureImage ?? '').trim() || null;
  if (sig && !/^data:image\/(png|jpe?g|gif|webp|svg\+xml)/i.test(sig)) throw badRequest('รูปลายเซ็นไม่ถูกต้อง (รองรับ PNG/JPG/GIF/WEBP)');
  if (slot === 'deptHead') r.deptHeadSignature = sig; else if (slot === 'clerk') r.clerkSignature = sig; else r.mayorSignature = sig;
  return view(c.db, r);
});
del('/citizen-reports/:id', (c) => { needPerm(c, 'complaint:delete:Report'); removeById(c.db.citizenReports, c.params.id); c.db.citizenReportComments = c.db.citizenReportComments.filter((x) => x.reportId !== c.params.id); return { deleted: true }; });

// ───────────── เอกสารของเรื่อง / ความเห็น ─────────────
const docsOf = (r: Row): Record<string, Row> => (r.docLayout?.docs && typeof r.docLayout.docs === 'object' ? r.docLayout.docs : {});
get('/citizen-reports/:id/doc-layout', (c) => ({ layout: docsOf(byId(c.db.citizenReports, c.params.id))[String(c.query.fileId ?? '')] ?? null }));
patch('/citizen-reports/:id/doc-layout', (c) => {
  const r = byId(c.db.citizenReports, c.params.id);
  const { fileId, layout } = c.body ?? {};
  if (!fileId) throw badRequest('ไม่ได้ระบุเอกสาร');
  if (!c.db.files.some((f) => f.id === fileId && f.refType === 'citizen-report' && f.refId === r.id)) throw notFound('ไม่พบเอกสารของเรื่องนี้');
  r.docLayout = { docs: { ...docsOf(r), [fileId]: layout } };
  return { ok: true };
});
get('/citizen-reports/:id/doc-summary', (c) => {
  const out: Record<string, { ownerId: string; name: string }[]> = {};
  for (const [fileId, l] of Object.entries(docsOf(byId(c.db.citizenReports, c.params.id)))) {
    out[fileId] = (Array.isArray(l?.items) ? l.items : []).filter((it: Row) => it?.type === 'signature' && it.props?.ownerId).map((it: Row) => ({ ownerId: it.props.ownerId, name: String(it.props.name || '') }));
  }
  return out;
});
post('/citizen-reports/:id/doc-pdf', async (c) => {
  byId(c.db.citizenReports, c.params.id);
  const payload = JSON.parse(await ((c.body as FormData).get('payload') as Blob).text());
  return new Raw(await composeOverlayPdf((payload.pages as Row[]).map((p) => ({ html: p.html, bg: p.bg ?? null }))));
});
get('/citizen-reports/:id/petition-pdf', async (c) => {
  const r = byId(c.db.citizenReports, c.params.id);
  const org = c.db.organizations[0];
  const signer = (id?: string | null) => (id ? (() => { const u = userBrief(id); return u ? `${u.titleTh ?? ''}${u.fullNameTh}` : ''; })() : 'รอดำเนินการ');
  return new Raw(await thaiPdf([
    { text: 'คำร้องทั่วไป', bold: true, size: 26, align: 'center' }, { text: org.nameTh, align: 'center', gap: 6 },
    { text: `เลขที่รับ ${r.refNo}   วันที่ ${new Date(r.createdAt).toLocaleDateString('th-TH', { dateStyle: 'long' })}` },
    { text: `เรื่อง ${r.subject || r.category}`, bold: true }, { text: `เรียน นายกองค์การบริหารส่วนตำบล`, gap: 4 },
    { text: `ข้าพเจ้า ${r.reporterName ?? '-'} โทร ${r.reporterPhone ?? '-'} หมู่ที่ ${r.villageNo ?? '-'}`, indent: 8 }, { text: r.detail, indent: 8, gap: 8 },
    { text: `ผู้อำนวยการกอง: ${signer(r.deptHeadSignedBy)}` }, { text: `ปลัด อบต.: ${signer(r.clerkSignedBy)}` }, { text: `นายก อบต.: ${signer(r.mayorSignedBy)}`, gap: 6 },
    { text: '(เอกสารจากระบบเดโม่)', size: 12 },
  ]));
});
get('/citizen-reports/:id/comments', (c) => c.db.citizenReportComments.filter((x) => x.reportId === c.params.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map((x) => ({ ...x, user: userBrief(x.userId) })));
post('/citizen-reports/:id/comments', (c) => {
  byId(c.db.citizenReports, c.params.id);
  const text = String(c.body?.body ?? '').trim();
  if (!text) throw badRequest('กรุณาพิมพ์ความเห็น');
  if (text.length > 2000) throw badRequest('ความเห็นยาวเกิน 2,000 ตัวอักษร');
  const row = { id: uid(), reportId: c.params.id, userId: c.user!.id, body: text, createdAt: nowIso() };
  c.db.citizenReportComments.push(row);
  return { ...row, user: userBrief(row.userId) };
});
del('/citizen-reports/:id/comments/:cid', (c) => {
  const x = byId(c.db.citizenReportComments, c.params.cid);
  if (x.userId !== c.user!.id && !isAdmin(c.db, c.user!)) throw forbidden('ลบได้เฉพาะความเห็นของตัวเอง');
  removeById(c.db.citizenReportComments, x.id);
  return { ok: true };
});
export type { Ctx };
