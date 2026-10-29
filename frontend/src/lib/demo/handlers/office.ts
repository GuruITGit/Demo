/** บุคลากร · การลา · การประชุม · โครงการ · คลังเอกสาร · ข่าว · สรุปหน้าหลัก · ส่งออกรายงาน */
import {
  get, post, put, patch, del, registerSeed, paginate, textMatch, byId, removeById, uid, nowIso, userBrief, badRequest, forbidden, Raw,
  formToRow, fileView, blobUrl, type Ctx, type Db, type Row,
} from '../core';
import { ORG_ID } from '../seed-base';
import { hasPerm, isAdmin, needPerm, notify, orgTree } from './base';
import { thaiPdf } from '../pdf';

const DAY = 86400000;
const iso = (offsetDays: number, hour = 9, min = 0) => {
  const d = new Date(Date.now() + offsetDays * DAY);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};
const ymd = (offsetDays: number) => iso(offsetDays).slice(0, 10);
const thaiYear = () => new Date().getFullYear() + 543;
const csvBlob = (rows: (string | number | null | undefined)[][]) =>
  new Raw(new Blob(['﻿' + rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
const fullName = (u?: Row | null) => (u ? `${u.titleTh ?? ''}${u.fullNameTh ?? ''}`.trim() : '');

// ───────────────────────────── ข้อมูลตั้งต้น ─────────────────────────────
const LEAVE_TYPES = [
  ['ANNUAL', 'ลาพักผ่อน', 10, false], ['SICK', 'ลาป่วย', 30, false], ['SICK_HEAVY', 'ลาป่วยหนัก', 180, true], ['PERSONAL', 'ลากิจส่วนตัว', 5, false],
  ['MATERNITY', 'ลาคลอดบุตร', 98, true], ['ORDINATION', 'ลาอุปสมบท', 120, true], ['PUBLIC', 'ลาไปปฏิบัติงานสาธารณะ', 30, true],
  ['STUDY', 'ลาเพื่อการศึกษา', 365, true], ['HALF_DAY_MORNING', 'ลาครึ่งวันเช้า', null, false], ['HALF_DAY_AFTERNOON', 'ลาครึ่งวันบ่าย', null, false],
] as const;
const POSITIONS = [
  ['MAYOR', 'นายกองค์การบริหารส่วนตำบล', 10], ['DEPUTY_MAYOR', 'รองนายกองค์การบริหารส่วนตำบล', 9], ['CLERK', 'ปลัดองค์การบริหารส่วนตำบล', 9],
  ['DEPUTY_CLERK', 'รองปลัดองค์การบริหารส่วนตำบล', 8], ['DEPT_HEAD', 'ผู้อำนวยการกอง/หัวหน้าสำนักปลัด', 7], ['OFFICER', 'นักวิชาการ/เจ้าพนักงาน', 5],
  ['STAFF', 'เจ้าพนักงานปฏิบัติงาน', 3], ['WORKER', 'พนักงานจ้าง', 1],
] as const;
const DOC_CATEGORIES = [
  ['GENERAL', 'หนังสือทั่วไป'], ['REGULATION', 'กฎหมายและระเบียบ'], ['BUDGET', 'งบประมาณและการเงิน'], ['HR', 'ด้านบุคลากร'], ['PROCUREMENT', 'จัดซื้อจัดจ้าง'],
  ['DEVELOPMENT', 'โครงการพัฒนา'], ['MEETING', 'รายงานการประชุม'], ['REPORT', 'รายงาน'], ['CORRESPONDENCE', 'หนังสือโต้ตอบ'],
] as const;

const SAMPLE_PROPOSAL = (what: string, budget: string, where: string) => ({
  principle: `เพื่อให้การดำเนินงานตามแผนพัฒนาท้องถิ่นเป็นไปอย่างมีประสิทธิภาพ และตอบสนองความต้องการของประชาชนในพื้นที่ ${what}`,
  objectives: [`เพื่อ${what}`, 'เพื่อยกระดับคุณภาพชีวิตของประชาชนในพื้นที่', 'เพื่อให้การใช้งบประมาณเกิดประโยชน์สูงสุด'],
  targets: 'ประชาชนในเขตองค์การบริหารส่วนตำบล',
  methods: ['สำรวจและจัดทำแผนการดำเนินงาน', 'ประสานหน่วยงานที่เกี่ยวข้อง', 'ดำเนินการตามแผนและติดตามผลเป็นรายเดือน', 'สรุปและรายงานผลต่อผู้บริหาร'],
  responsible: 'กองช่าง องค์การบริหารส่วนตำบลตัวอย่าง',
  durationLocation: `ระยะเวลา 6 เดือน · สถานที่ ${where}`,
  budgetText: budget,
  expectedResults: ['ประชาชนได้รับประโยชน์อย่างทั่วถึง', 'โครงการแล้วเสร็จตามกำหนดเวลา'],
  proposers: [{ name: 'นายสมศักดิ์ ช่างดี', position: 'ผู้อำนวยการกองช่าง' }],
  approver: { name: 'นายสมชาย ดีใจ', position: 'นายกองค์การบริหารส่วนตำบล' },
});

registerSeed((db) => {
  // ── บุคลากร ──
  db.employees = db.users.filter((u) => u.username !== 'admin').map((u, i) => {
    const [first, ...rest] = String(u.fullNameTh).split(' ');
    return {
      id: `emp-${u.username}`, organizationId: ORG_ID, userId: u.id, employeeCode: `EMP-${String(i + 1).padStart(3, '0')}`, title: u.titleTh,
      firstNameTh: first, lastNameTh: rest.join(' ') || '-', nationalId: String(1100000000000 + i + 1), departmentId: u.departmentId, positionName: u.positionName,
      employeeType: 'พนักงานส่วนตำบล', hireDate: '2020-01-01', phone: u.phone, gender: u.titleTh === 'นาย' ? 'ชาย' : 'หญิง',
    };
  });
  db.positions = POSITIONS.map(([code, nameTh, level]) => ({ id: `pos-${code}`, code, nameTh, level }));

  // ── การลา ──
  db.leaveTypes = LEAVE_TYPES.map(([code, nameTh, maxDaysYear, requiresDoc]) => ({ id: `lt-${code}`, code, nameTh, maxDaysYear, requiresDoc }));
  const leave = (n: number, who: string, type: string, from: number, to: number, days: number, reason: string, delegate?: string, status = 'อนุมัติแล้ว') => ({
    id: uid(), organizationId: ORG_ID, requestNumber: `LV-${thaiYear()}-${String(n).padStart(5, '0')}`, employeeId: `emp-${who}`, leaveTypeId: `lt-${type}`,
    startDate: ymd(from), endDate: ymd(to), totalDays: days, reason, contactDuring: '', delegateId: delegate ? `emp-${delegate}` : null, status,
    submittedAt: iso(from - 3), approvedAt: status === 'อนุมัติแล้ว' ? iso(from - 3) : null, createdAt: iso(from - 3),
  });
  db.leaveRequests = [
    leave(1, 'off_civil', 'SICK', 0, 1, 2, 'ไข้หวัดใหญ่ พักรักษาตัว', 'off_infra'),
    leave(2, 'off_finance', 'ANNUAL', 0, 0, 1, 'ธุระส่วนตัว', 'off_revenue'),
    leave(3, 'off_edu', 'ANNUAL', 6, 10, 5, 'พักผ่อนกับครอบครัว'),
    leave(4, 'off_health', 'PERSONAL', 3, 3, 1, 'ติดต่อราชการส่วนตัว'),
    leave(5, 'head_admin', 'ANNUAL', -12, -10, 3, 'เดินทางต่างจังหวัด'),
    leave(6, 'off_hr', 'SICK', -20, -19, 2, 'ปวดหลัง'),
    leave(7, 'dir_welfare', 'PERSONAL', -30, -30, 1, 'งานบวชญาติ'),
    leave(8, 'off_procure', 'ANNUAL', 14, 16, 3, 'พักผ่อน', 'off_finance'),
  ];

  // ── การประชุม ──
  const mtg = (n: number, title: string, type: string, start: number, hour: number, chair: string, secretary: string, status: string, extra: Row = {}) => ({
    id: uid(), organizationId: ORG_ID, meetingNumber: `MTG-${thaiYear()}-${String(n).padStart(4, '0')}`, title, type,
    startDatetime: iso(start, hour), endDatetime: iso(start, hour + 2), location: 'ห้องประชุมสภา อบต.', isOnline: false, meetingUrl: '',
    chairId: `user-${chair}`, secretaryId: `user-${secretary}`, departmentId: null, status, minutesText: '', actualStart: null, actualEnd: null,
    createdBy: `user-${secretary}`, createdAt: iso(start - 7), ...extra,
  });
  db.meetings = [
    mtg(1, 'ประชุมหัวหน้าส่วนราชการประจำเดือน', 'ประชุมทั่วไป', 2, 9, 'clerk', 'off_general', 'กำหนดการ'),
    mtg(2, 'ประชุมสภา อบต. สมัยสามัญ สมัยที่ 3', 'ประชุมสภา', 7, 10, 'council_chair', 'off_general', 'กำหนดการ'),
    mtg(3, 'ประชุมคณะกรรมการจัดทำแผนพัฒนาท้องถิ่น', 'ประชุมคณะกรรมการ', 0, 13, 'mayor', 'off_plan', 'กำหนดการ', { departmentId: 'dept-ADMIN' }),
    mtg(4, 'ประชุมชี้แจงงบประมาณรายจ่ายประจำปี', 'ประชุมทั่วไป', -5, 9, 'dir_finance', 'off_finance', 'เสร็จสิ้น', {
      actualStart: iso(-5, 9, 5), actualEnd: iso(-5, 11, 30), minutesText: 'ที่ประชุมรับทราบแนวทางการจัดทำงบประมาณ และมอบหมายให้แต่ละกองส่งข้อมูลภายใน 15 วัน',
    }),
    mtg(5, 'ประชุมเตรียมความพร้อมรับมือสาธารณภัย', 'ประชุมทั่วไป', -14, 14, 'clerk', 'off_general', 'เสร็จสิ้น', { actualStart: iso(-14, 14), actualEnd: iso(-14, 15, 40), minutesText: 'กำหนดจุดอพยพและมอบหมายผู้รับผิดชอบรายหมู่บ้าน' }),
    mtg(6, 'ประชุมออนไลน์ซักซ้อมระบบสารบรรณอิเล็กทรอนิกส์', 'ประชุมทั่วไป', 4, 15, 'head_admin', 'off_hr', 'กำหนดการ', { isOnline: true, location: '', meetingUrl: 'https://meet.example.com/sao-demo' }),
  ];
  db.meetingAgenda = [];
  db.meetingAttendees = [];
  const agenda = (m: Row, items: string[]) => items.forEach((t, i) => db.meetingAgenda.push({ id: uid(), meetingId: m.id, orderNo: i + 1, title: t, description: '', durationMin: 20 }));
  const attend = (m: Row, ids: string[]) => {
    db.meetingAttendees.push({ id: uid(), meetingId: m.id, userId: m.chairId, role: 'ประธาน', isConfirmed: true });
    db.meetingAttendees.push({ id: uid(), meetingId: m.id, userId: m.secretaryId, role: 'เลขานุการ', isConfirmed: true });
    ids.forEach((u) => db.meetingAttendees.push({ id: uid(), meetingId: m.id, userId: `user-${u}`, role: 'ผู้เข้าร่วม', isConfirmed: Math.random() < 0.6 }));
  };
  db.meetings.forEach((m, i) => {
    agenda(m, ['เรื่องที่ประธานแจ้งให้ที่ประชุมทราบ', 'รับรองรายงานการประชุมครั้งที่ผ่านมา', 'เรื่องเสนอเพื่อพิจารณา', 'เรื่องอื่น ๆ']);
    attend(m, ['dir_eng', 'dir_edu', 'dir_health', 'dir_welfare', i % 2 ? 'off_civil' : 'off_finance']);
  });

  // ── โครงการ ──
  const proj = (n: number, title: string, strategy: string, budget: number, pct: number, status: string, dept: string, manager: string, what: string, where: string) => {
    const id = uid();
    const proposal = SAMPLE_PROPOSAL(what, `งบประมาณ ${budget.toLocaleString('th-TH')} บาท จากงบพัฒนาท้องถิ่น`, where);
    db.projects.push({
      id, organizationId: ORG_ID, projectNumber: `PJ-${thaiYear()}-${String(n).padStart(4, '0')}`, title, description: what, strategy, fiscalYear: thaiYear(),
      departmentId: `dept-${dept}`, projectManagerId: `emp-${manager}`, budgetAmount: budget, actualAmount: Math.round(budget * pct / 100), progressPct: pct, status,
      startDate: ymd(-90), endDate: ymd(120), targetGroup: 'ประชาชนในพื้นที่', expectedOutput: 'แล้วเสร็จตามแผน', proposal, createdById: 'user-off_plan', createdAt: iso(-100),
    });
    db.projectPlans.push({ id: uid(), projectId: id, planNo: 1, revisionNo: 0, changeType: 'แผนใหม่', title: 'แผนที่ 1', description: 'เปิดโครงการ — แผนที่ 1', proposal, budgetAmount: budget, progressPct: 0, status: 'แผน', createdById: 'user-off_plan', createdAt: iso(-100) });
    if (pct > 0) db.projectPlans.push({ id: uid(), projectId: id, planNo: 1, revisionNo: 1, changeType: 'อัปเดต', description: `ความคืบหน้า ${pct}%`, proposal, budgetAmount: budget, progressPct: pct, status, createdById: 'user-dir_eng', createdAt: iso(-30) });
  };
  db.projects = []; db.projectPlans = [];
  proj(1, 'โครงการก่อสร้างถนน คสล. สายหนองไผ่ หมู่ที่ 3', 'ด้านโครงสร้างพื้นฐาน', 2500000, 40, 'ดำเนินการ', 'ENGINEERING', 'off_civil', 'ก่อสร้างถนนคอนกรีตเสริมเหล็กเพื่อการสัญจรที่ปลอดภัย', 'หมู่ที่ 3');
  proj(2, 'โครงการขุดลอกคลองส่งน้ำ หมู่ที่ 5', 'ด้านโครงสร้างพื้นฐาน', 950000, 55, 'ดำเนินการ', 'ENGINEERING', 'off_infra', 'ขุดลอกคลองส่งน้ำเพื่อการเกษตรและระบายน้ำ', 'หมู่ที่ 5');
  proj(3, 'โครงการอบรมส่งเสริมอาชีพผู้สูงอายุ', 'ด้านคุณภาพชีวิต', 180000, 0, 'แผน', 'WELFARE', 'off_welfare', 'ส่งเสริมอาชีพเสริมให้ผู้สูงอายุมีรายได้', 'ศาลาประชาคม อบต.');
  proj(4, 'โครงการรณรงค์คัดแยกขยะในครัวเรือน', 'ด้านสิ่งแวดล้อม', 120000, 70, 'ดำเนินการ', 'HEALTH', 'off_health', 'ลดปริมาณขยะและส่งเสริมการคัดแยกขยะต้นทาง', 'ทุกหมู่บ้าน');
  proj(5, 'โครงการปรับปรุงศูนย์พัฒนาเด็กเล็ก', 'ด้านการศึกษา', 650000, 100, 'เสร็จสิ้น', 'EDUCATION', 'off_edu', 'ปรับปรุงอาคารและสนามเด็กเล่นให้ได้มาตรฐาน', 'ศูนย์พัฒนาเด็กเล็กประจำตำบล');
  proj(6, 'โครงการติดตั้งไฟฟ้าส่องสว่างสาธารณะ', 'ด้านโครงสร้างพื้นฐาน', 420000, 20, 'ดำเนินการ', 'ENGINEERING', 'off_civil', 'ติดตั้งไฟส่องสว่างในจุดเสี่ยง', 'หมู่ที่ 1–6');

  // ── คลังเอกสาร ──
  db.docCategories = DOC_CATEGORIES.map(([code, nameTh]) => ({ id: `cat-${code}`, code, nameTh }));
  const doc = (title: string, cat: string, n: number, access: string, dept: string, by: string, img: number, tags: string[], desc: string) => ({
    id: uid(), organizationId: ORG_ID, docNumber: `DOC-${thaiYear()}-${String(n).padStart(4, '0')}`, title, categoryId: `cat-${cat}`, accessLevel: access,
    departmentId: `dept-${dept}`, docDate: ymd(-n * 9), docYear: String(thaiYear()), description: desc, tags, fileUrl: `/demo/letter-${img}.png`, fileName: `${title}.png`, fileSize: 90000,
    mimeType: 'image/png', createdBy: `user-${by}`, createdAt: iso(-n * 9), viewCount: 3 + n * 2, downloadCount: n, ownerOrg: 'องค์การบริหารส่วนตำบลตัวอย่าง',
  });
  db.documents = [
    doc('ระเบียบการเบิกจ่ายเงินขององค์กรปกครองส่วนท้องถิ่น', 'REGULATION', 1, 'public', 'FINANCE', 'dir_finance', 2, ['ระเบียบ', 'การเงิน'], 'ระเบียบที่ใช้ในการเบิกจ่ายประจำปี'),
    doc('แผนพัฒนาท้องถิ่น (พ.ศ. 2566–2570)', 'DEVELOPMENT', 2, 'internal', 'ADMIN', 'off_plan', 1, ['แผนพัฒนา'], 'แผนพัฒนาท้องถิ่นห้าปี'),
    doc('รายงานการประชุมสภา สมัยสามัญ ครั้งที่ 2', 'MEETING', 3, 'internal', 'ADMIN', 'off_general', 3, ['ประชุม', 'สภา'], 'รายงานการประชุมที่รับรองแล้ว'),
    doc('บันทึกขออนุมัติซ่อมไฟฟ้าสาธารณะ หมู่ 3', 'CORRESPONDENCE', 4, 'internal', 'ENGINEERING', 'off_civil', 3, ['ไฟฟ้า', 'ซ่อมแซม'], 'ขออนุมัติงบซ่อมแซม'),
    doc('แบบคำร้องเรียนถนนชำรุด', 'GENERAL', 5, 'internal', 'ADMIN', 'off_general', 4, ['ร้องเรียน'], 'คำร้องเรียนจากประชาชน'),
    doc('รายงานผลการปฏิบัติงานด้านบุคคล ประจำปี', 'HR', 6, 'confidential', 'ADMIN', 'off_hr', 1, ['บุคลากร'], 'ข้อมูลลับ — เฉพาะผู้เกี่ยวข้อง'),
    doc('ประกาศราคากลางงานก่อสร้างถนน', 'PROCUREMENT', 7, 'public', 'FINANCE', 'off_procure', 2, ['จัดซื้อจัดจ้าง', 'ประกาศ'], 'ราคากลางสำหรับการจัดซื้อจัดจ้าง'),
    doc('แนวทางการจัดทำงบประมาณรายจ่ายประจำปี', 'BUDGET', 8, 'internal', 'FINANCE', 'off_finance', 2, ['งบประมาณ'], 'ซักซ้อมแนวทางจากกรมส่งเสริมฯ'),
  ];

  // ── ข่าว/ประกาศ ──
  const news = (title: string, category: string, excerpt: string, daysAgo: number, pinned = false, status = 'published', cover: string | null = null) => ({
    id: uid(), organizationId: ORG_ID, title, category, excerpt, content: `${excerpt}\n\nรายละเอียดเพิ่มเติม ติดต่อสอบถามได้ที่ฝ่ายประชาสัมพันธ์ องค์การบริหารส่วนตำบลตัวอย่าง โทร. 02-234-5678 ในวันและเวลาราชการ`,
    status, pinned, coverUrl: cover, publishedAt: iso(-daysAgo), createdAt: iso(-daysAgo), createdBy: 'user-off_general',
  });
  db.news = [
    news('ประชาสัมพันธ์การชำระภาษีที่ดินและสิ่งปลูกสร้าง ประจำปี 2569', 'ข่าวประชาสัมพันธ์', 'ขอเชิญชวนผู้เสียภาษีชำระภาษีภายในกำหนด ณ กองคลัง อบต.', 2, true, 'published', '/citizen/hero.jpg'),
    news('ประกาศประกวดราคาก่อสร้างถนน คสล. สายหนองไผ่', 'ประกาศจัดซื้อจัดจ้าง', 'อบต. ประกาศประกวดราคาก่อสร้างถนน ผู้สนใจติดต่อขอรับเอกสารที่กองคลัง', 5),
    news('กิจกรรมวันผู้สูงอายุแห่งชาติ ประจำปี 2569', 'กิจกรรม', 'ขอเชิญผู้สูงอายุทุกท่านร่วมกิจกรรมรดน้ำขอพร พร้อมรับของที่ระลึก', 9),
    news('ประกาศปิดทำการในวันหยุดนักขัตฤกษ์', 'ประกาศทั่วไป', 'อบต. ปิดทำการตามประกาศ หากมีเหตุฉุกเฉินติดต่อสายด่วน 1669', 14),
    news('รับสมัครพนักงานจ้างทั่วไป จำนวน 2 อัตรา', 'ประกาศทั่วไป', 'เปิดรับสมัครตั้งแต่วันนี้ถึงสิ้นเดือน ณ สำนักปลัด อบต.', 20),
    news('ร่างประกาศ: ตารางจัดเก็บขยะประจำเดือน', 'ข่าวประชาสัมพันธ์', 'อยู่ระหว่างตรวจทาน', 1, false, 'draft'),
  ];
});

// ───────────────────────────── บุคลากร ─────────────────────────────
get('/hr/positions', (c) => c.db.positions);
get('/hr/employees', (c) => {
  needPerm(c, 'hr:read:Employee');
  const { search, departmentId } = c.query;
  const rows = c.db.employees.filter((e) => (!departmentId || e.departmentId === departmentId) && textMatch(e, ['firstNameTh', 'lastNameTh', 'employeeCode', 'positionName'], search));
  return paginate(rows, c.query, 20);
});
post('/hr/employees', (c) => {
  needPerm(c, 'hr:create:Employee');
  const b = c.body ?? {};
  if (!b.firstNameTh || !b.lastNameTh) throw badRequest('กรุณาระบุชื่อและนามสกุล');
  if (c.db.employees.some((e) => e.nationalId === b.nationalId)) throw badRequest('เลขบัตรประชาชนนี้มีอยู่แล้ว');
  const pos = c.db.positions.find((p) => p.id === b.positionId);
  const e = { id: uid(), organizationId: ORG_ID, ...b, positionName: b.positionName || pos?.nameTh || '', employeeCode: b.employeeCode || `EMP-${String(c.db.employees.length + 1).padStart(3, '0')}`, createdAt: nowIso() };
  c.db.employees.push(e);
  return e;
});
get('/hr/employees/:id', (c) => byId(c.db.employees, c.params.id));
put('/hr/employees/:id', (c) => { needPerm(c, 'hr:update:Employee'); return Object.assign(byId(c.db.employees, c.params.id), c.body ?? {}); });
del('/hr/employees/:id', (c) => { needPerm(c, 'hr:delete:Employee'); removeById(c.db.employees, c.params.id); return { ok: true }; });

/** สถานะประจำวันของผู้ใช้: ลา / ประชุม / มา */
function awayOf(db: Db) {
  const today = ymd(0);
  const empUser = (empId: string) => db.employees.find((e) => e.id === empId);
  const leaveToday = db.leaveRequests.filter((l) => l.status === 'อนุมัติแล้ว' && l.startDate <= today && l.endDate >= today);
  const meetingToday = db.meetings.filter((m) => m.startDatetime.slice(0, 10) === today && m.status !== 'ยกเลิก');
  const view = (l: Row) => { const e = empUser(l.employeeId); return { id: l.id, title: e?.title, firstName: e?.firstNameTh, lastName: e?.lastNameTh, type: db.leaveTypes.find((t) => t.id === l.leaveTypeId)?.nameTh, startDate: l.startDate, endDate: l.endDate }; };
  return {
    leaveToday: leaveToday.map(view),
    meetingToday: meetingToday.map((m) => ({ id: m.id, title: m.title, startDatetime: m.startDatetime })),
    upcomingLeave: db.leaveRequests.filter((l) => l.status === 'อนุมัติแล้ว' && l.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 10).map(view),
    _leaveUserIds: leaveToday.map((l) => empUser(l.employeeId)?.userId),
    _meetingUserIds: meetingToday.flatMap((m) => db.meetingAttendees.filter((a) => a.meetingId === m.id).map((a) => a.userId)),
  };
}
get('/users/away/today', (c) => awayOf(c.db));
// เพิ่มสถานะ มา/ลา/ประชุม ให้ทำเนียบบุคลากร (หลัง /users/directory ของ base)
export function statusOfUser(db: Db, userId: string): string {
  const a = awayOf(db);
  if (a._leaveUserIds.includes(userId)) return 'ลา';
  if (a._meetingUserIds.includes(userId)) return 'ประชุม';
  return 'มา';
}
get('/users/directory', (c) => {
  const away = awayOf(c.db);
  const st = (u: Row) => ({ ...u, status: away._leaveUserIds.includes(u.id) ? 'ลา' : away._meetingUserIds.includes(u.id) ? 'ประชุม' : 'มา' });
  return orgTree(c, true).map((g) => ({ ...g, departments: g.departments.map((d) => ({ ...d, users: d.users.map(st), divisions: d.divisions.map((v: Row) => ({ ...v, users: v.users.map(st) })) })) }));
});
get('/users/:id/profile', (c) => {
  const u = byId(c.db.users, c.params.id);
  const dept = c.db.departments.find((d) => d.id === u.departmentId);
  const div = c.db.divisions.find((d) => d.id === u.divisionId);
  return {
    id: u.id, titleTh: u.titleTh, fullNameTh: u.fullNameTh, fullNameEn: u.fullNameEn, positionName: u.positionName, phone: u.phone, email: u.email, avatarUrl: u.avatarUrl,
    status: statusOfUser(c.db, u.id),
    department: dept && { id: dept.id, nameTh: dept.nameTh, groupLabel: dept.groupLabel }, division: div && { id: div.id, nameTh: div.nameTh },
  };
});

// ───────────────────────────── การลา ─────────────────────────────
const isManager = (db: Db, u: Row) => db.userRoles.some((r) => r.userId === u.id && ['role-MAYOR', 'role-CLERK', 'role-ADMIN', 'role-SUPER_ADMIN', 'role-DEPT_HEAD'].includes(r.roleId));
const myEmployee = (db: Db, u: Row) => db.employees.find((e) => e.userId === u.id);
function leaveView(db: Db, l: Row, detail = false): Row {
  return {
    ...l, employee: db.employees.find((e) => e.id === l.employeeId), leaveType: db.leaveTypes.find((t) => t.id === l.leaveTypeId),
    ...(detail ? { delegate: db.employees.find((e) => e.id === l.delegateId), currentApprover: l.currentApproverId ? userBrief(l.currentApproverId) : null } : {}),
  };
}
const leaveFilter = (rows: Row[], q: Row, db: Db) => rows.filter((l) => (!q.status || l.status === q.status) && (!q.search || textMatch(leaveView(db, l), ['requestNumber', 'employee.firstNameTh', 'employee.lastNameTh', 'leaveType.nameTh'], q.search)));
get('/leave/types', (c) => c.db.leaveTypes);
get('/leave/requests/my', (c) => {
  const e = myEmployee(c.db, c.user!);
  const rows = e ? leaveFilter(c.db.leaveRequests.filter((l) => l.employeeId === e.id), c.query, c.db) : [];
  const p = paginate(rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), c.query, 15);
  p.data = p.data.map((l) => leaveView(c.db, l));
  return p;
});
get('/leave/requests', (c) => {
  needPerm(c, 'leave:read:LeaveRequest');
  let rows = c.db.leaveRequests;
  if (!isManager(c.db, c.user!)) { const e = myEmployee(c.db, c.user!); rows = rows.filter((l) => l.employeeId === e?.id); }
  const p = paginate(leaveFilter(rows, c.query, c.db).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), c.query, 15);
  p.data = p.data.map((l) => leaveView(c.db, l));
  return p;
});
post('/leave/requests', (c) => {
  needPerm(c, 'leave:create:LeaveRequest');
  const e = myEmployee(c.db, c.user!);
  if (!e) throw badRequest('ไม่พบข้อมูลพนักงานของบัญชีนี้ — ผู้ดูแลต้องเพิ่มพนักงานและผูกบัญชีก่อน');
  const b = c.body ?? {};
  if (!b.leaveTypeId || !b.startDate || !b.endDate) throw badRequest('กรุณากรอกข้อมูลการลาให้ครบ');
  const n = c.db.leaveRequests.length + 1;
  // การลาบันทึกแล้วมีผลทันที ไม่ต้องรออนุมัติ (ตามระบบจริง)
  const l = {
    id: uid(), organizationId: ORG_ID, requestNumber: `LV-${thaiYear()}-${String(n).padStart(5, '0')}`, employeeId: e.id, leaveTypeId: b.leaveTypeId,
    startDate: b.startDate, endDate: b.endDate, totalDays: Number(b.totalDays), reason: b.reason, contactDuring: b.contactDuring ?? null, delegateId: b.delegateId ?? null,
    status: 'อนุมัติแล้ว', submittedAt: nowIso(), approvedAt: nowIso(), createdAt: nowIso(),
  };
  c.db.leaveRequests.unshift(l);
  const head = c.db.departments.find((d) => d.id === e.departmentId)?.headUserId;
  if (head && head !== c.user!.id) notify(c.db, [head], { type: 'leave:recorded', title: 'มีการบันทึกการลา', body: `${e.firstNameTh} ${e.lastNameTh} ลา ${l.totalDays} วัน`, actionUrl: `/leave/${l.id}` });
  return l;
});
get('/leave/requests/:id', (c) => leaveView(c.db, byId(c.db.leaveRequests, c.params.id), true));
post('/leave/requests/:id/approve', (c) => { const l = byId(c.db.leaveRequests, c.params.id); if (l.status !== 'อนุมัติแล้ว') Object.assign(l, { status: 'อนุมัติแล้ว', approvedAt: nowIso() }); return { message: 'อนุมัติแล้ว' }; });
post('/leave/requests/:id/reject', (c) => { Object.assign(byId(c.db.leaveRequests, c.params.id), { status: 'ไม่อนุมัติ', comment: c.body?.comment }); return { message: 'ไม่อนุมัติ' }; });
post('/leave/requests/:id/cancel', (c) => { Object.assign(byId(c.db.leaveRequests, c.params.id), { status: 'ยกเลิก' }); return { message: 'ยกเลิกแล้ว' }; });
del('/leave/requests/:id', (c) => {
  const l = byId(c.db.leaveRequests, c.params.id);
  const owner = c.db.employees.find((e) => e.id === l.employeeId);
  if (!isAdmin(c.db, c.user!) && owner?.userId !== c.user!.id && !hasPerm(c.db, c.user, 'leave:delete:LeaveRequest')) throw forbidden();
  removeById(c.db.leaveRequests, l.id);
  return { ok: true };
});
get('/reports/leave/excel', (c) => csvBlob([['เลขที่', 'ผู้ลา', 'ประเภท', 'เริ่ม', 'ถึง', 'วัน', 'สถานะ'], ...c.db.leaveRequests.map((l) => { const v = leaveView(c.db, l); return [l.requestNumber, `${v.employee?.firstNameTh} ${v.employee?.lastNameTh}`, v.leaveType?.nameTh, l.startDate, l.endDate, l.totalDays, l.status]; })]));
get('/reports/leave/:id/pdf', async (c) => {
  const v = leaveView(c.db, byId(c.db.leaveRequests, c.params.id), true);
  return new Raw(await thaiPdf([
    { text: 'ใบลา', bold: true, size: 26, align: 'center', gap: 6 }, { text: `เลขที่ ${v.requestNumber}`, gap: 4 },
    { text: `ผู้ลา: ${v.employee?.title ?? ''}${v.employee?.firstNameTh} ${v.employee?.lastNameTh}` }, { text: `ประเภทการลา: ${v.leaveType?.nameTh}` },
    { text: `ตั้งแต่วันที่ ${v.startDate} ถึงวันที่ ${v.endDate} รวม ${v.totalDays} วัน` }, { text: `เหตุผล: ${v.reason}` }, { text: `สถานะ: ${v.status}`, gap: 4 },
    { text: '(เอกสารจากระบบเดโม่)', size: 12 },
  ]));
});

// ───────────────────────────── การประชุม ─────────────────────────────
function meetingView(db: Db, m: Row): Row {
  return { ...m, chair: userBrief(m.chairId), secretary: userBrief(m.secretaryId), department: db.departments.find((d) => d.id === m.departmentId) && { id: m.departmentId, nameTh: db.departments.find((d) => d.id === m.departmentId)!.nameTh } };
}
get('/meetings/my', (c) => {
  const ids = new Set(c.db.meetingAttendees.filter((a) => a.userId === c.user!.id).map((a) => a.meetingId));
  return c.db.meetings.filter((m) => ids.has(m.id) || m.createdBy === c.user!.id).sort((a, b) => b.startDatetime.localeCompare(a.startDatetime)).map((m) => meetingView(c.db, m));
});
get('/meetings', (c) => {
  needPerm(c, 'meetings:read:Meeting');
  const { search, status } = c.query;
  const rows = c.db.meetings.filter((m) => (!status || m.status === status) && textMatch(m, ['title', 'meetingNumber'], search)).sort((a, b) => b.startDatetime.localeCompare(a.startDatetime));
  const p = paginate(rows, c.query, 15);
  p.data = p.data.map((m) => meetingView(c.db, m));
  return p;
});
post('/meetings', (c) => {
  needPerm(c, 'meetings:create:Meeting');
  const b = c.body ?? {};
  if (!b.title?.trim()) throw badRequest('กรุณาระบุชื่อการประชุม');
  if (!b.startDatetime || !b.endDatetime) throw badRequest('กรุณาระบุวันเวลาประชุม');
  const m = {
    id: uid(), organizationId: ORG_ID, meetingNumber: `MTG-${thaiYear()}-${String(c.db.meetings.length + 1).padStart(4, '0')}`, title: b.title.trim(), type: b.type || 'ประชุมทั่วไป',
    startDatetime: new Date(b.startDatetime).toISOString(), endDatetime: new Date(b.endDatetime).toISOString(), location: b.location || '', isOnline: !!b.isOnline, meetingUrl: b.meetingUrl || '',
    chairId: b.chairId || c.user!.id, secretaryId: b.secretaryId || null, departmentId: b.departmentId || null, status: 'กำหนดการ', minutesText: '', actualStart: null, actualEnd: null,
    createdBy: c.user!.id, createdAt: nowIso(),
  };
  c.db.meetings.unshift(m);
  c.db.meetingAttendees.push({ id: uid(), meetingId: m.id, userId: m.chairId, role: 'ประธาน', isConfirmed: true });
  if (m.secretaryId) c.db.meetingAttendees.push({ id: uid(), meetingId: m.id, userId: m.secretaryId, role: 'เลขานุการ', isConfirmed: true });
  return meetingView(c.db, m);
});
get('/meetings/:id', (c) => meetingView(c.db, byId(c.db.meetings, c.params.id)));
get('/meetings/:id/attendees', (c) => c.db.meetingAttendees.filter((a) => a.meetingId === c.params.id).map((a) => ({ ...a, user: userBrief(a.userId) })));
get('/meetings/:id/agenda', (c) => c.db.meetingAgenda.filter((a) => a.meetingId === c.params.id).sort((a, b) => a.orderNo - b.orderNo));
post('/meetings/:id/agenda', (c) => {
  byId(c.db.meetings, c.params.id);
  if (!c.body?.title?.trim()) throw badRequest('กรุณาระบุหัวข้อวาระ');
  const a = { id: uid(), meetingId: c.params.id, orderNo: c.db.meetingAgenda.filter((x) => x.meetingId === c.params.id).length + 1, title: c.body.title.trim(), description: c.body.description ?? '', durationMin: c.body.durationMinutes ?? null };
  c.db.meetingAgenda.push(a);
  return a;
});
post('/meetings/:id/invite', (c) => {
  const m = byId(c.db.meetings, c.params.id);
  const ids: string[] = c.body?.userIds ?? [];
  const added: string[] = [];
  for (const userId of ids) if (!c.db.meetingAttendees.some((a) => a.meetingId === m.id && a.userId === userId)) { c.db.meetingAttendees.push({ id: uid(), meetingId: m.id, userId, role: 'ผู้เข้าร่วม', isConfirmed: false }); added.push(userId); }
  notify(c.db, added.filter((x) => x !== c.user!.id), { type: 'meeting:invite', title: 'นัดประชุมใหม่', body: `${m.title} · ${new Date(m.startDatetime).toLocaleString('th-TH')}`, actionUrl: `/meetings/${m.id}` });
  return { invited: added.length };
});
patch('/meetings/:id/minutes', (c) => { byId(c.db.meetings, c.params.id).minutesText = String(c.body?.minutesText ?? ''); return { ok: true }; });
post('/meetings/:id/start', (c) => { const m = byId(c.db.meetings, c.params.id); Object.assign(m, { status: 'กำลังประชุม', actualStart: nowIso() }); return meetingView(c.db, m); });
post('/meetings/:id/finish', (c) => { const m = byId(c.db.meetings, c.params.id); Object.assign(m, { status: 'เสร็จสิ้น', actualEnd: nowIso() }); return meetingView(c.db, m); });
post('/meetings/:id/cancel', (c) => { const m = byId(c.db.meetings, c.params.id); m.status = 'ยกเลิก'; return meetingView(c.db, m); });
del('/meetings/:id', (c) => {
  const m = byId(c.db.meetings, c.params.id);
  if (!isAdmin(c.db, c.user!) && m.createdBy !== c.user!.id && !hasPerm(c.db, c.user, 'meetings:delete:Meeting')) throw forbidden();
  removeById(c.db.meetings, m.id);
  c.db.meetingAgenda = c.db.meetingAgenda.filter((a) => a.meetingId !== m.id);
  c.db.meetingAttendees = c.db.meetingAttendees.filter((a) => a.meetingId !== m.id);
  return { ok: true };
});
get('/reports/meetings/excel', (c) => csvBlob([['เลขที่', 'หัวข้อ', 'วันเวลา', 'สถานที่', 'สถานะ'], ...c.db.meetings.map((m) => [m.meetingNumber, m.title, m.startDatetime, m.location, m.status])]));

// ───────────────────────────── โครงการ ─────────────────────────────
function projectView(db: Db, p: Row, detail = false): Row {
  const dept = db.departments.find((d) => d.id === p.departmentId);
  const out: Row = { ...p, department: dept && { id: dept.id, nameTh: dept.nameTh } };
  if (detail) {
    const mgr = db.employees.find((e) => e.id === p.projectManagerId);
    out.projectManager = mgr && { id: mgr.id, fullNameTh: `${mgr.firstNameTh} ${mgr.lastNameTh}` };
    out.createdBy = userBrief(p.createdById);
    out.plans = db.projectPlans.filter((pl) => pl.projectId === p.id).sort((a, b) => a.planNo - b.planNo || a.revisionNo - b.revisionNo).map((pl) => ({ ...pl, createdBy: userBrief(pl.createdById) }));
  }
  return out;
}
get('/projects', (c) => {
  needPerm(c, 'projects:read:Project');
  const { search, status, fiscalYear } = c.query;
  const rows = c.db.projects.filter((p) => (!status || p.status === status) && (!fiscalYear || String(p.fiscalYear) === String(fiscalYear)) && textMatch(p, ['title', 'projectNumber'], search)).sort((a, b) => b.projectNumber.localeCompare(a.projectNumber));
  const pg = paginate(rows, c.query, 15);
  pg.data = pg.data.map((p) => projectView(c.db, p));
  return pg;
});
post('/projects', (c) => {
  needPerm(c, 'projects:manage:Project');
  const b = c.body ?? {};
  if (!b.title?.trim()) throw badRequest('กรุณากรอกชื่อโครงการ');
  const year = Number(b.fiscalYear) || thaiYear();
  const id = uid();
  const p = {
    id, organizationId: ORG_ID, projectNumber: `PJ-${year}-${String(c.db.projects.filter((x) => x.fiscalYear === year).length + 1).padStart(4, '0')}`, title: b.title.trim(), description: b.description ?? '',
    strategy: b.strategy ?? '', fiscalYear: year, departmentId: b.deptId || b.departmentId || null, projectManagerId: b.projectManagerId || null, budgetAmount: Number(b.budgetAmount) || 0, actualAmount: 0, progressPct: 0,
    status: b.status || 'แผน', startDate: b.startDate || null, endDate: b.endDate || null, targetGroup: b.targetGroup ?? '', expectedOutput: b.expectedOutput ?? '', proposal: b.proposal ?? null, createdById: c.user!.id, createdAt: nowIso(),
  };
  c.db.projects.unshift(p);
  c.db.projectPlans.push({ id: uid(), projectId: id, planNo: 1, revisionNo: 0, changeType: 'แผนใหม่', title: 'แผนที่ 1', description: b.planNote || 'เปิดโครงการ — แผนที่ 1', proposal: p.proposal, budgetAmount: p.budgetAmount, progressPct: 0, status: p.status, createdById: c.user!.id, createdAt: nowIso() });
  return projectView(c.db, p);
});
get('/projects/:id', (c) => projectView(c.db, byId(c.db.projects, c.params.id), true));
put('/projects/:id', (c) => {
  needPerm(c, 'projects:manage:Project');
  const p = byId(c.db.projects, c.params.id);
  const b = c.body ?? {};
  for (const k of ['title', 'description', 'strategy', 'fiscalYear', 'budgetAmount', 'actualAmount', 'targetGroup', 'expectedOutput', 'startDate', 'endDate', 'progressPct', 'status', 'departmentId', 'projectManagerId', 'proposal']) if (k in b) p[k] = b[k];
  return projectView(c.db, p);
});
del('/projects/:id', (c) => { needPerm(c, 'projects:manage:Project'); removeById(c.db.projects, c.params.id); c.db.projectPlans = c.db.projectPlans.filter((pl) => pl.projectId !== c.params.id); return { ok: true }; });
function appendPlan(c: Ctx, kind: 'update' | 'new') {
  needPerm(c, 'projects:manage:Project');
  const p = byId(c.db.projects, c.params.id);
  const plans = c.db.projectPlans.filter((pl) => pl.projectId === p.id).sort((a, b) => a.planNo - b.planNo || a.revisionNo - b.revisionNo);
  const last = plans[plans.length - 1];
  const planNo = kind === 'update' ? last?.planNo || 1 : (last?.planNo || 0) + 1;
  const revisionNo = kind === 'update' ? (last?.revisionNo ?? -1) + 1 : 0;
  const proposal = c.body?.proposal ?? p.proposal;
  p.proposal = proposal;
  c.db.projectPlans.push({ id: uid(), projectId: p.id, planNo, revisionNo, changeType: kind === 'update' ? 'อัปเดต' : 'แผนใหม่', title: kind === 'new' ? `แผนที่ ${planNo}` : undefined,
    description: c.body?.description ?? '', proposal, budgetAmount: p.budgetAmount, progressPct: p.progressPct, status: p.status, createdById: c.user!.id, createdAt: nowIso() });
  return projectView(c.db, p, true);
}
post('/projects/:id/update', (c) => appendPlan(c, 'update'));
post('/projects/:id/new-plan', (c) => appendPlan(c, 'new'));

// ───────────────────────────── คลังเอกสาร ─────────────────────────────
function docVisible(db: Db, d: Row, u: Row) {
  if (d.accessLevel !== 'confidential') return true;
  return isAdmin(db, u) || d.createdBy === u.id || (!!u.departmentId && d.departmentId === u.departmentId);
}
function docView(db: Db, d: Row): Row {
  const cat = db.docCategories.find((x) => x.id === d.categoryId);
  return { ...d, fileUrl: blobUrl(d.fileUrl), category: cat && { id: cat.id, nameTh: cat.nameTh }, creator: userBrief(d.createdBy), department: db.departments.find((x) => x.id === d.departmentId) && { id: d.departmentId, nameTh: db.departments.find((x) => x.id === d.departmentId)!.nameTh } };
}
get('/documents/categories', (c) => c.db.docCategories);
post('/documents/categories', (c) => {
  needPerm(c, 'dms:manage:Category');
  const nameTh = String(c.body?.nameTh ?? '').trim();
  if (!nameTh) throw badRequest('กรุณากรอกชื่อหมวดหมู่');
  const r = { id: uid(), code: `C${Date.now()}`, nameTh };
  c.db.docCategories.push(r);
  return r;
});
put('/documents/categories/:id', (c) => { needPerm(c, 'dms:manage:Category'); return Object.assign(byId(c.db.docCategories, c.params.id), { nameTh: c.body?.nameTh }); });
del('/documents/categories/:id', (c) => {
  needPerm(c, 'dms:manage:Category');
  if (c.db.documents.some((d) => d.categoryId === c.params.id)) throw badRequest('ยังมีเอกสารในหมวดนี้ ลบไม่ได้');
  removeById(c.db.docCategories, c.params.id);
  return { ok: true };
});
get('/documents', (c) => {
  needPerm(c, 'dms:read:Document');
  const { search, categoryId, accessLevel, departmentId, dateFrom, dateTo } = c.query;
  const rows = c.db.documents.filter((d) => docVisible(c.db, d, c.user!) && (!categoryId || d.categoryId === categoryId) && (!accessLevel || d.accessLevel === accessLevel)
    && (!departmentId || d.departmentId === departmentId) && (!dateFrom || d.createdAt.slice(0, 10) >= dateFrom) && (!dateTo || d.createdAt.slice(0, 10) <= dateTo)
    && (!search || textMatch(d, ['title', 'docNumber', 'description', 'tags'], search))).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const p = paginate(rows, c.query, 15);
  p.data = p.data.map((d) => docView(c.db, d));
  return p;
});
post('/documents', async (c) => {
  needPerm(c, 'dms:create:Document');
  const f = await formToRow(c.body);
  if (!f.title?.trim()) throw badRequest('กรุณาระบุชื่อเอกสาร');
  if (!f.file) throw badRequest('กรุณาเลือกไฟล์');
  let tags: string[] = [];
  try { tags = f.tags ? JSON.parse(f.tags) : []; } catch { tags = []; }
  const n = c.db.documents.length + 1;
  const d = {
    id: uid(), organizationId: ORG_ID, docNumber: f.docNumber || `DOC-${thaiYear()}-${String(n).padStart(4, '0')}`, title: f.title.trim(), categoryId: f.categoryId || null, accessLevel: f.accessLevel || 'internal',
    departmentId: f.departmentId || c.user!.departmentId || null, docDate: f.docDate || null, docYear: f.docYear || String(thaiYear()), description: f.description ?? '', tags,
    fileUrl: f.file.url, fileName: f.file.name, fileSize: f.file.size, mimeType: f.file.type, createdBy: c.user!.id, createdAt: nowIso(), viewCount: 0, downloadCount: 0, ownerOrg: '',
  };
  c.db.documents.unshift(d);
  return docView(c.db, d);
});
get('/documents/:id', (c) => {
  const d = byId(c.db.documents, c.params.id);
  if (!docVisible(c.db, d, c.user!)) throw forbidden('เอกสารชั้นลับ — ไม่มีสิทธิ์เข้าถึง');
  d.viewCount = (d.viewCount ?? 0) + 1;
  return docView(c.db, d);
});
get('/documents/:id/versions', (c) => { byId(c.db.documents, c.params.id); return []; });
get('/documents/:id/download', (c) => { const d = byId(c.db.documents, c.params.id); d.downloadCount = (d.downloadCount ?? 0) + 1; return { url: blobUrl(d.fileUrl), fileName: d.fileName }; });
del('/documents/:id', (c) => {
  const d = byId(c.db.documents, c.params.id);
  if (!isAdmin(c.db, c.user!) && d.createdBy !== c.user!.id && !hasPerm(c.db, c.user, 'dms:delete:Document')) throw forbidden();
  removeById(c.db.documents, d.id);
  return { ok: true };
});

// ───────────────────────────── ข่าว/ประกาศ ─────────────────────────────
const newsView = (n: Row) => ({ ...n, coverUrl: blobUrl(n.coverUrl) });
get('/news', (c) => { needPerm(c, 'news:read:News'); return [...c.db.news].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt)).map(newsView); });
post('/news', async (c) => {
  needPerm(c, 'news:manage:News');
  const f = await formToRow(c.body);
  if (!f.title?.trim()) throw badRequest('กรุณากรอกหัวข้อ');
  const n = {
    id: uid(), organizationId: ORG_ID, title: f.title.trim(), category: f.category || 'ข่าวประชาสัมพันธ์', excerpt: f.excerpt ?? '', content: f.content ?? '', status: f.status || 'published',
    pinned: f.pinned === 'true', coverUrl: f.cover?.url ?? null, publishedAt: f.publishedAt ? new Date(f.publishedAt).toISOString() : nowIso(), createdAt: nowIso(), createdBy: c.user!.id,
  };
  c.db.news.unshift(n);
  return newsView(n);
});
patch('/news/:id', async (c) => {
  needPerm(c, 'news:manage:News');
  const n = byId(c.db.news, c.params.id);
  const f = await formToRow(c.body);
  for (const k of ['title', 'category', 'excerpt', 'content', 'status']) if (f[k] !== undefined) n[k] = f[k];
  if (f.pinned !== undefined) n.pinned = f.pinned === 'true';
  if (f.publishedAt) n.publishedAt = new Date(f.publishedAt).toISOString();
  if (f.cover) n.coverUrl = f.cover.url;
  return newsView(n);
});
del('/news/:id', (c) => { needPerm(c, 'news:manage:News'); removeById(c.db.news, c.params.id); return { ok: true }; });
get('/citizen/news', (c) => [...c.db.news].filter((n) => n.status === 'published').sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt)).slice(0, Number(c.query.limit) || 20).map(newsView));
get('/citizen/news/:id', (c) => { const n = byId(c.db.news, c.params.id); return newsView(n); });

// ───────────────────────────── สรุปหน้าหลัก ─────────────────────────────
get('/dashboard/summary', (c) => {
  const { db } = c;
  return {
    pendingDocuments: db.tickets.filter((t) => !t.deletedAt && t.currentStep === 'PENDING_PERSON').length,
    pendingApprovals: 0, pendingLeave: db.leaveRequests.filter((l) => l.status === 'รอการอนุมัติ').length,
    openComplaints: db.citizenReports?.filter((r: Row) => r.status === 'new').length ?? 0,
    upcomingMeetings: db.meetings.filter((m) => m.status === 'กำหนดการ').length,
    activeProjects: db.projects.filter((p) => p.status === 'ดำเนินการ').length, welfareActive: 0, totalBudget: 0, usedBudget: 0, budgetUsagePct: 0,
  };
});

export { fileView };
