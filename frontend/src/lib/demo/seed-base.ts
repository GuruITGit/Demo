/** ข้อมูลตั้งต้นพื้นฐาน: องค์กร กอง งาน บทบาท ผู้ใช้ สิทธิ์ — ข้อมูลสมมติทั้งหมด ไม่ใช่ข้อมูลจริงของ อบต. ใด */
import { PERMISSION_MODULES, PERMISSION_PRESETS, getGrantsForItems } from '../permissions';
import { registerSeed, uid, type Row } from './core';

import { DEMO_PASSWORD } from './accounts';
export { DEMO_PASSWORD };
export const ORG_ID = 'org-demo';

const DEPARTMENTS = [
  { code: 'EXEC', nameTh: 'คณะผู้บริหาร', groupLabel: 'ฝ่ายบริหารและปลัด อบต.', deptType: 'POLITICAL', orderNo: 1 },
  { code: 'MGMT', nameTh: 'ปลัด อบต.', groupLabel: 'ฝ่ายบริหารและปลัด อบต.', deptType: 'ADMIN', orderNo: 2 },
  { code: 'COUNCIL', nameTh: 'สภาองค์การบริหารส่วนตำบล', groupLabel: 'ฝ่ายสภา อบต.', deptType: 'COUNCIL', orderNo: 3 },
  { code: 'ADMIN', nameTh: 'สำนักปลัด', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 4, docPrefix: 'สป' },
  { code: 'FINANCE', nameTh: 'กองคลัง', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 5, docPrefix: 'กค' },
  { code: 'ENGINEERING', nameTh: 'กองช่าง', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 6, docPrefix: 'กช' },
  { code: 'EDUCATION', nameTh: 'กองการศึกษา ศาสนาและวัฒนธรรม', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 7, docPrefix: 'กศ' },
  { code: 'HEALTH', nameTh: 'กองสาธารณสุขและสิ่งแวดล้อม', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 8, docPrefix: 'สธ' },
  { code: 'WELFARE', nameTh: 'กองสวัสดิการสังคม', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 9, docPrefix: 'สก' },
];

const DIVISIONS = [
  ['ADM_GENERAL', 'งานบริหารทั่วไป', 'ADMIN'], ['ADM_PERSONNEL', 'งานการเจ้าหน้าที่', 'ADMIN'], ['ADM_PLAN', 'งานนโยบายและแผน', 'ADMIN'],
  ['ADM_LEGAL', 'งานนิติการ', 'ADMIN'], ['ADM_DISASTER', 'งานป้องกันและบรรเทาสาธารณภัย', 'ADMIN'],
  ['FIN_MONEY', 'งานการเงิน', 'FINANCE'], ['FIN_ACCT', 'งานบัญชี', 'FINANCE'], ['FIN_REVENUE', 'งานพัฒนาและจัดเก็บรายได้', 'FINANCE'],
  ['FIN_SUPPLY', 'งานทะเบียนทรัพย์สินและพัสดุ', 'FINANCE'],
  ['ENG_BUILD', 'งานก่อสร้าง', 'ENGINEERING'], ['ENG_DESIGN', 'งานออกแบบและควบคุมอาคาร', 'ENGINEERING'],
  ['ENG_INFRA', 'งานสาธารณูปโภค', 'ENGINEERING'], ['ENG_CIVIL', 'งานวิศวกรรมโยธา', 'ENGINEERING'],
  ['EDU_ADMIN', 'งานบริหารการศึกษา', 'EDUCATION'], ['EDU_PROMOTE', 'งานส่งเสริมการศึกษา ศาสนาและวัฒนธรรม', 'EDUCATION'],
  ['EDU_CHILD', 'งานศูนย์พัฒนาเด็กเล็ก', 'EDUCATION'],
  ['HLT_ENV', 'งานอนามัยและสิ่งแวดล้อม', 'HEALTH'], ['HLT_PROMOTE', 'งานส่งเสริมสุขภาพและสาธารณสุข', 'HEALTH'], ['HLT_CLEAN', 'งานรักษาความสะอาด', 'HEALTH'],
  ['WEL_COMM', 'งานสวัสดิการและพัฒนาชุมชน', 'WELFARE'], ['WEL_SOCIAL', 'งานสังคมสงเคราะห์', 'WELFARE'], ['WEL_CAREER', 'งานส่งเสริมอาชีพและพัฒนาสตรี', 'WELFARE'],
];

const ROLES = [
  { name: 'SUPER_ADMIN', nameTh: 'ผู้ดูแลระบบสูงสุด', level: 100, isSystem: true },
  { name: 'ADMIN', nameTh: 'ผู้ดูแลระบบ', level: 90, isSystem: true },
  { name: 'MAYOR', nameTh: 'นายก อบต.', level: 80, isSystem: false },
  { name: 'DEPUTY_MAYOR', nameTh: 'รองนายก', level: 75, isSystem: false },
  { name: 'CLERK', nameTh: 'ปลัด อบต.', level: 70, isSystem: false },
  { name: 'DEPT_HEAD', nameTh: 'หัวหน้าส่วน / ผอ.กอง', level: 60, isSystem: false },
  { name: 'DIV_HEAD', nameTh: 'หัวหน้าฝ่าย', level: 50, isSystem: false },
  { name: 'AUDITOR', nameTh: 'ตรวจสอบภายใน', level: 40, isSystem: false },
  { name: 'OFFICER', nameTh: 'เจ้าหน้าที่', level: 30, isSystem: false },
  { name: 'EMPLOYEE', nameTh: 'พนักงาน', level: 10, isSystem: false },
];

/** ชุดสิทธิ์ต่อบทบาท (ใช้ชุดสำเร็จรูปเดียวกับหน้าตั้งค่าสิทธิ์จริง) */
const ROLE_PRESET: Record<string, string> = {
  MAYOR: 'mayor', DEPUTY_MAYOR: 'mayor', CLERK: 'clerk', DEPT_HEAD: 'deptHead', DIV_HEAD: 'deptHead',
  OFFICER: 'officer', AUDITOR: 'readonly', EMPLOYEE: 'readonly',
};

const ALL_GRANTS = [...new Set(PERMISSION_MODULES.flatMap((m) => m.items.flatMap((i) => i.grants)))];
/** ทุกสิทธิ์ของระบบ ในรูป {id, module, action, subject} */
export const PERMISSIONS: Row[] = ALL_GRANTS.map((g) => {
  const [module, action, subject] = g.split(':');
  return { id: `perm-${g}`, module, action, subject, key: g };
});

export function grantsForRole(roleName: string): string[] {
  if (roleName === 'ADMIN' || roleName === 'SUPER_ADMIN') return ALL_GRANTS;
  const preset = PERMISSION_PRESETS[ROLE_PRESET[roleName] ?? 'readonly'];
  // ทุกบทบาทอ่านเรื่องร้องเรียนได้ · ปลัด/หัวหน้ากอง/เจ้าหน้าที่ จัดการ (ส่งกอง/เปลี่ยนสถานะ) ได้ — ตามชุดสิทธิ์จริงของ backend
  const complaint = ['CLERK', 'DEPT_HEAD', 'DIV_HEAD', 'OFFICER'].includes(roleName) ? ['complaint:read:Report', 'complaint:manage:Report'] : ['complaint:read:Report'];
  return [...new Set([...getGrantsForItems(new Set(preset.items)), ...complaint])];
}

interface SeedUser { username: string; fullNameTh: string; titleTh: string; positionName: string; roleName: string; deptCode: string; divCode?: string; isHead?: boolean; extra?: string[] }

const MARKET_WASTE = ['market:read:MarketStall', 'market:read:MarketBill', 'market:manage:MarketBill', 'waste:read:WasteBill', 'waste:manage:WasteBill'];

const USERS: SeedUser[] = [
  { username: 'admin', fullNameTh: 'ผู้ดูแลระบบ', titleTh: 'นาย', positionName: 'ผู้ดูแลระบบ', roleName: 'ADMIN', deptCode: 'MGMT' },
  { username: 'mayor', fullNameTh: 'สมชาย ดีใจ', titleTh: 'นาย', positionName: 'นายกองค์การบริหารส่วนตำบล', roleName: 'MAYOR', deptCode: 'EXEC' },
  { username: 'deputy_mayor1', fullNameTh: 'อนันต์ มั่นคง', titleTh: 'นาย', positionName: 'รองนายกองค์การบริหารส่วนตำบล', roleName: 'DEPUTY_MAYOR', deptCode: 'EXEC' },
  { username: 'deputy_mayor2', fullNameTh: 'มาลี ใจดี', titleTh: 'นาง', positionName: 'รองนายกองค์การบริหารส่วนตำบล', roleName: 'DEPUTY_MAYOR', deptCode: 'EXEC' },
  { username: 'secretary_mayor', fullNameTh: 'วีระ ช่วยงาน', titleTh: 'นาย', positionName: 'เลขานุการนายก อบต.', roleName: 'EMPLOYEE', deptCode: 'EXEC' },
  { username: 'clerk', fullNameTh: 'สมศรี บริหาร', titleTh: 'นาง', positionName: 'ปลัดองค์การบริหารส่วนตำบล', roleName: 'CLERK', deptCode: 'MGMT', isHead: true },
  { username: 'deputy_clerk', fullNameTh: 'ประยุทธ รองปลัด', titleTh: 'นาย', positionName: 'รองปลัดองค์การบริหารส่วนตำบล', roleName: 'CLERK', deptCode: 'MGMT' },
  { username: 'council_chair', fullNameTh: 'บุญมี ประธาน', titleTh: 'นาย', positionName: 'ประธานสภา อบต.', roleName: 'EMPLOYEE', deptCode: 'COUNCIL', isHead: true },
  { username: 'council_vice', fullNameTh: 'สมหมาย รองประธาน', titleTh: 'นาย', positionName: 'รองประธานสภา อบต.', roleName: 'EMPLOYEE', deptCode: 'COUNCIL' },
  { username: 'head_admin', fullNameTh: 'ประสิทธิ์ หัวหน้า', titleTh: 'นาย', positionName: 'หัวหน้าสำนักปลัด', roleName: 'DEPT_HEAD', deptCode: 'ADMIN', divCode: 'ADM_GENERAL', isHead: true },
  { username: 'off_general', fullNameTh: 'นภา ทำงาน', titleTh: 'นางสาว', positionName: 'นักจัดการงานทั่วไป', roleName: 'OFFICER', deptCode: 'ADMIN', divCode: 'ADM_GENERAL' },
  { username: 'off_hr', fullNameTh: 'วันชัย บุคคล', titleTh: 'นาย', positionName: 'นักทรัพยากรบุคคล', roleName: 'OFFICER', deptCode: 'ADMIN', divCode: 'ADM_PERSONNEL', extra: ['hr:read:Employee', 'hr:create:Employee', 'hr:update:Employee'] },
  { username: 'off_plan', fullNameTh: 'จิราพร วางแผน', titleTh: 'นางสาว', positionName: 'นักวิเคราะห์นโยบายและแผน', roleName: 'OFFICER', deptCode: 'ADMIN', divCode: 'ADM_PLAN', extra: ['projects:manage:Project'] },
  { username: 'off_legal', fullNameTh: 'ธนา ยุติธรรม', titleTh: 'นาย', positionName: 'นิติกร', roleName: 'OFFICER', deptCode: 'ADMIN', divCode: 'ADM_LEGAL' },
  { username: 'dir_finance', fullNameTh: 'รัตนา การเงิน', titleTh: 'นาง', positionName: 'ผู้อำนวยการกองคลัง', roleName: 'DEPT_HEAD', deptCode: 'FINANCE', divCode: 'FIN_MONEY', isHead: true, extra: MARKET_WASTE },
  { username: 'off_finance', fullNameTh: 'ศิริพร บัญชี', titleTh: 'นางสาว', positionName: 'นักวิชาการเงินและบัญชี', roleName: 'OFFICER', deptCode: 'FINANCE', divCode: 'FIN_ACCT' },
  { username: 'off_revenue', fullNameTh: 'มานพ จัดเก็บ', titleTh: 'นาย', positionName: 'นักวิชาการจัดเก็บรายได้', roleName: 'OFFICER', deptCode: 'FINANCE', divCode: 'FIN_REVENUE', extra: MARKET_WASTE },
  { username: 'off_procure', fullNameTh: 'อารีย์ พัสดุ', titleTh: 'นาง', positionName: 'เจ้าพนักงานพัสดุ', roleName: 'OFFICER', deptCode: 'FINANCE', divCode: 'FIN_SUPPLY' },
  { username: 'dir_eng', fullNameTh: 'สมศักดิ์ ช่างดี', titleTh: 'นาย', positionName: 'ผู้อำนวยการกองช่าง', roleName: 'DEPT_HEAD', deptCode: 'ENGINEERING', divCode: 'ENG_CIVIL', isHead: true },
  { username: 'off_civil', fullNameTh: 'วิชัย สร้างบ้าน', titleTh: 'นาย', positionName: 'นายช่างโยธา', roleName: 'OFFICER', deptCode: 'ENGINEERING', divCode: 'ENG_CIVIL' },
  { username: 'off_infra', fullNameTh: 'ประเสริฐ ประปา', titleTh: 'นาย', positionName: 'นายช่างสาธารณูปโภค', roleName: 'OFFICER', deptCode: 'ENGINEERING', divCode: 'ENG_INFRA' },
  { username: 'dir_edu', fullNameTh: 'พรทิพย์ การศึกษา', titleTh: 'นาง', positionName: 'ผู้อำนวยการกองการศึกษา', roleName: 'DEPT_HEAD', deptCode: 'EDUCATION', divCode: 'EDU_ADMIN', isHead: true },
  { username: 'off_edu', fullNameTh: 'กนกพร สอนดี', titleTh: 'นางสาว', positionName: 'นักวิชาการศึกษา', roleName: 'OFFICER', deptCode: 'EDUCATION', divCode: 'EDU_PROMOTE' },
  { username: 'dir_health', fullNameTh: 'วิโรจน์ สุขภาพ', titleTh: 'นาย', positionName: 'ผู้อำนวยการกองสาธารณสุขและสิ่งแวดล้อม', roleName: 'DEPT_HEAD', deptCode: 'HEALTH', divCode: 'HLT_ENV', isHead: true },
  { username: 'off_health', fullNameTh: 'สุนีย์ อนามัย', titleTh: 'นาง', positionName: 'นักวิชาการสาธารณสุข', roleName: 'OFFICER', deptCode: 'HEALTH', divCode: 'HLT_PROMOTE' },
  { username: 'dir_welfare', fullNameTh: 'สมหญิง พัฒนา', titleTh: 'นาง', positionName: 'ผู้อำนวยการกองสวัสดิการสังคม', roleName: 'DEPT_HEAD', deptCode: 'WELFARE', divCode: 'WEL_COMM', isHead: true },
  { username: 'off_welfare', fullNameTh: 'ชูเกียรติ ชุมชน', titleTh: 'นาย', positionName: 'นักพัฒนาชุมชน', roleName: 'OFFICER', deptCode: 'WELFARE', divCode: 'WEL_COMM' },
];

/** ลายเซ็นสมมติ (เส้นหวัด ๆ ไม่ซ้ำกันต่อคน) — ให้ทุกบัญชีเดโม่ลากไปวางบนเอกสารได้ทันที */
export function signatureSvg(seed: string): string {
  let h = 7;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
  let x = 8, y = 38;
  let d = `M${x} ${y}`;
  const n = 6 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const nx = x + 18 + rnd() * 14, ny = 14 + rnd() * 40;
    d += ` C${x + 6} ${y - 30 - rnd() * 8} ${nx - 8} ${ny + 28} ${nx.toFixed(1)} ${ny.toFixed(1)}`;
    x = nx; y = ny;
  }
  d += ` S${x + 20} 52 ${x + 34} 36`;
  const w = Math.round(x + 44);
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} 70' width='${w * 2}' height='140'><path d='${d}' fill='none' stroke='#1e3a8a' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/><path d='M6 60 Q${w / 2} 54 ${w - 8} 62' fill='none' stroke='#1e3a8a' stroke-width='1.6' stroke-linecap='round'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

registerSeed((db) => {
  db.organizations = [{
    id: ORG_ID, code: 'ABT-DEMO', nameTh: 'องค์การบริหารส่วนตำบลตัวอย่าง', nameEn: 'Example Sub-district Administrative Organization',
    type: 'อบต', province: 'กรุงเทพมหานคร', district: 'บางรัก', subDistrict: 'สี่พระยา',
    address: '123 ถนนสีลม แขวงสี่พระยา เขตบางรัก กรุงเทพมหานคร 10500', phone: '02-234-5678', email: 'admin@example-abt.go.th',
    headerText: 'องค์การบริหารส่วนตำบลตัวอย่าง', logoUrl: null, isActive: true, metadata: { disabledModules: [] },
  }];

  db.departments = DEPARTMENTS.map((d) => ({ id: `dept-${d.code}`, organizationId: ORG_ID, isActive: true, hiddenFromForms: false, hiddenFromDirectory: false, docPrefix: '', headUserId: null, ...d }));
  db.divisions = DIVISIONS.map(([code, nameTh, deptCode], i) => ({ id: `div-${code}`, code, nameTh, departmentId: `dept-${deptCode}`, orderNo: i + 1 }));
  db.roles = ROLES.map((r) => ({ id: `role-${r.name}`, ...r }));
  db.permissions = PERMISSIONS;
  // บทบาท → สิทธิ์ (id ของสิทธิ์) — แก้ได้ในหน้าตั้งค่า
  db.rolePermissions = ROLES.flatMap((r) => grantsForRole(r.name).map((g) => ({ id: uid(), roleId: `role-${r.name}`, permissionId: `perm-${g}` })));

  db.users = USERS.map((u) => ({
    id: `user-${u.username}`, organizationId: ORG_ID, username: u.username, email: `${u.username}@example-abt.go.th`, password: DEMO_PASSWORD,
    fullNameTh: u.fullNameTh, titleTh: u.titleTh, positionName: u.positionName,
    departmentId: `dept-${u.deptCode}`, divisionId: u.divCode ? `div-${u.divCode}` : null, phone: '', avatarUrl: null,
    isActive: true, isVerified: true, createdAt: new Date(Date.now() - 400 * 86400000).toISOString(),
    metadata: { signatureImage: signatureSvg(u.username) },
  }));
  db.userRoles = USERS.map((u) => ({ id: uid(), userId: `user-${u.username}`, roleId: `role-${u.roleName}` }));
  // สิทธิ์เพิ่มเติมรายคน (นอกเหนือจากบทบาท)
  db.userPermissions = USERS.flatMap((u) => (u.extra ?? []).map((g) => ({ id: uid(), userId: `user-${u.username}`, permissionId: `perm-${g}` })));
  USERS.filter((u) => u.isHead).forEach((u) => {
    const d = db.departments.find((x) => x.id === `dept-${u.deptCode}`);
    if (d) d.headUserId = `user-${u.username}`;
  });
  db.loginHistory = [];
  db.audit = [];
  db.settings = [
    { id: uid(), settingKey: 'security.max_login_attempts', settingValue: '5', description: 'ล็อกอินผิดได้สูงสุดกี่ครั้ง' },
    { id: uid(), settingKey: 'security.lockout_minutes', settingValue: '15', description: 'ล็อกบัญชีกี่นาที' },
    { id: uid(), settingKey: 'security.session_timeout_minutes', settingValue: '60', description: 'หมดเวลาใช้งาน' },
    { id: uid(), settingKey: 'file.max_size_mb', settingValue: '20', description: 'ขนาดไฟล์แนบสูงสุด' },
    { id: uid(), settingKey: 'file.allowed_types', settingValue: 'pdf,docx,xlsx,jpg,png,zip', description: 'ชนิดไฟล์ที่อนุญาต' },
  ];
  db.notifPrefs = [];
  db.notifications = [];
  db.files = [];
});
