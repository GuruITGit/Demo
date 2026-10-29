/**
 * สารบรรณ (Correspondence Ticket) v4 — เดินขั้นตอนเดียวกับ backend จริง:
 * ลงรับ+เซ็น → ส่งผู้รับ (คน/กอง) → ส่งต่อได้อิสระ → ปลัดเซ็น → นายกลงนามปิดงาน · ตีกลับ/ขอแก้ไข/ลบ
 * สิทธิ์การมองเห็น: ปลัด/นายก/admin เห็นหมด · คนอื่นเห็นเฉพาะกองตน/ที่ตนสร้าง/ที่ตนถืออยู่ · ชั้นความลับจำกัดผู้เกี่ยวข้อง
 */
import {
  get, post, patch, del, registerSeed, paginate, Paged, uid, nowIso, byId, userBrief, fileView, blobUrl, readAsDataUrl, badRequest, notFound, forbidden, Raw,
  type Ctx, type Db, type Row,
} from '../core';
import { ORG_ID } from '../seed-base';
import { isAdmin, needPerm, notify, rolesOf } from './base';

// ───────────── ค่าคงที่ ─────────────
export const STATUS = {
  ASSIGNED: 'รอดำเนินการ', IN_PROGRESS: 'กำลังดำเนินการ', PENDING_CLERK: 'รอปลัด', PENDING_MAYOR: 'รอนายก',
  RETURNED: 'ตีกลับ', COMPLETED: 'เสร็จสิ้น', CANCELLED: 'ยกเลิก',
};
const STEP_LABELS: Record<string, string> = {
  PENDING_PERSON: 'รอผู้รับดำเนินการ', PENDING_OWNER_HEAD: 'รอผู้อำนวยการกอง (เจ้าของ)', PENDING_OWNER_CLERK: 'รอธุรการกอง (เจ้าของ)',
  PENDING_RELATED_HEAD: 'รอผู้อำนวยการกอง (เกี่ยวข้อง)', PENDING_RELATED_CLERK: 'รอธุรการกอง (เกี่ยวข้อง)',
  PENDING_CLERK: 'รอปลัด', PENDING_MAYOR: 'รอนายก', COMPLETED: 'เสร็จสิ้น', RETURNED: 'ตีกลับ', CANCELLED: 'ยกเลิก',
};
const BOOKS = [
  { key: 'R_MAIN', label: 'สมุดทะเบียนรับทั่วไป', direction: 'รับ' }, { key: 'R_SECRET', label: 'สมุดทะเบียนรับความลับ', direction: 'รับ', secret: true },
  { key: 'R_MSG_MEMO', label: 'สมุดทะเบียนรับบันทึกข้อความ', direction: 'รับ' }, { key: 'R_COMPLAIN', label: 'สมุดทะเบียนรับร้องทุกข์', direction: 'รับ' },
  { key: 'S_NORMAL', label: 'สมุดทะเบียนส่งทั่วไป', direction: 'ส่ง' }, { key: 'S_VIAN', label: 'สมุดทะเบียนส่งเวียน', direction: 'ส่ง', circular: true },
  { key: 'S_SECRET', label: 'สมุดทะเบียนส่งความลับ', direction: 'ส่ง', secret: true },
  { key: 'S_MSG_MEMO_NORMAL', label: 'สมุดทะเบียนส่งบันทึกข้อความทั่วไป', direction: 'ส่ง' },
  { key: 'S_MSG_MEMO_VIAN', label: 'สมุดทะเบียนส่งบันทึกข้อความเวียน', direction: 'ส่ง', circular: true },
  { key: 'S_DIRECTION', label: 'สมุดทะเบียนคำสั่ง', direction: 'ส่ง' }, { key: 'S_ANNOUNCE', label: 'สมุดทะเบียนประกาศ', direction: 'ส่ง' },
  { key: 'S_GUARANTEE', label: 'สมุดทะเบียนหนังสือรับรอง', direction: 'ส่ง' },
].map((b) => ({ circular: false, secret: false, numberStyle: 'dept', ...b }));
const BOOK_META = new Map(BOOKS.map((b) => [b.key, b]));
const CONF_RANK: Record<string, number> = { 'ปกติ': 0, 'ลับ': 1, 'ลับมาก': 2, 'ลับที่สุด': 3 };
const SEE_ALL = ['SUPER_ADMIN', 'ADMIN', 'MAYOR', 'DEPUTY_MAYOR', 'CLERK', 'DEPUTY_CLERK'];
const CREATED_HOP = 'CREATED';
const buddhistYear = (d = new Date()) => d.getFullYear() + 543;

const stepToStatus = (step: string) => ({
  PENDING_CLERK: STATUS.PENDING_CLERK, PENDING_MAYOR: STATUS.PENDING_MAYOR, COMPLETED: STATUS.COMPLETED, RETURNED: STATUS.RETURNED, CANCELLED: STATUS.CANCELLED,
}[step] ?? STATUS.IN_PROGRESS);

function stepLabel(step: string, ownerDept?: string, relatedDept?: string, holder?: string) {
  const o = ownerDept || 'กองเจ้าของ', r = relatedDept || 'กองที่เกี่ยวข้อง';
  switch (step) {
    case 'PENDING_PERSON': return `รอ${holder || 'ผู้รับ'} ดำเนินการ`;
    case 'PENDING_OWNER_HEAD': return `รอผู้อำนวยการ${o} พิจารณา`;
    case 'PENDING_OWNER_CLERK': return `รอธุรการ${o} ดำเนินการ`;
    case 'PENDING_RELATED_HEAD': return `รอผู้อำนวยการ${r} ดำเนินการ`;
    case 'PENDING_RELATED_CLERK': return `รอธุรการ${r} ลงรับดำเนินการ`;
    case 'PENDING_CLERK': return 'รอปลัด ดำเนินการ';
    case 'PENDING_MAYOR': return 'รอนายก ดำเนินการ';
    case 'COMPLETED': return 'เสร็จสิ้น';
    case 'RETURNED': return 'ตีกลับ';
    case 'CANCELLED': return 'ยกเลิก';
    default: return step;
  }
}

// ───────────── ตัวช่วยสิทธิ์ ─────────────
const rolesNames = (db: Db, u: Row) => rolesOf(db, u.id).map((r) => r.name);
const privileged = (db: Db, u: Row) => rolesNames(db, u).some((r) => SEE_ALL.includes(r));
const hasRole = (db: Db, u: Row, ...names: string[]) => rolesNames(db, u).some((r) => names.includes(r));

function inDept(db: Db, t: Row, deptId?: string) {
  if (!deptId) return false;
  return t.ownerDeptId === deptId || db.ticketDepartments.some((td) => td.ticketId === t.id && td.departmentId === deptId);
}
function canSeeConfidential(db: Db, t: Row, u: Row) {
  if ((CONF_RANK[t.confidentiality] || 0) === 0 || privileged(db, u)) return true;
  const deptHeads = [t.ownerDeptId, ...db.ticketDepartments.filter((td) => td.ticketId === t.id).map((td) => td.departmentId)]
    .map((id) => db.departments.find((d) => d.id === id)?.headUserId);
  return t.createdBy === u.id || t.responsibleUserId === u.id || t.currentHolderUserId === u.id
    || db.ticketDepartments.some((td) => td.ticketId === t.id && (td.assignedUserId === u.id || td.assignedUserIds?.includes(u.id)))
    || deptHeads.includes(u.id);
}
function canSee(db: Db, t: Row, u: Row) {
  if (!privileged(db, u) && !(t.createdBy === u.id || t.currentHolderUserId === u.id || inDept(db, t, u.departmentId))) return false;
  return canSeeConfidential(db, t, u);
}
const visible = (db: Db, u: Row) => db.tickets.filter((t) => !t.deletedAt && canSee(db, t, u));

/** รอฉันดำเนินการอยู่ตอนนี้ (ผู้ถือเรื่อง / ปลัด / นายก ตามขั้น) */
function waitingOnMe(db: Db, t: Row, u: Row) {
  if (t.currentStep === 'PENDING_PERSON' && t.currentHolderUserId === u.id) return true;
  if (t.status === STATUS.PENDING_CLERK && hasRole(db, u, 'CLERK', 'DEPUTY_CLERK')) return true;
  if (t.status === STATUS.PENDING_MAYOR && hasRole(db, u, 'MAYOR', 'DEPUTY_MAYOR')) return true;
  return false;
}
const isClosed = (t: Row) => t.status === STATUS.COMPLETED || t.status === STATUS.CANCELLED;
const hasActed = (db: Db, t: Row, u: Row) => db.timeline.some((w) => w.ticketId === t.id && w.actorId === u.id && w.action !== 'สร้าง');

function canEditDoc(db: Db, t: Row, u: Row) {
  const step = t.currentStep;
  if (!step || step === 'COMPLETED' || step === 'CANCELLED') return false;
  if (isAdmin(db, u)) return true;
  if (step === 'PENDING_CLERK') return hasRole(db, u, 'CLERK', 'DEPUTY_CLERK');
  if (step === 'PENDING_MAYOR') return hasRole(db, u, 'MAYOR', 'DEPUTY_MAYOR');
  return t.currentHolderUserId === u.id;
}
const hasSignatureBy = (layout: Row | null | undefined, uid_: string) =>
  !!layout?.items?.some((it: Row) => it.type === 'signature' && it.props?.ownerId === uid_);

// ───────────── รูปแบบข้อมูลที่ส่งให้หน้าเว็บ ─────────────
const deptBrief = (db: Db, id?: string | null) => {
  const d = db.departments.find((x) => x.id === id);
  return d ? { id: d.id, nameTh: d.nameTh, headUserId: d.headUserId, docPrefix: d.docPrefix } : null;
};

function listView(db: Db, t: Row): Row {
  return {
    ...t, overlayLayout: undefined,
    ownerDept: deptBrief(db, t.ownerDeptId),
    creator: userBrief(t.createdBy), responsibleUser: userBrief(t.responsibleUserId), currentHolder: userBrief(t.currentHolderUserId),
  };
}

function detailView(c: Ctx, t: Row): Row {
  const { db, user } = c;
  const timeline = db.timeline.filter((w) => w.ticketId === t.id).sort((a, b) => a.actedAt.localeCompare(b.actedAt))
    .map((w) => ({ ...w, actor: userBrief(w.actorId) }));
  const ticketDepartments = db.ticketDepartments.filter((td) => td.ticketId === t.id).map((td) => ({
    ...td, department: deptBrief(db, td.departmentId), assignedUser: userBrief(td.assignedUserId),
    assignedUsers: (td.assignedUserIds ?? []).map((id: string) => userBrief(id)).filter(Boolean),
  }));
  const holder = userBrief(t.currentHolderUserId);
  const holderDept = holder ? db.departments.find((d) => d.id === holder.departmentId) : null;
  const relatedDept = t.relatedDeptId ? deptBrief(db, t.relatedDeptId) : null;
  const ownerDept = deptBrief(db, t.ownerDeptId);
  const lastHop = t.routeTrail?.length ? t.routeTrail[t.routeTrail.length - 1] : null;
  const backId = lastHop && lastHop.fromStep !== CREATED_HOP ? lastHop.fromUserId : t.createdBy;
  const back = userBrief(backId);
  const org = db.organizations[0];
  return {
    ...t, organization: org, ownerDept, relatedDept, creator: userBrief(t.createdBy), responsibleUser: userBrief(t.responsibleUserId),
    clerkSigner: userBrief(t.clerkSignedBy), mayorSigner: userBrief(t.mayorSignedBy), receiver: userBrief(t.receivedBy),
    ticketDepartments, timeline, attachments: db.files.filter((f) => f.refType === 'ticket' && f.refId === t.id).map(fileView),
    currentHolder: holder && { ...holder, departmentName: holderDept?.nameTh ?? null },
    statusLabel: t.currentStep ? stepLabel(t.currentStep, ownerDept?.nameTh, relatedDept?.nameTh, holder?.fullNameTh) : t.status,
    returnTo: back && { id: back.id, name: `${back.titleTh || ''}${back.fullNameTh}`, isCreator: backId === t.createdBy && (!lastHop || lastHop.fromStep === CREATED_HOP) },
    canEditDoc: canEditDoc(db, t, user!),
  };
}

function loadVisible(c: Ctx, id: string): Row {
  const t = c.db.tickets.find((x) => x.id === id && !x.deletedAt);
  if (!t) throw notFound('ไม่พบสารบรรณ');
  if (!canSee(c.db, t, c.user!)) throw forbidden(CONF_RANK[t.confidentiality] ? 'เอกสารชั้นความลับ — ไม่มีสิทธิ์เข้าถึง' : 'ไม่มีสิทธิ์เข้าถึงสารบรรณนี้');
  return t;
}

function log(db: Db, ticketId: string, stepName: string, actorId: string, action: string, fromStatus?: string | null, toStatus?: string | null, note?: string | null, signatureImage?: string | null, at?: string) {
  db.timeline.push({ id: uid(), docType: 'TICKET', ticketId, stepName, actorId, action, fromStatus, toStatus, note, signatureImage, actedAt: at ?? nowIso() });
}

function usersByRole(db: Db, ...names: string[]) {
  return db.userRoles.filter((r) => names.includes(db.roles.find((x) => x.id === r.roleId)?.name)).map((r) => r.userId);
}

/** ตรวจ/แปลงผู้รับ: เลือกตัวคนที่เป็นปลัด → เข้าขั้นปลัด · ส่งนายกตรงไม่ได้ */
function normalizeRecipient(c: Ctx, o: { toUserId?: string | null; toClerk?: boolean }) {
  if (o.toClerk) return { toUserId: null as string | null, toClerk: true };
  if (!o.toUserId) throw badRequest('กรุณาเลือกผู้รับ');
  if (o.toUserId === c.user!.id) throw badRequest('ส่งต่อให้ตัวเองไม่ได้');
  const target = c.db.users.find((u) => u.id === o.toUserId);
  if (!target || target.isActive === false) throw badRequest('ไม่พบผู้รับที่เลือก หรือบัญชีถูกปิดใช้งาน');
  const roles = rolesNames(c.db, target);
  if (roles.some((r) => r === 'CLERK' || r === 'DEPUTY_CLERK')) return { toUserId: null, toClerk: true };
  if (roles.some((r) => r === 'MAYOR' || r === 'DEPUTY_MAYOR')) throw badRequest('ส่งถึงนายกได้เฉพาะปลัด — กรุณาเลือก "ส่งปลัด"');
  return { toUserId: o.toUserId, toClerk: false };
}

/** ส่งต่อ 1 ทอด — ตั้งผู้ถือ/ขั้น บันทึกเส้นทาง ให้กองผู้รับเห็นเรื่อง; คืนรายชื่อผู้ต้องแจ้งเตือน */
function routeTo(c: Ctx, t: Row, fromStep: string, o: { toUserId?: string | null; toClerk?: boolean; toMayor?: boolean; note?: string | null }): string[] {
  const { db, user } = c;
  let toStep: string, toUserId: string | null = null, toDeptId: string | null = null, recips: string[];
  const opts = o.toMayor ? o : { ...o, ...normalizeRecipient(c, o) };
  if (opts.toMayor) { toStep = 'PENDING_MAYOR'; recips = usersByRole(db, 'MAYOR', 'DEPUTY_MAYOR'); }
  else if (opts.toClerk) { toStep = 'PENDING_CLERK'; recips = usersByRole(db, 'CLERK', 'DEPUTY_CLERK'); }
  else {
    const target = db.users.find((u) => u.id === opts.toUserId)!;
    toStep = 'PENDING_PERSON'; toUserId = target.id; toDeptId = target.departmentId ?? null; recips = [target.id];
    if (toDeptId) {
      const td = db.ticketDepartments.find((x) => x.ticketId === t.id && x.departmentId === toDeptId);
      if (td) {
        td.assignedUserIds = [...new Set([...(td.assignedUserIds ?? []), ...(td.assignedUserId ? [td.assignedUserId] : []), target.id])];
        td.assignedUserId = td.assignedUserId ?? target.id;
      } else db.ticketDepartments.push({ id: uid(), ticketId: t.id, departmentId: toDeptId, assignedUserId: target.id, assignedUserIds: [target.id], status: 'assigned', isActive: true });
    }
  }
  t.currentStep = toStep;
  t.currentHolderUserId = toUserId;
  t.routeTrail = [...(t.routeTrail ?? []), { fromUserId: user!.id, fromStep, toUserId, toStep, toDeptId, at: nowIso(), note: o.note ?? null }];
  return recips;
}
const pushStepSig = (t: Row, step: string, userId: string) => { t.stepSignatures = [...(t.stepSignatures ?? []), { step, userId, signedAt: nowIso() }]; };
const hm = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const notifyTicket = (db: Db, ids: (string | null | undefined)[], me: string, type: string, title: string, t: Row, extra = '') =>
  notify(db, ids.filter((x) => x && x !== me), { type, title, body: `${t.ticketNumber} — ${t.subject}${extra}`, actionUrl: `/correspondence/tickets/${t.id}` });

// ───────────── สร้าง / ดำเนินการ / ตีกลับ / แก้ไข / ลบ ─────────────
post('/correspondence/tickets/v4', (c) => {
  needPerm(c, 'correspondence:create:Ticket');
  const { db, user, body: b } = c;
  const me = user!;
  const rawTo = b.toUserId || b.assignedHeadUserId || null;
  if (!b.toClerk && !rawTo) throw badRequest('กรุณาเลือกผู้รับ (คน/กอง) หรือส่งปลัด');
  if (b.toClerk && rawTo) throw badRequest('เลือกผู้รับได้ทางเดียว — คน/กอง หรือ ปลัด');
  const rcpt = normalizeRecipient(c, { toUserId: rawTo, toClerk: !!b.toClerk });
  if (!b.overlayLayout) throw badRequest('กรุณาเซ็นเอกสาร (ลากลายเซ็นของคุณไปวาง) ก่อนบันทึก');
  if (!hasSignatureBy(b.overlayLayout, me.id)) throw badRequest('กรุณาลากลายเซ็นของคุณไปวางบนเอกสารก่อนบันทึก');
  const ownerDeptId = rcpt.toUserId ? db.users.find((u) => u.id === rcpt.toUserId)?.departmentId ?? me.departmentId : me.departmentId;
  const book = BOOK_META.has(b.registerBook) ? b.registerBook : 'R_MAIN';
  const meta = BOOK_META.get(book)!;
  const year = b.fiscalYear ?? buddhistYear();
  const ticketNumber = String(b.receiveRegNumber ?? '').trim();
  if (!ticketNumber) throw badRequest('กรุณากรอกเลขทะเบียนรับ');
  if (db.tickets.some((t) => !t.deletedAt && t.registerBook === book && t.fiscalYear === year && t.ticketNumber === ticketNumber)) {
    throw badRequest(`เลขทะเบียนรับ "${ticketNumber}" ถูกใช้แล้วในสมุดทะเบียนนี้ (ปีงบ ${year})`);
  }
  const confidentiality = meta.secret && !(CONF_RANK[b.confidentiality || ''] > 0) ? 'ลับ' : b.confidentiality || 'ปกติ';
  const now = nowIso();
  const t: Row = {
    id: uid(), organizationId: ORG_ID, ticketNumber, receiveRegNumber: ticketNumber, registerBook: book, direction: meta.direction, fiscalYear: year,
    receivedDate: now, receivedTime: hm(), receivedRecordAt: now, externalDocNumber: b.externalDocNumber, docDate: b.docDate || null, sourceOrg: b.sourceOrg,
    subject: b.subject, recipient: b.recipient || null, body: b.body || null, urgencyLevel: b.urgencyLevel || 'ปกติ', confidentiality,
    purpose: b.purposes?.length ? b.purposes.join(', ') : null, purposeOther: b.purposeOther || null, ownerDeptId,
    responsibleUserId: rcpt.toUserId || me.id, assignedHeadUserId: rcpt.toUserId, stepSignatures: [], routeTrail: [], overlayLayout: b.overlayLayout,
    status: STATUS.IN_PROGRESS, receivedBy: me.id, createdBy: me.id, createdAt: now, updatedAt: now, currentStep: null, currentHolderUserId: null,
  };
  db.tickets.unshift(t);
  pushStepSig(t, CREATED_HOP, me.id);
  const recips = routeTo(c, t, CREATED_HOP, { toUserId: rcpt.toUserId, toClerk: rcpt.toClerk, note: b.body || null });
  t.status = stepToStatus(t.currentStep);
  log(db, t.id, 'สร้างสารบรรณ', me.id, 'สร้าง + ประทับเซ็น + ส่งดำเนินการ', null, t.currentStep, b.body || null, b.signatureImage);
  notifyTicket(db, recips, me.id, 'ticket:assigned', 'มีสารบรรณส่งถึงท่าน', t);
  return detailView(c, t);
});

post('/correspondence/tickets/:id/v4/action', (c) => {
  const { db, user, body: b } = c;
  const me = user!;
  const t = byId(db.tickets, c.params.id);
  if (!t.currentStep) throw badRequest('สารบรรณนี้ไม่ได้ใช้ workflow v4');
  const step = t.currentStep;
  const admin = isAdmin(db, me);
  const assertActor = (ok: boolean) => { if (!ok && !admin) throw forbidden('คุณไม่ใช่ผู้ที่ต้องดำเนินการในขั้นนี้'); };
  const requireSig = () => {
    if (!b.signatureImage) throw badRequest('กรุณาประทับลายเซ็นก่อนส่ง');
    if (!hasSignatureBy(t.overlayLayout, me.id)) throw badRequest('กรุณาเปิดเอกสาร (ดูเอกสาร / เซ็น) แล้ววางลายเซ็นของคุณก่อนส่ง');
  };
  const ownerName = deptBrief(db, t.ownerDeptId)?.nameTh;
  const stepName = stepLabel(step, ownerName);
  let recips: string[] = [];
  let title = 'มีสารบรรณรอท่านดำเนินการ';

  if (b.type === 'forward') {
    if (step !== 'PENDING_PERSON') throw badRequest('ขั้นตอนนี้ส่งต่อแบบเลือกผู้รับไม่ได้');
    assertActor(me.id === t.currentHolderUserId);
    requireSig();
    if (!b.toClerk && !b.toUserId) throw badRequest('กรุณาเลือกผู้รับ (คน/กอง) หรือส่งปลัด');
    if (b.toClerk && b.toUserId) throw badRequest('เลือกผู้รับได้ทางเดียว — คน/กอง หรือ ปลัด');
    if (b.deptRegNumber?.trim()) { t.deptRegNumber = b.deptRegNumber.trim(); t.deptRegAt = nowIso(); }
    pushStepSig(t, step, me.id);
    recips = routeTo(c, t, step, { toUserId: b.toUserId, toClerk: !!b.toClerk, note: b.note });
  } else if (b.type === 'sign_send') {
    requireSig();
    if (step === 'PENDING_CLERK') {
      assertActor(hasRole(db, me, 'CLERK', 'DEPUTY_CLERK'));
      pushStepSig(t, step, me.id);
      t.clerkSignedBy = me.id; t.clerkSignedAt = nowIso();
      recips = routeTo(c, t, step, { toMayor: true, note: b.note });
    } else if (step === 'PENDING_MAYOR') {
      assertActor(hasRole(db, me, 'MAYOR', 'DEPUTY_MAYOR'));
      pushStepSig(t, step, me.id);
      t.mayorSignedBy = me.id; t.mayorSignedAt = nowIso();
      t.currentStep = 'COMPLETED'; t.currentHolderUserId = null; t.completedAt = nowIso();
      recips = [t.createdBy, t.assignedHeadUserId].filter(Boolean);
      title = 'สารบรรณเสร็จสิ้น (นายกลงนามปิดงานแล้ว)';
    } else throw badRequest('ขั้นตอนไม่ถูกต้องสำหรับการประทับเซ็น');
  } else throw badRequest('ประเภทการดำเนินการไม่ถูกต้อง');

  t.status = stepToStatus(t.currentStep);
  t.updatedAt = nowIso();
  let action = 'ประทับเซ็น + ส่งดำเนินการ';
  if (t.currentStep === 'COMPLETED') action = 'ลงนามปิดงาน';
  else if (t.currentStep === 'PENDING_CLERK') action = 'ประทับเซ็น + ส่งถึงปลัด';
  else if (t.currentStep === 'PENDING_MAYOR') action = 'ประทับเซ็น + ส่งถึงนายก';
  else if (t.currentStep === 'PENDING_PERSON' && t.currentHolderUserId) {
    const h = userBrief(t.currentHolderUserId);
    if (h) action = `ประทับเซ็น + ส่งถึง ${h.titleTh || ''}${h.fullNameTh}`;
  }
  log(db, t.id, stepName, me.id, action, step, t.currentStep, b.note, b.signatureImage);
  notifyTicket(db, recips, me.id, t.currentStep === 'COMPLETED' ? 'ticket:completed' : 'ticket:step', title, t);
  return detailView(c, t);
});

post('/correspondence/tickets/:id/v4/return', (c) => {
  const { db, user, body: b } = c;
  const me = user!;
  const t = byId(db.tickets, c.params.id);
  if (!t.currentStep) throw badRequest('สารบรรณนี้ไม่ได้ใช้ workflow v4');
  if (t.currentStep === 'COMPLETED') throw badRequest('สารบรรณเสร็จสิ้นแล้ว ตีกลับไม่ได้');
  if (!String(b?.note ?? '').trim()) throw badRequest('กรุณาระบุเหตุผลการตีกลับ');
  const fromStep = t.currentStep;
  const isActor = fromStep === 'PENDING_CLERK' ? hasRole(db, me, 'CLERK', 'DEPUTY_CLERK')
    : fromStep === 'PENDING_MAYOR' ? hasRole(db, me, 'MAYOR', 'DEPUTY_MAYOR') : t.currentHolderUserId === me.id;
  if (!isActor && !isAdmin(db, me)) throw forbidden('ตีกลับได้เฉพาะผู้ที่ถือเรื่องอยู่ในขั้นนี้');

  const trail = [...(t.routeTrail ?? [])];
  let toStep: string, holder: string | null, recips: string[];
  const toCreator = b.toCreator && fromStep === 'PENDING_PERSON';
  const last = toCreator ? null : trail.pop();
  if (!last || !last.fromUserId || last.fromStep === CREATED_HOP || toCreator) {
    toStep = 'PENDING_PERSON'; holder = t.createdBy; recips = [t.createdBy];
    if (toCreator) trail.length = 0;
  } else if (last.fromStep === 'PENDING_CLERK') {
    toStep = 'PENDING_CLERK'; holder = null; recips = [last.fromUserId]; t.clerkSignedBy = null; t.clerkSignedAt = null;
  } else { toStep = 'PENDING_PERSON'; holder = last.fromUserId; recips = [last.fromUserId]; }
  t.routeTrail = trail; t.currentStep = toStep; t.currentHolderUserId = holder; t.status = stepToStatus(toStep); t.updatedAt = nowIso();
  log(db, t.id, stepLabel(fromStep, deptBrief(db, t.ownerDeptId)?.nameTh), me.id, 'ตีกลับ', fromStep, toStep, b.note);
  notifyTicket(db, recips, me.id, 'ticket:returned', 'สารบรรณถูกตีกลับให้ท่าน', t, `\nเหตุผล: ${b.note}`);
  return detailView(c, t);
});

patch('/correspondence/tickets/:id/v4', (c) => {
  const { db, user, body: b } = c;
  const me = user!;
  const t = byId(db.tickets, c.params.id);
  if (!t.currentStep) throw badRequest('สารบรรณนี้ไม่ได้ใช้ workflow v4');
  if (!(privileged(db, me) || t.createdBy === me.id)) throw forbidden('เฉพาะผู้ลงรับ (ผู้สร้าง) หรือผู้ดูแลเท่านั้นที่แก้ไขได้');
  if (t.currentStep === 'COMPLETED') throw badRequest('นายกลงนามปิดงานแล้ว แก้ไขไม่ได้');
  for (const k of ['subject', 'externalDocNumber', 'docDate', 'sourceOrg', 'recipient', 'body', 'urgencyLevel', 'confidentiality', 'purposeOther']) if (b[k] !== undefined) t[k] = b[k];
  if (b.purposes !== undefined) t.purpose = b.purposes?.length ? b.purposes.join(', ') : null;
  t.updatedAt = nowIso();
  log(db, t.id, 'แก้ไขเอกสาร', me.id, 'แก้ไข', t.currentStep, t.currentStep);
  const done = (t.stepSignatures ?? []).map((s: Row) => s.userId);
  notifyTicket(db, [...done, t.assignedHeadUserId, t.currentHolderUserId], me.id, 'ticket:edited', 'มีการแก้ไขเอกสารสารบรรณที่ท่านเกี่ยวข้อง', t);
  return detailView(c, t);
});

patch('/correspondence/tickets/:id/v4/overlay', (c) => {
  const { db, user, body: b } = c;
  const t = byId(db.tickets, c.params.id);
  if (!canEditDoc(db, t, user!)) throw forbidden('แก้เอกสารได้เฉพาะผู้ที่ถือเรื่องอยู่ในขั้นนี้');
  const layout = b?.layout ?? null;
  // ห้ามลบลายเซ็นของคนอื่น
  const keep = new Set((layout?.items ?? []).filter((x: Row) => x.type === 'signature').map((x: Row) => x.id));
  const removed = (t.overlayLayout?.items ?? []).filter((x: Row) => x.type === 'signature' && x.props?.ownerId !== user!.id && !keep.has(x.id));
  if (removed.length) throw badRequest('ลบลายเซ็นของผู้อื่นไม่ได้');
  t.overlayLayout = layout;
  return { ok: true };
});

// แก้ข้อมูลหนังสือ (หน้า edit) — เฉพาะผู้สร้าง/กองเจ้าของ/ผู้ดูแล ก่อนปิดงาน
patch('/correspondence/tickets/:id', (c) => {
  const { db, user, body: b } = c;
  const me = user!;
  const t = loadVisible(c, c.params.id);
  const owner = db.departments.find((d) => d.id === t.ownerDeptId);
  const canEdit = t.createdBy === me.id || t.ownerDeptId === me.departmentId || owner?.headUserId === me.id;
  if (!canEdit && !isAdmin(db, me)) throw forbidden('เฉพาะผู้สร้าง/กองเจ้าของเรื่อง/ผู้ดูแลเท่านั้นที่แก้ไขได้');
  if (isClosed(t)) throw badRequest('เรื่องที่เสร็จสิ้น/ยกเลิกแล้ว ไม่สามารถแก้ไขได้');
  for (const k of ['subject', 'body', 'externalDocNumber', 'sourceOrg', 'senderName', 'senderPosition', 'recipient', 'keywords', 'docType', 'purpose', 'purposeOther',
    'refDocNumber', 'refDocDetail', 'urgencyLevel', 'confidentiality', 'note', 'responsibleUserId', 'docDate', 'dueDate']) if (b[k] !== undefined) t[k] = b[k] || null;
  t.updatedAt = nowIso();
  log(db, t.id, 'แก้ไขเอกสาร', me.id, 'แก้ไขข้อมูลหนังสือ', t.status, t.status, b.note);
  return detailView(c, t);
});

del('/correspondence/tickets/:id', (c) => {
  const { db, user } = c;
  const t = byId(db.tickets, c.params.id);
  if (!isAdmin(db, user!) && t.createdBy !== user!.id) throw forbidden('เฉพาะผู้สร้างหรือผู้ดูแลระบบเท่านั้นที่ลบได้');
  t.deletedAt = nowIso();
  return { message: 'ลบสารบรรณสำเร็จ' };
});

// ───────────── รายการ / กล่องงาน ─────────────
function applyFilters(rows: Row[], q: Row, db: Db) {
  const s = q.search ? String(q.search).toLowerCase() : '';
  return rows.filter((t) => {
    if (q.status) {
      if (q.status === 'ACTIVE') { if (![STATUS.ASSIGNED, STATUS.IN_PROGRESS, STATUS.RETURNED].includes(t.status)) return false; }
      else if (q.status === STATUS.IN_PROGRESS) { if (![STATUS.IN_PROGRESS, STATUS.RETURNED].includes(t.status)) return false; }
      else if (t.status !== q.status) return false;
    }
    if (q.step && t.currentStep !== q.step) return false;
    if (q.urgencyLevel && t.urgencyLevel !== q.urgencyLevel) return false;
    if (q.confidentiality && t.confidentiality !== q.confidentiality) return false;
    if (q.registerBook && t.registerBook !== q.registerBook) return false;
    if (q.direction && t.direction !== q.direction) return false;
    if (q.fiscalYear && String(t.fiscalYear) !== String(q.fiscalYear)) return false;
    if (q.responsibleUserId && t.responsibleUserId !== q.responsibleUserId) return false;
    if (q.sourceOrg && !String(t.sourceOrg ?? '').toLowerCase().includes(String(q.sourceOrg).toLowerCase())) return false;
    if (q.dateFrom && String(t.receivedDate ?? '').slice(0, 10) < q.dateFrom) return false;
    if (q.dateTo && String(t.receivedDate ?? '').slice(0, 10) > q.dateTo) return false;
    if (q.deptId && !inDept(db, t, q.deptId)) return false;
    if (s && ![t.subject, t.receiveRegNumber, t.ticketNumber, t.externalDocNumber, t.sourceOrg, t.keywords].some((v) => String(v ?? '').toLowerCase().includes(s))) return false;
    return true;
  });
}
const byNewest = (a: Row, b: Row) => b.createdAt.localeCompare(a.createdAt);

get('/correspondence/tickets', (c) => {
  needPerm(c, 'correspondence:read:Ticket');
  const rows = applyFilters(visible(c.db, c.user!), c.query, c.db).sort(byNewest);
  const p = paginate(rows, c.query, 20);
  return new Paged(p.data.map((t) => listView(c.db, t)), p.meta);
});

get('/correspondence/tickets/inbox', (c) => {
  needPerm(c, 'correspondence:read:Ticket');
  const { db, user: me, query: q } = c;
  const box = q.box || 'todo';
  let rows = visible(db, me!);
  if (box === 'created') rows = rows.filter((t) => t.createdBy === me!.id);
  else if (box === 'done') rows = rows.filter((t) => t.status === STATUS.COMPLETED && (t.createdBy === me!.id || hasActed(db, t, me!) || inDept(db, t, me!.departmentId)));
  else if (box === 'doing') rows = rows.filter((t) => !isClosed(t) && hasActed(db, t, me!) && !waitingOnMe(db, t, me!));
  else rows = rows.filter((t) => !isClosed(t) && waitingOnMe(db, t, me!));
  rows = applyFilters(rows, q, db).sort(byNewest);
  const p = paginate(rows, q, 20);
  const read = new Set(db.ticketReads.filter((r) => r.userId === me!.id).map((r) => r.ticketId));
  return new Paged(p.data.map((t) => ({ ...listView(db, t), isRead: read.has(t.id) })), p.meta);
});

get('/correspondence/tickets/my-tasks', (c) => {
  const { db, user: me } = c;
  return visible(db, me!).filter((t) => !isClosed(t) && waitingOnMe(db, t, me!))
    .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || byNewest(a, b)).slice(0, 50).map((t) => listView(db, t));
});

get('/correspondence/tickets/stats', (c) => {
  const rows = visible(c.db, c.user!);
  const n = (s: string) => rows.filter((t) => t.status === s).length;
  const overdue = rows.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < nowIso().slice(0, 10) && !isClosed(t)).length;
  return { all: rows.length, assigned: n(STATUS.ASSIGNED), inProgress: n(STATUS.IN_PROGRESS), pendingClerk: n(STATUS.PENDING_CLERK), pendingMayor: n(STATUS.PENDING_MAYOR), completed: n(STATUS.COMPLETED), returned: n(STATUS.RETURNED), overdue };
});

get('/correspondence/tickets/returned', (c) => {
  const rows = visible(c.db, c.user!).filter((t) => t.status === STATUS.RETURNED).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((t) => listView(c.db, t));
  return { total: rows.length, receive: rows.filter((r) => r.direction === 'รับ'), send: rows.filter((r) => r.direction === 'ส่ง') };
});

get('/correspondence/tickets/books', () => BOOKS);
get('/correspondence/tickets/next-number', (c) => {
  const book = BOOK_META.has(c.query.book) ? c.query.book : 'R_MAIN';
  const year = Number(c.query.fiscalYear) || buddhistYear();
  const nums = c.db.tickets.filter((t) => !t.deletedAt && t.registerBook === book && t.fiscalYear === year).map((t) => String(t.ticketNumber).trim());
  const numeric = nums.filter((s) => /^\d+$/.test(s)).map(Number);
  if (!nums.length) return { book, year, count: 0, latest: null, suggested: '1' };
  return { book, year, count: nums.length, latest: numeric.length ? String(Math.max(...numeric)) : null, suggested: numeric.length ? String(Math.max(...numeric) + 1) : null };
});
get('/correspondence/tickets/suggestions', (c) => {
  const top = (k: string) => {
    const m = new Map<string, number>();
    c.db.tickets.forEach((t) => { if (t[k]) m.set(t[k], (m.get(t[k]) ?? 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100).map(([v]) => v);
  };
  return { sources: top('sourceOrg'), recipients: top('recipient') };
});
get('/correspondence/tickets/books/summary', (c) => {
  const rows = visible(c.db, c.user!).filter((t) => !c.query.fiscalYear || String(t.fiscalYear) === String(c.query.fiscalYear));
  const years = [...new Set(visible(c.db, c.user!).map((t) => t.fiscalYear).filter(Boolean))].sort((a, b) => b - a);
  return { books: BOOKS.map((b) => ({ ...b, count: rows.filter((t) => t.registerBook === b.key).length })), years: years.length ? years : [buddhistYear()] };
});

// ───────────── รายงาน / สถิติ / ภาพรวมผู้บริหาร ─────────────
const thaiYearOf = (t: Row) => buddhistYear(new Date(t.createdAt));
const monthOf = (t: Row) => new Date(t.createdAt).getMonth() + 1;
const group = (rows: Row[], fn: (t: Row) => string) => {
  const m = new Map<string, number>();
  rows.forEach((t) => { const k = fn(t) || 'ไม่ระบุ'; m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));
};
const deptName = (db: Db, t: Row) => db.departments.find((d) => d.id === t.ownerDeptId)?.nameTh ?? 'ไม่ระบุกอง';
const stepRows = (rows: Row[]) => group(rows, (t) => t.currentStep).map((r) => ({ ...r, label: STEP_LABELS[r.key] ?? r.key }));

get('/correspondence/tickets/summary/years', (c) => {
  needPerm(c, 'correspondence:summary:Ticket');
  const m = new Map<number, number>();
  visible(c.db, c.user!).forEach((t) => m.set(thaiYearOf(t), (m.get(thaiYearOf(t)) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[0] - a[0]).map(([year, count]) => ({ year, count }));
});
get('/correspondence/tickets/summary/:year/months', (c) => {
  needPerm(c, 'correspondence:summary:Ticket');
  const y = Number(c.params.year);
  const rows = visible(c.db, c.user!).filter((t) => thaiYearOf(t) === y);
  return { year: y, months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: rows.filter((t) => monthOf(t) === i + 1).length })).filter((m) => m.count) };
});
function yearly(c: Ctx) {
  needPerm(c, 'correspondence:summary:Ticket');
  const y = Number(c.params.year);
  const rows = visible(c.db, c.user!).filter((t) => thaiYearOf(t) === y && (!c.query.deptId || t.ownerDeptId === c.query.deptId));
  return {
    year: y, total: rows.length, byStep: stepRows(rows), byUrgency: group(rows, (t) => t.urgencyLevel || 'ปกติ'), byDepartment: group(rows, (t) => deptName(c.db, t)),
    months: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: rows.filter((t) => monthOf(t) === i + 1).length })),
  };
}
get('/correspondence/tickets/summary/:year/year', yearly);
get('/correspondence/tickets/summary/:year/:month', (c) => {
  needPerm(c, 'correspondence:summary:Ticket');
  const y = Number(c.params.year), m = Number(c.params.month);
  const rows = visible(c.db, c.user!).filter((t) => thaiYearOf(t) === y && monthOf(t) === m && (!c.query.deptId || t.ownerDeptId === c.query.deptId)).sort(byNewest);
  return {
    year: y, month: m, total: rows.length, byStep: stepRows(rows), byUrgency: group(rows, (t) => t.urgencyLevel || 'ปกติ'), byDepartment: group(rows, (t) => deptName(c.db, t)),
    tickets: rows.slice(0, 300).map((t) => listView(c.db, t)),
  };
});

get('/correspondence/tickets/report', (c) => {
  const rows = visible(c.db, c.user!);
  const g = (fn: (t: Row) => string) => group(rows, fn).map((r) => ({ name: r.key, count: r.count }));
  return {
    byStatus: g((t) => t.status).map((r) => ({ status: r.name, count: r.count })),
    byDept: g((t) => deptName(c.db, t)), byUrgency: g((t) => t.urgencyLevel || 'ปกติ'),
    overdue: rows.filter((t) => t.dueDate && t.dueDate.slice(0, 10) < nowIso().slice(0, 10) && !isClosed(t)).length, total: rows.length,
  };
});

get('/correspondence/tickets/statistics', (c) => {
  const fy = c.query.fiscalYear ? Number(c.query.fiscalYear) : null;
  const rows = visible(c.db, c.user!).filter((t) => !fy || t.fiscalYear === fy);
  const receive = rows.filter((t) => t.direction === 'รับ').length, send = rows.filter((t) => t.direction === 'ส่ง').length;
  const months = new Map<string, number>();
  rows.forEach((t) => { const k = t.createdAt.slice(0, 7); months.set(k, (months.get(k) ?? 0) + 1); });
  return {
    fiscalYear: fy, totals: { all: receive + send, receive, send },
    byBook: BOOKS.map((b) => ({ ...b, count: rows.filter((t) => t.registerBook === b.key).length })),
    byDept: group(rows, (t) => deptName(c.db, t)).map((r) => ({ dept: r.key, count: r.count })),
    byMonth: [...months.entries()].sort().map(([month, count]) => ({ month, count })),
    byStatus: group(rows, (t) => t.status).map((r) => ({ status: r.key, count: r.count })),
  };
});

get('/correspondence/tickets/overview', (c) => {
  const { db, user: me } = c;
  const open = visible(db, me!).filter((t) => !isClosed(t));
  const sinceOf = (t: Row) => {
    const last = db.timeline.filter((w) => w.ticketId === t.id).map((w) => w.actedAt).sort().pop();
    return last ?? t.receivedRecordAt ?? t.createdAt;
  };
  const daysOf = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
  const roleHolder = (names: string[]) => {
    for (const n of names) { const id = usersByRole(db, n)[0]; const u = db.users.find((x) => x.id === id); if (u) return { name: `${u.titleTh || ''}${u.fullNameTh}`, position: u.positionName }; }
    return null;
  };
  const clerk = roleHolder(['CLERK', 'DEPUTY_CLERK']), mayor = roleHolder(['MAYOR', 'DEPUTY_MAYOR']);
  const groups = new Map<string, Row>();
  const mayorQueue: Row[] = [];
  let person = 0, clerkN = 0, mayorN = 0, stale7 = 0;
  for (const t of open) {
    const item = { id: t.id, ticketNumber: t.receiveRegNumber || t.ticketNumber, subject: t.subject, sourceOrg: t.sourceOrg, days: daysOf(sinceOf(t)), since: sinceOf(t) };
    if (item.days > 7) stale7++;
    let key: string, head: Row;
    if (t.currentStep === 'PENDING_MAYOR') { mayorN++; mayorQueue.push(item); key = 'role:mayor'; head = { kind: 'mayor', name: mayor?.name || 'นายก', position: mayor?.position || 'นายก' }; }
    else if (t.currentStep === 'PENDING_CLERK') { clerkN++; key = 'role:clerk'; head = { kind: 'clerk', name: clerk?.name || 'ปลัด', position: clerk?.position || 'ปลัด' }; }
    else if (t.currentHolderUserId) {
      person++;
      const h = db.users.find((u) => u.id === t.currentHolderUserId)!;
      key = `user:${h.id}`; head = { kind: 'person', name: `${h.titleTh || ''}${h.fullNameTh}`, position: h.positionName, dept: db.departments.find((d) => d.id === h.departmentId)?.nameTh };
    } else { person++; key = `dept:${t.ownerDeptId}`; head = { kind: 'dept', name: deptName(db, t), position: 'ยังไม่ระบุผู้รับ' }; }
    const g = groups.get(key) ?? { key, ...head, count: 0, oldestDays: 0, items: [] as Row[] };
    g.count++; g.oldestDays = Math.max(g.oldestDays, item.days); g.items.push(item);
    groups.set(key, g);
  }
  const holders = [...groups.values()].map((g): Row => ({ ...g, items: g.items.sort((a: Row, b: Row) => b.days - a.days) }))
    .sort((a, b) => b.oldestDays - a.oldestDays || b.count - a.count);
  mayorQueue.sort((a, b) => b.days - a.days);
  const ym = nowIso().slice(0, 7);
  const done = visible(db, me!).filter((t) => t.status === STATUS.COMPLETED && String(t.completedAt ?? t.updatedAt).slice(0, 7) === ym)
    .map((t) => ({
      id: t.id, ticketNumber: t.receiveRegNumber || t.ticketNumber, subject: t.subject, sourceOrg: t.sourceOrg, ownerDept: deptName(db, t),
      closedBy: userBrief(t.mayorSignedBy) ? `${userBrief(t.mayorSignedBy)!.titleTh || ''}${userBrief(t.mayorSignedBy)!.fullNameTh}` : '', doneAt: t.completedAt ?? t.updatedAt, createdAt: t.createdAt,
    })).sort((a, b) => b.doneAt.localeCompare(a.doneAt));
  return { total: open.length, stale7, byStep: { person, clerk: clerkN, mayor: mayorN, completedThisMonth: done.length }, holders, mayorQueue, done };
});

get('/correspondence/tickets/signatures/history', (c) => {
  needPerm(c, 'signatures:read:Signature');
  return c.db.timeline.filter((w) => w.signatureImage).sort((a, b) => b.actedAt.localeCompare(a.actedAt)).slice(0, 200).map((w) => {
    const t = c.db.tickets.find((x) => x.id === w.ticketId);
    const a = c.db.users.find((u) => u.id === w.actorId);
    return { id: w.id, action: w.action, signedAt: w.actedAt, signatureImage: w.signatureImage, ticketId: w.ticketId, ticketNumber: t?.ticketNumber, subject: t?.subject, actorName: a?.fullNameTh, actorPosition: a?.positionName };
  });
});
get('/correspondence/tickets/signatures/my', (c) => c.db.timeline.filter((w) => w.signatureImage && w.actorId === c.user!.id).sort((a, b) => b.actedAt.localeCompare(a.actedAt)).slice(0, 30).map((w) => {
  const t = c.db.tickets.find((x) => x.id === w.ticketId);
  return { id: w.id, action: w.action, signedAt: w.actedAt, ticketId: w.ticketId, ticketNumber: t?.ticketNumber, subject: t?.subject };
}));

// ส่งออกไฟล์ (เดโม่ส่งไฟล์ CSV ที่เปิดใน Excel ได้)
const csvBlob = (lines: string[][]) => new Raw(new Blob(['﻿' + lines.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
get('/correspondence/tickets/statistics/export', (c) => {
  const m = new Map<string, number>();
  visible(c.db, c.user!).forEach((t) => m.set(t.registerBook, (m.get(t.registerBook) ?? 0) + 1));
  return csvBlob([['สถิติทะเบียน (เดโม่)'], ['ทะเบียน', 'จำนวน'], ...Array.from(m.entries()).map(([k, v]) => [BOOK_META.get(k)?.label ?? k, String(v)])]);
});
get('/correspondence/tickets/export/excel', (c) => csvBlob([['เลขทะเบียน', 'เรื่อง', 'จาก', 'สถานะ'], ...applyFilters(visible(c.db, c.user!), c.query, c.db).map((t) => [t.receiveRegNumber, t.subject, t.sourceOrg, t.status])]));
get('/correspondence/tickets/summary/:year/year/excel', (c) => { const y = yearly(c); return csvBlob([[`สรุปสารบรรณ ปี ${y.year}`, `รวม ${y.total} เรื่อง`], ['กอง', 'จำนวน'], ...y.byDepartment.map((d) => [d.key, String(d.count)])]); });
get('/correspondence/tickets/summary/:year/:month/excel', (c) => {
  const y = Number(c.params.year), m = Number(c.params.month);
  const rows = visible(c.db, c.user!).filter((t) => thaiYearOf(t) === y && monthOf(t) === m);
  return csvBlob([['เลขทะเบียนรับ', 'เรื่อง', 'จาก', 'กอง', 'สถานะ'], ...rows.map((t) => [t.receiveRegNumber, t.subject, t.sourceOrg, deptName(c.db, t), STEP_LABELS[t.currentStep] ?? t.status])]);
});

// ───────────── รายละเอียด (ต้องอยู่หลังเส้นทางตัวอักษรทั้งหมด — router เรียงตามความเฉพาะอยู่แล้ว) ─────────────
get('/correspondence/tickets/:id', (c) => {
  const t = loadVisible(c, c.params.id);
  if (!c.db.ticketReads.some((r) => r.userId === c.user!.id && r.ticketId === t.id)) c.db.ticketReads.push({ userId: c.user!.id, ticketId: t.id });
  return detailView(c, t);
});
get('/correspondence/tickets/:id/timeline', (c) => detailView(c, loadVisible(c, c.params.id)).timeline);
get('/correspondence/tickets/:id/attachments', (c) => c.db.files.filter((f) => f.refType === 'ticket' && f.refId === loadVisible(c, c.params.id).id).map(fileView));

// ตัวช่วยอ่านเอกสารด้วย AI (จำลอง) — คืนค่าตัวอย่างให้กรอกฟอร์มอัตโนมัติ เพื่อสาธิตขั้นตอนลงรับ
post('/correspondence/ai-extract', (c) => {
  const f = c.body instanceof FormData ? (c.body.getAll('files')[0] as File | undefined) : undefined;
  const name = (f?.name ?? '').replace(/\.[^.]+$/, '').trim();
  const nextNo = (() => {
    const y = buddhistYear();
    const n = c.db.tickets.filter((t) => t.registerBook === 'R_MAIN' && t.fiscalYear === y).map((t) => Number(t.ticketNumber)).filter(Number.isFinite);
    return String((n.length ? Math.max(...n) : 0) + 1);
  })();
  return {
    filled: true,
    data: {
      externalDocNumber: 'ที่ มท 0810.3/ว 1234', receiveRegNumber: nextNo, docDate: nowIso().slice(0, 10), sourceOrg: 'ที่ว่าการอำเภอตัวอย่าง',
      subject: name && /[ก-๙]/.test(name) ? name : 'ขอความอนุเคราะห์ประชาสัมพันธ์โครงการ (ตัวอย่างจากการอ่านเอกสาร)',
      recipient: 'นายกองค์การบริหารส่วนตำบล', body: 'ด้วยอำเภอขอความร่วมมือประชาสัมพันธ์ให้ประชาชนในพื้นที่ทราบ จึงเรียนมาเพื่อโปรดพิจารณาดำเนินการ',
      urgencyLevel: null, confidentiality: null, purposes: ['เพื่อพิจารณา'],
    },
  };
});

// สร้างไฟล์ PDF จากหน้าที่ประทับเซ็นแล้ว (วาดชั้นแต่งทับภาพเอกสารฝั่งเบราว์เซอร์)
post('/correspondence/tickets/:id/doc-pdf', async (c) => {
  const t = loadVisible(c, c.params.id);
  const fd = c.body as FormData;
  const payload = JSON.parse(await (fd.get('payload') as Blob).text());
  const files = c.db.files.filter((f) => f.refType === 'ticket' && f.refId === t.id);
  const src = files.find((f) => f.id === payload.fileId) ?? files.find((f) => /.(pdf|png|jpe?g|webp)$/i.test(f.originalName) || /pdf|image/.test(f.mimeType));
  let bgs: string[] = [];
  if (src) {
    const isPdf = src.mimeType === 'application/pdf' || /.pdf$/i.test(src.originalName);
    const url = blobUrl(src.url) as string;
    if (isPdf) { const { renderFileToImages } = await import('@/components/doc-editor/ticket-helpers'); bgs = await renderFileToImages(url, true); }
    else bgs = [url];
  }
  const { composeOverlayPdf } = await import('../pdf');
  const blob = await composeOverlayPdf((payload.pages as Row[]).map((p) => ({ html: p.html, bg: p.src === 'attachment' ? bgs[p.srcPage ?? 0] ?? null : null })));
  if (payload.attach) {
    const url = await readAsDataUrl(blob);
    c.db.files.push({ id: uid(), originalName: `${payload.filename || 'เอกสารเซ็นแล้ว'}.pdf`, url, mimeType: 'application/pdf', fileSize: blob.size, refType: 'ticket', refId: t.id, uploadedBy: c.user!.id, uploadedAt: nowIso(), createdAt: nowIso(), category: 'doc-export' });
  }
  return new Raw(blob);
});

// ───────────── ข้อมูลตั้งต้น ─────────────
const TEMPLATES: [string, string, string, string][] = [
  ['ขอความอนุเคราะห์ประชาสัมพันธ์โครงการจังหวัด', 'R_MAIN', 'ที่ว่าการอำเภอตัวอย่าง', 'ที่ มท 0810.3/ว'],
  ['แจ้งจัดสรรงบประมาณเงินอุดหนุนทั่วไป', 'R_MAIN', 'กรมส่งเสริมการปกครองท้องถิ่น', 'ที่ มท 0808.2/ว'],
  ['ขอเชิญประชุมหัวหน้าส่วนราชการประจำเดือน', 'R_MAIN', 'ที่ว่าการอำเภอตัวอย่าง', 'ที่ มท 0810.3/ว'],
  ['ซักซ้อมแนวทางการจัดทำงบประมาณรายจ่ายประจำปี', 'R_MAIN', 'สำนักงานส่งเสริมการปกครองท้องถิ่นจังหวัด', 'ที่ มท 0820.2/ว'],
  ['ขออนุมัติจัดซื้อวัสดุสำนักงาน', 'R_MSG_MEMO', 'กองคลัง', 'ที่ กค 0001/'],
  ['ขออนุมัติเดินทางไปราชการ', 'R_MSG_MEMO', 'สำนักปลัด', 'ที่ สป 0001/'],
  ['รายงานผลการปฏิบัติงานประจำเดือน', 'R_MSG_MEMO', 'กองช่าง', 'ที่ กช 0001/'],
  ['ร้องเรียนถนนชำรุดหมู่ที่ 3', 'R_COMPLAIN', 'ประชาชน', 'ร้องเรียน'],
  ['ร้องเรียนน้ำประปาไม่ไหล หมู่ที่ 5', 'R_COMPLAIN', 'ประชาชน', 'ร้องเรียน'],
  ['ขอความร่วมมือสำรวจข้อมูลผู้สูงอายุ', 'S_NORMAL', 'องค์การบริหารส่วนตำบลตัวอย่าง', 'ที่ มท 0000/'],
  ['ส่งรายงานผลการดำเนินงานประจำไตรมาส', 'S_NORMAL', 'องค์การบริหารส่วนตำบลตัวอย่าง', 'ที่ มท 0000/'],
  ['คำสั่งแต่งตั้งคณะกรรมการตรวจรับพัสดุ', 'S_DIRECTION', 'องค์การบริหารส่วนตำบลตัวอย่าง', 'คำสั่งที่'],
  ['ประกาศรับสมัครพนักงานจ้างทั่วไป', 'S_ANNOUNCE', 'องค์การบริหารส่วนตำบลตัวอย่าง', 'ประกาศที่'],
];

registerSeed((db) => {
  db.tickets = []; db.ticketDepartments = []; db.timeline = []; db.ticketReads = [];
  let seedNum = 42;
  const rand = () => { seedNum = (seedNum * 9301 + 49297) % 233280; return seedNum / 233280; };
  const pick = <T,>(a: T[]): T => a[Math.floor(rand() * a.length)];
  const U = (n: string) => `user-${n}`;
  const workDepts = ['ADMIN', 'FINANCE', 'ENGINEERING', 'EDUCATION', 'HEALTH', 'WELFARE'];
  const heads: Record<string, string> = { ADMIN: 'head_admin', FINANCE: 'dir_finance', ENGINEERING: 'dir_eng', EDUCATION: 'dir_edu', HEALTH: 'dir_health', WELFARE: 'dir_welfare' };
  const officers: Record<string, string[]> = { ADMIN: ['off_general', 'off_hr', 'off_plan'], FINANCE: ['off_finance', 'off_revenue'], ENGINEERING: ['off_civil', 'off_infra'], EDUCATION: ['off_edu'], HEALTH: ['off_health'], WELFARE: ['off_welfare'] };
  const sigOf = (userId: string) => db.users.find((u) => u.id === userId)?.metadata?.signatureImage ?? null;
  const nameOf = (userId: string) => { const u = db.users.find((x) => x.id === userId)!; return { name: `(${u.titleTh}${u.fullNameTh})`, pos: u.positionName }; };
  const counters: Record<string, number> = {};
  const now = new Date();

  type Stage = 'person' | 'clerk' | 'mayor' | 'done' | 'cancelled';
  const make = (when: Date, tpl: [string, string, string, string], deptCode: string, stage: Stage, holderOverride?: string) => {
    const creatorId = U(pick(officers[deptCode]));
    const headId = U(heads[deptCode]);
    const [subject, book, sourceOrg, prefix] = tpl;
    const meta = BOOK_META.get(book)!;
    const year = buddhistYear(when);
    const ck = `${book}-${year}`;
    counters[ck] = (counters[ck] ?? 0) + 1;
    const id = uid();
    const at = (h: number) => new Date(when.getTime() + h * 3600_000).toISOString();
    const createdAt = when.toISOString();
    const signers: string[] = [creatorId];
    const trail: Row[] = [];
    const steps: Row[] = [{ step: CREATED_HOP, userId: creatorId, signedAt: at(0) }];
    let currentStep = 'PENDING_PERSON'; let holder: string | null = holderOverride ?? headId;
    trail.push({ fromUserId: creatorId, fromStep: CREATED_HOP, toUserId: holder, toStep: 'PENDING_PERSON', toDeptId: db.users.find((u) => u.id === holder)?.departmentId, at: at(0), note: null });
    log(db, id, 'สร้างสารบรรณ', creatorId, 'สร้าง + ประทับเซ็น + ส่งดำเนินการ', null, 'PENDING_PERSON', null, sigOf(creatorId), at(0));
    let clerkSignedAt: string | null = null, mayorSignedAt: string | null = null, completedAt: string | null = null, clerkBy: string | null = null, mayorBy: string | null = null;
    if (stage !== 'person' && stage !== 'cancelled') {
      steps.push({ step: 'PENDING_PERSON', userId: holder, signedAt: at(3) }); signers.push(holder!);
      const h = nameOf(holder!);
      log(db, id, 'รอผู้รับดำเนินการ', holder!, 'ประทับเซ็น + ส่งถึงปลัด', 'PENDING_PERSON', 'PENDING_CLERK', null, sigOf(holder!), at(3));
      trail.push({ fromUserId: holder, fromStep: 'PENDING_PERSON', toUserId: null, toStep: 'PENDING_CLERK', toDeptId: null, at: at(3), note: null });
      currentStep = 'PENDING_CLERK'; holder = null; void h;
    }
    if (stage === 'mayor' || stage === 'done') {
      steps.push({ step: 'PENDING_CLERK', userId: U('clerk'), signedAt: at(6) }); signers.push(U('clerk'));
      log(db, id, 'รอปลัด', U('clerk'), 'ประทับเซ็น + ส่งถึงนายก', 'PENDING_CLERK', 'PENDING_MAYOR', null, sigOf(U('clerk')), at(6));
      trail.push({ fromUserId: U('clerk'), fromStep: 'PENDING_CLERK', toUserId: null, toStep: 'PENDING_MAYOR', toDeptId: null, at: at(6), note: null });
      currentStep = 'PENDING_MAYOR'; clerkSignedAt = at(6); clerkBy = U('clerk');
    }
    if (stage === 'done') {
      steps.push({ step: 'PENDING_MAYOR', userId: U('mayor'), signedAt: at(26) }); signers.push(U('mayor'));
      log(db, id, 'รอนายก', U('mayor'), 'ลงนามปิดงาน', 'PENDING_MAYOR', 'COMPLETED', null, sigOf(U('mayor')), at(26));
      currentStep = 'COMPLETED'; mayorSignedAt = at(26); completedAt = at(26); mayorBy = U('mayor');
    }
    if (stage === 'cancelled') { currentStep = 'CANCELLED'; holder = null; log(db, id, 'ยกเลิก', creatorId, 'ยกเลิกเรื่อง', 'PENDING_PERSON', 'CANCELLED', 'ลงรับซ้ำ', null, at(2)); }
    const ownerDeptId = `dept-${deptCode}`;
    const sigItems = stage === 'person' || stage === 'cancelled' ? signers : signers;
    const overlayLayout = {
      version: 2, pages: [{ src: 'attachment', srcPage: 0 }],
      items: sigItems.map((uid_, i) => ({ id: `sig-${id.slice(0, 6)}-${i}`, type: 'signature', page: 0, x: 50 + (i % 2) * 22, y: 58 + Math.floor(i / 2) * 9, w: 22, h: 8, z: 2,
        props: { ownerId: uid_, sig: sigOf(uid_), name: nameOf(uid_).name, pos: nameOf(uid_).pos } })),
    };
    const t: Row = {
      id, organizationId: ORG_ID, ticketNumber: String(counters[ck]), receiveRegNumber: String(counters[ck]), registerBook: book, direction: meta.direction, fiscalYear: year,
      receivedDate: createdAt, receivedTime: createdAt.slice(11, 16), receivedRecordAt: createdAt, externalDocNumber: `${prefix}${String(100 + Math.floor(rand() * 900))}`, docDate: createdAt.slice(0, 10),
      sourceOrg, subject, recipient: 'นายกองค์การบริหารส่วนตำบล', body: `เรียน นายก อบต. ตามหนังสือที่อ้างถึง ${subject} จึงเรียนมาเพื่อโปรดพิจารณาดำเนินการ`,
      urgencyLevel: rand() < 0.78 ? 'ปกติ' : pick(['ด่วน', 'ด่วนมาก', 'ด่วนที่สุด']), confidentiality: rand() < 0.95 ? 'ปกติ' : 'ลับ',
      purpose: pick(['เพื่อทราบ', 'เพื่อพิจารณา', 'เพื่ออนุมัติ', 'เพื่อดำเนินการ']), ownerDeptId, responsibleUserId: headId, assignedHeadUserId: headId,
      currentStep, currentHolderUserId: holder, status: stepToStatus(currentStep), stepSignatures: steps, routeTrail: trail, overlayLayout,
      createdBy: creatorId, createdAt, updatedAt: completedAt ?? createdAt, clerkSignedBy: clerkBy, clerkSignedAt, mayorSignedBy: mayorBy, mayorSignedAt, completedAt,
    };
    db.tickets.push(t);
    db.ticketDepartments.push({ id: uid(), ticketId: id, departmentId: ownerDeptId, assignedUserId: headId, assignedUserIds: [headId], status: 'assigned', isActive: true });
    // ไฟล์แนบตัวอย่าง (ภาพหนังสือที่ public/demo)
    db.files.push({ id: uid(), originalName: `${subject}.png`, url: `/demo/letter-${(db.tickets.length % 4) + 1}.png`, mimeType: 'image/png', fileSize: 96000, refType: 'ticket', refId: id, uploadedBy: creatorId, uploadedAt: createdAt, createdAt });
    return t;
  };

  // ย้อนหลัง: ปีปัจจุบันถึงเดือนก่อน + ปีก่อนหน้า (ส่วนใหญ่เสร็จสิ้น) — ให้รายงานสรุปมีข้อมูล
  const months: { y: number; m: number }[] = [];
  for (let m = 0; m < now.getMonth(); m++) months.push({ y: now.getFullYear(), m });
  for (let m = 0; m < 12; m++) months.push({ y: now.getFullYear() - 1, m });
  for (const { y, m } of months) {
    const n = 4 + Math.floor(rand() * 5);
    for (let i = 0; i < n; i++) {
      const when = new Date(y, m, 1 + Math.floor(rand() * 26), 8 + Math.floor(rand() * 8), Math.floor(rand() * 60));
      make(when, pick(TEMPLATES), pick(workDepts), rand() < 0.92 ? 'done' : 'cancelled');
    }
  }
  // เดือนนี้: คละทุกขั้นตอน เพื่อให้เห็นกล่องงานของแต่ละบทบาท
  const day = (d: number, h = 9) => new Date(now.getFullYear(), now.getMonth(), Math.max(1, Math.min(d, now.getDate())), h, 15);
  const cur: [number, Stage, string, string?][] = [
    [now.getDate(), 'person', 'ENGINEERING', U('off_civil')], [now.getDate(), 'person', 'FINANCE'], [now.getDate() - 1, 'person', 'ADMIN'],
    [now.getDate() - 2, 'person', 'EDUCATION'], [now.getDate() - 3, 'clerk', 'HEALTH'], [now.getDate() - 4, 'clerk', 'ENGINEERING'],
    [now.getDate() - 5, 'mayor', 'ADMIN'], [now.getDate() - 6, 'mayor', 'WELFARE'], [now.getDate() - 8, 'done', 'FINANCE'], [now.getDate() - 9, 'done', 'ENGINEERING'],
    [now.getDate() - 10, 'person', 'WELFARE'], [now.getDate() - 12, 'clerk', 'FINANCE'], [now.getDate() - 14, 'done', 'ADMIN'],
  ];
  cur.forEach(([d, stage, dept, holder], i) => make(day(d, 8 + (i % 8)), TEMPLATES[i % TEMPLATES.length], dept, stage, holder));
  db.tickets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // แจ้งเตือนของเรื่องที่ค้างอยู่ + ประวัติกิจกรรมล่าสุด (ให้กระดิ่งและหน้า "ประวัติกิจกรรม" มีของให้ดูตั้งแต่เปิด)
  const holdersOf = (names: string[]) => db.userRoles.filter((r) => names.includes(db.roles.find((x) => x.id === r.roleId)?.name)).map((r) => r.userId);
  for (const t of db.tickets.filter((x) => !x.deletedAt && !['COMPLETED', 'CANCELLED'].includes(x.currentStep))) {
    const to = t.currentStep === 'PENDING_PERSON' ? [t.currentHolderUserId] : t.currentStep === 'PENDING_CLERK' ? holdersOf(['CLERK', 'DEPUTY_CLERK']) : holdersOf(['MAYOR', 'DEPUTY_MAYOR']);
    for (const userId of to) db.notifications.push({ id: uid(), userId, isRead: false, createdAt: t.updatedAt, type: 'ticket:step', title: 'มีสารบรรณรอท่านดำเนินการ', body: `${t.ticketNumber} — ${t.subject}`, actionUrl: `/correspondence/tickets/${t.id}` });
  }
  db.notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  db.audit = [...db.timeline].sort((a, b) => b.actedAt.localeCompare(a.actedAt)).slice(0, 40).map((w) => {
    const tk = db.tickets.find((x) => x.id === w.ticketId);
    const u = db.users.find((x) => x.id === w.actorId);
    return { id: uid(), action: /ปิดงาน|ประทับเซ็น/.test(w.action) ? 'APPROVE' : /ตีกลับ/.test(w.action) ? 'REJECT' : /สร้าง/.test(w.action) ? 'CREATE' : 'UPDATE', module: 'correspondence', resourceTitle: tk?.subject ?? '', userId: w.actorId, userName: u ? `${u.titleTh}${u.fullNameTh}` : '', ipAddress: '127.0.0.1', actedAt: w.actedAt };
  });
});
