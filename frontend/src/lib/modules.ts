import {
  LayoutDashboard, Mail, PenLine, FolderOpen, Users, CalendarDays, Calendar,
  Package, Settings, ClipboardList, ShieldCheck, Droplets, UserCircle, MessageSquareWarning, Newspaper, Store, Trash2,
} from 'lucide-react';

/**
 * ═══════════════════════════════════════════════════════════════════
 *  ทะเบียนโมดูลกลาง — จุดเดียวที่นิยามว่าระบบมีโมดูลอะไรบ้าง
 * ═══════════════════════════════════════════════════════════════════
 *
 * เดิมข้อมูลชุดนี้กระจายอยู่ 5 ไฟล์ (เมนู / สี / หน้าติ๊กสิทธิ์ / ชุดสิทธิ์สำเร็จรูป / ค้นหาด่วน)
 * เพิ่มโมดูลใหม่ทีต้องไล่แก้ให้ครบทุกไฟล์ ลืมไฟล์ไหนก็เจอปัญหาแปลกๆ
 * เช่น เมนูโผล่แต่ตั้งค่าสิทธิ์ไม่ได้ หรือค้นหาด่วนไม่เจอ
 *
 * ตอนนี้เพิ่มโมดูลใหม่ = แก้ 2 ที่เท่านั้น
 *   1. ไฟล์นี้ (เมนู + สี + สิทธิ์ + ค้นหา ครบในบล็อกเดียว)
 *   2. backend/src/database/seeds/seed-roles-permissions.ts (นิยามสิทธิ์ฝั่ง server + ผูกบทบาท)
 *      แล้วรัน `npm run seed:perms` เพื่อ sync ลงฐานข้อมูล
 *
 * ⚠ สิทธิ์ต้องตรงกันทั้ง 2 ที่ — ฝั่งนี้คุมว่า "เห็นเมนู/ติ๊กได้ไหม" ฝั่ง backend คุมว่า "เรียก API ได้จริงไหม"
 */

export interface PermissionItem {
  /** คีย์สั้นๆ ใช้อ้างในชุดสิทธิ์สำเร็จรูป (PERMISSION_PRESETS) */
  key: string;
  label: string;
  /** สิทธิ์ที่จะถูกให้เมื่อติ๊กข้อนี้ — ตัวแรกต้องเป็น :read: ของโมดูลเสมอ */
  grants: string[];
}

export interface ModuleDef {
  key: string;
  label: string;
  /** ที่อยู่หน้าแรกของโมดูล */
  href: string;
  icon: React.ElementType;
  /** class สีเต็มของ Tailwind (ห้ามต่อ string เอง เดี๋ยวโดน purge) */
  color: string;

  // ── เมนูซ้าย ──
  /** กลุ่มในเมนู — ถ้าไม่ใส่ = ไม่ขึ้นเมนู (เช่น โปรไฟล์) */
  navGroup?: string;
  /** สิทธิ์ที่ต้องมีถึงจะเห็นเมนู/โมดูลนี้ */
  permission?: string;
  /** ป้ายท้ายเมนู เช่น "เร็วๆนี้" */
  badge?: string;

  // ── หน้าตั้งค่าสิทธิ์รายคน ──
  /** ไม่ใส่ = ไม่มีให้ตั้งค่าสิทธิ์ (เช่น หน้าหลัก/โปรไฟล์ที่ทุกคนเข้าได้) */
  permissionItems?: PermissionItem[];
  /** ชื่อที่ใช้ในหน้าตั้งค่าสิทธิ์ ถ้าต่างจาก label */
  permissionLabel?: string;

  // ── ค้นหาด่วน (Ctrl+K) ──
  keywords?: string[];
  /** โผล่ในค้นหาด่วนเฉพาะ admin */
  adminOnly?: boolean;
  /** ไม่ต้องมีในค้นหาด่วน */
  hideInPalette?: boolean;
  /** ปุ่มลัด "การดำเนินการ" ในค้นหาด่วน เช่น สร้างสารบรรณใหม่ */
  quickActions?: { id: string; label: string; href: string; keywords?: string[] }[];
}

/** ลำดับกลุ่มในเมนูซ้าย */
export const NAV_GROUP_ORDER = ['หลัก', 'งานสำนักงาน', 'โครงการ', 'บุคลากร', 'ระบบ'];

export const MODULES: ModuleDef[] = [
  {
    key: 'dashboard',
    label: 'หน้าหลัก',
    href: '/dashboard',
    icon: LayoutDashboard,
    color: 'text-indigo-500',
    navGroup: 'หลัก',
    keywords: ['dashboard', 'home'],
  },

  // ── งานสำนักงาน ──
  {
    key: 'correspondence',
    label: 'สารบรรณ',
    href: '/correspondence/tickets',
    icon: Mail,
    color: 'text-sky-500',
    navGroup: 'งานสำนักงาน',
    permission: 'correspondence:read:Ticket',
    keywords: ['หนังสือ', 'สารบรรณ', 'mail', 'ticket'],
    quickActions: [
      { id: 'new-correspondence', label: 'สร้างสารบรรณใหม่', href: '/correspondence/tickets/new', keywords: ['new', 'ใหม่', 'สารบรรณ', 'หนังสือ'] },
    ],
    permissionItems: [
      { key: 'saraban_view', label: 'ดูสารบรรณ', grants: ['correspondence:read:Ticket'] },
      { key: 'saraban_create', label: 'สร้างสารบรรณ / แก้ไขเอกสาร', grants: ['correspondence:read:Ticket', 'correspondence:create:Ticket', 'correspondence:update:Ticket'] },
      { key: 'saraban_clerk', label: 'ปลัดประทับเซ็น', grants: ['correspondence:read:Ticket', 'correspondence:approve_clerk:Ticket'] },
      { key: 'saraban_mayor', label: 'นายกประทับเซ็น / ปิดงาน', grants: ['correspondence:read:Ticket', 'correspondence:approve_mayor:Ticket'] },
      { key: 'saraban_delete', label: 'ลบสารบรรณ', grants: ['correspondence:read:Ticket', 'correspondence:delete:Ticket'] },
      { key: 'saraban_summary', label: 'ดูรายงานสรุป (เดือน/ปี)', grants: ['correspondence:summary:Ticket', 'correspondence:read:Ticket'] },
    ],
  },
  {
    key: 'citizen-reports',
    label: 'เรื่องแจ้ง/ร้องเรียน',
    href: '/citizen-reports',
    icon: MessageSquareWarning,
    color: 'text-rose-500',
    navGroup: 'งานสำนักงาน',
    permission: 'complaint:read:Report',
    keywords: ['ร้องเรียน', 'แจ้งเหตุ', 'ประชาชน', 'complaint', 'report'],
    permissionItems: [
      { key: 'complaint_view', label: 'ดูเรื่องแจ้ง/ร้องเรียน', grants: ['complaint:read:Report'] },
      { key: 'complaint_manage', label: 'จัดการ / เปลี่ยนสถานะ', grants: ['complaint:read:Report', 'complaint:manage:Report'] },
      { key: 'complaint_delete', label: 'ลบเรื่อง (ผู้ดูแล)', grants: ['complaint:read:Report', 'complaint:delete:Report'] },
    ],
  },
  {
    key: 'market',
    label: 'ค่าแผงตลาด',
    href: '/market',
    icon: Store,
    color: 'text-sky-500',
    navGroup: 'งานสำนักงาน',
    permission: 'market:read:MarketBill',
    keywords: ['แผง', 'ตลาด', 'ค่าเช่า', 'ผังตลาด', 'market', 'stall'],
    permissionItems: [
      { key: 'market_view', label: 'ดูผังแผงและบิลค่าแผง', grants: ['market:read:MarketStall', 'market:read:MarketBill'] },
      { key: 'market_manage', label: 'รับชำระค่าแผง', grants: ['market:read:MarketBill', 'market:manage:MarketBill'] },
      { key: 'market_plan_manage', label: 'จัดการผังแผง ราคา และแผงลอย', grants: ['market:read:MarketStall', 'market:manage:MarketStall', 'market:read:MarketBill', 'market:manage:MarketBill'] },
    ],
  },
  {
    key: 'waste',
    label: 'ค่าเก็บขยะบ้าน',
    href: '/waste',
    icon: Trash2,
    color: 'text-emerald-600',
    navGroup: 'งานสำนักงาน',
    permission: 'waste:read:WasteBill',
    keywords: ['ขยะ', 'ค่าขยะ', 'เก็บขยะ', 'waste', 'garbage'],
    permissionItems: [
      { key: 'waste_view', label: 'ดูบิลค่าขยะบ้าน', grants: ['waste:read:WasteBill'] },
      { key: 'waste_manage', label: 'รับชำระค่าขยะบ้าน', grants: ['waste:read:WasteBill', 'waste:manage:WasteBill'] },
      { key: 'waste_households', label: 'จัดการทะเบียนครัวเรือน ราคา และออกบิล', grants: ['waste:read:WasteBill', 'waste:manage:WasteBill'] },
    ],
  },
  {
    key: 'news',
    label: 'ข่าว/ประกาศ',
    href: '/news',
    icon: Newspaper,
    color: 'text-cyan-500',
    navGroup: 'งานสำนักงาน',
    permission: 'news:read:News',
    keywords: ['ข่าว', 'ประกาศ', 'ประชาสัมพันธ์', 'news', 'cms'],
    permissionItems: [
      { key: 'news_view', label: 'ดูข่าว/ประกาศ', grants: ['news:read:News'] },
      { key: 'news_manage', label: 'สร้าง / แก้ไข / ลบข่าว', grants: ['news:read:News', 'news:manage:News'] },
    ],
  },
  {
    key: 'documents',
    label: 'คลังเอกสาร',
    href: '/documents',
    icon: FolderOpen,
    color: 'text-orange-500',
    navGroup: 'งานสำนักงาน',
    permission: 'dms:read:Document',
    keywords: ['doc', 'file', 'เอกสาร'],
    permissionItems: [
      { key: 'documents_view', label: 'ดูเอกสาร', grants: ['dms:read:Document'] },
      { key: 'documents_upload', label: 'อัปโหลด / แก้ไขเอกสาร', grants: ['dms:read:Document', 'dms:create:Document', 'dms:update:Document'] },
      { key: 'documents_categories', label: 'จัดการหมวดหมู่เอกสาร', grants: ['dms:read:Document', 'dms:manage:Category'] },
      { key: 'documents_delete', label: 'ลบเอกสาร', grants: ['dms:read:Document', 'dms:delete:Document'] },
    ],
  },
  {
    key: 'meetings',
    label: 'การประชุม',
    href: '/meetings',
    icon: Calendar,
    color: 'text-emerald-500',
    navGroup: 'งานสำนักงาน',
    permission: 'meetings:read:Meeting',
    keywords: ['meeting', 'ประชุม'],
    permissionItems: [
      { key: 'meetings_view', label: 'ดูการประชุม', grants: ['meetings:read:Meeting'] },
      { key: 'meetings_create', label: 'สร้าง / แก้ไขการประชุม', grants: ['meetings:read:Meeting', 'meetings:create:Meeting', 'meetings:update:Meeting'] },
      { key: 'meetings_minutes', label: 'บันทึกรายงานการประชุม', grants: ['meetings:read:Meeting', 'meetings:manage:Minutes'] },
      { key: 'meetings_delete', label: 'ลบการประชุม', grants: ['meetings:read:Meeting', 'meetings:delete:Meeting'] },
    ],
  },
  {
    key: 'signatures',
    label: 'จัดการลายเซ็น',
    href: '/signatures',
    icon: PenLine,
    color: 'text-violet-500',
    navGroup: 'งานสำนักงาน',
    permission: 'signatures:read:Signature',
    permissionLabel: 'ลายเซ็นดิจิทัล',
    keywords: ['sign', 'ลายเซ็น', 'ประวัติการเซ็น', 'จัดการลายเซ็น'],
    permissionItems: [
      { key: 'signatures_use', label: 'ดู / เซ็นเอกสาร', grants: ['signatures:read:Signature', 'signatures:sign:Document'] },
      { key: 'signatures_manage', label: 'สร้าง / จัดการลายเซ็น', grants: ['signatures:read:Signature', 'signatures:create:Signature'] },
    ],
  },

  // ── โครงการ ──
  {
    key: 'projects',
    label: 'โครงการ',
    href: '/projects',
    icon: ClipboardList,
    color: 'text-cyan-600',
    navGroup: 'โครงการ',
    permission: 'projects:read:Project',
    permissionLabel: 'โครงการ / แผนพัฒนา',
    keywords: ['project', 'plan', 'โครงการ'],
    quickActions: [
      { id: 'new-project', label: 'สร้างโครงการใหม่', href: '/projects/new', keywords: ['new', 'project'] },
    ],
    permissionItems: [
      { key: 'projects_view', label: 'ดูโครงการ', grants: ['projects:read:Project'] },
      { key: 'projects_manage', label: 'สร้าง / แก้ไข / ลบโครงการ (ผู้ดูแล)', grants: ['projects:read:Project', 'projects:manage:Project'] },
    ],
  },

  // ── บุคลากร ──
  {
    key: 'hr',
    label: 'บุคลากร',
    href: '/hr',
    icon: Users,
    color: 'text-rose-500',
    navGroup: 'บุคลากร',
    keywords: ['hr', 'พนักงาน', 'employee'],
    permissionItems: [
      { key: 'hr_view', label: 'ดูทำเนียบบุคลากร', grants: ['hr:read:Employee'] },
      { key: 'hr_manage', label: 'เพิ่ม / แก้ไขบุคลากร', grants: ['hr:read:Employee', 'hr:create:Employee', 'hr:update:Employee'] },
      { key: 'hr_delete', label: 'ลบบุคลากร', grants: ['hr:read:Employee', 'hr:delete:Employee'] },
    ],
  },
  {
    key: 'leave',
    label: 'การลา',
    href: '/leave',
    icon: CalendarDays,
    color: 'text-amber-500',
    navGroup: 'บุคลากร',
    permission: 'leave:read:LeaveRequest',
    keywords: ['leave', 'ลา', 'วันลา'],
    quickActions: [
      { id: 'new-leave', label: 'ยื่นใบลาใหม่', href: '/leave/new', keywords: ['new', 'leave', 'ลา'] },
    ],
    permissionItems: [
      { key: 'leave_apply', label: 'ดู / บันทึกการลาของตน', grants: ['leave:read:LeaveRequest', 'leave:create:LeaveRequest'] },
      { key: 'leave_manage', label: 'จัดการประเภทวันลา', grants: ['leave:read:LeaveRequest', 'leave:manage:LeaveType'] },
    ],
  },

  // ── ระบบ ──
  {
    key: 'users',
    label: 'จัดการผู้ใช้',
    href: '/users',
    icon: Users,
    color: 'text-blue-500',
    navGroup: 'ระบบ',
    permission: 'users:read:User',
    keywords: ['users', 'manage', 'ผู้ใช้'],
    adminOnly: true,
    permissionItems: [
      { key: 'users_view', label: 'ดูรายชื่อผู้ใช้', grants: ['users:read:User'] },
      { key: 'users_manage', label: 'เพิ่ม / แก้ไขผู้ใช้', grants: ['users:read:User', 'users:create:User', 'users:update:User', 'users:manage:Role'] },
      { key: 'users_delete', label: 'ลบผู้ใช้', grants: ['users:read:User', 'users:delete:User'] },
    ],
  },
  {
    key: 'audit',
    label: 'ประวัติกิจกรรม',
    href: '/audit',
    icon: ShieldCheck,
    color: 'text-green-600',
    navGroup: 'ระบบ',
    permission: 'audit:read:AuditLog',
    keywords: ['audit', 'log', 'activity'],
    adminOnly: true,
    permissionItems: [
      { key: 'audit_view', label: 'ดู Audit Log', grants: ['audit:read:AuditLog'] },
    ],
  },
  // หมายเหตุ: ศูนย์จัดการทุก อบต. (HUB ของเจ้าของระบบ) ถูกถอดออกจากแอปสารบรรณโดยตั้งใจ —
  // เป็นคอนโซลของผู้ขาย ไม่ใช่เมนูของ อบต. จะแยกไปเป็นเว็บ/พื้นที่ของตัวเองต่างหาก
  // (API ฝั่ง backend ยังอยู่: GET /organizations/hub ฯลฯ จำกัดเฉพาะ SUPER_ADMIN)
  {
    key: 'settings',
    label: 'ตั้งค่าระบบ',
    href: '/settings',
    icon: Settings,
    color: 'text-slate-500',
    navGroup: 'ระบบ',
    permission: 'settings:read:SystemSetting',
    keywords: ['settings', 'ตั้งค่า'],
    permissionItems: [
      { key: 'settings_view', label: 'ดูการตั้งค่า', grants: ['settings:read:SystemSetting'] },
      { key: 'settings_manage', label: 'แก้ไขการตั้งค่า', grants: ['settings:read:SystemSetting', 'settings:manage:SystemSetting'] },
    ],
  },

  // ── ไม่อยู่ในเมนู แต่มีในค้นหาด่วน ──
  {
    key: 'profile',
    label: 'โปรไฟล์ของฉัน',
    href: '/profile',
    icon: UserCircle,
    color: 'text-slate-500',
    keywords: ['profile', 'โปรไฟล์'],
  },

  // ── มีเฉพาะหน้าติ๊กสิทธิ์ (ไม่มีเมนูของตัวเอง — จัดการผ่านหน้าตั้งค่า) ──
  {
    key: 'organizations',
    label: 'องค์กร / หน่วยงาน',
    href: '/settings',
    icon: Settings,
    color: 'text-slate-500',
    hideInPalette: true,
    permissionItems: [
      { key: 'org_manage', label: 'แก้ไขข้อมูลองค์กร / จัดการกอง', grants: ['organizations:read:Organization', 'organizations:update:Organization', 'organizations:manage:Department'] },
    ],
  },
];

/** ค้นโมดูลจาก key */
export const moduleByKey = (key: string) => MODULES.find((m) => m.key === key);

/** สีประจำโมดูล — คงรูปแบบเดิมไว้ให้โค้ดที่อ้าง MODULE_COLOR.x ใช้ต่อได้ */
export const MODULE_COLOR: Record<string, string> = Object.fromEntries(
  MODULES.map((m) => [m.key, m.color]),
);
// สีของสิ่งที่ไม่ใช่โมดูล (ใช้ในแถบแจ้งเตือน/ปุ่มออกจากระบบ)
MODULE_COLOR.notifications = 'text-fuchsia-500';
