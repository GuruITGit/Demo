import { DataSource } from 'typeorm';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
export const SYSTEM_ROLES = [
  { name: 'SUPER_ADMIN', nameTh: 'ผู้ดูแลระบบสูงสุด', level: 100, isSystem: true },
  { name: 'ADMIN', nameTh: 'ผู้ดูแลระบบ', level: 90, isSystem: true },
  { name: 'MAYOR', nameTh: 'นายก อบต.', level: 80, isSystem: false },
  { name: 'DEPUTY_MAYOR', nameTh: 'รองนายก', level: 75, isSystem: false },
  { name: 'CLERK', nameTh: 'ปลัด อบต.', level: 70, isSystem: false },
  { name: 'DEPT_HEAD', nameTh: 'หัวหน้าส่วน / ผอ.กอง', level: 60, isSystem: false },
  { name: 'DIV_HEAD', nameTh: 'หัวหน้าฝ่าย', level: 50, isSystem: false },
  { name: 'AUDITOR', nameTh: 'ตรวจสอบภายใน', level: 40, isSystem: false },
  { name: 'OFFICER', nameTh: 'เจ้าหน้าที่', level: 30, isSystem: false },
  { name: 'WATER_STAFF', nameTh: 'เจ้าหน้าที่ประปา', level: 30, isSystem: false },
  { name: 'EMPLOYEE', nameTh: 'พนักงาน', level: 10, isSystem: false },
];
// Rework 3.0 (อบต.ลำนางรอง): เฉพาะโมดูล/สิทธิ์ที่ใช้จริงในระบบปัจจุบัน
// ตัดออก: Incoming/Outgoing (ตายจาก Rework 2.0), assets(ครุภัณฑ์), hr:Salary(ปิดฟีเจอร์),
//         leave:approve + leave:LeaveQuota (การลาไม่มีอนุมัติ/โควตา), auth:manage:all
export const PERMISSIONS = [
  // จัดการผู้ใช้
  { module: 'users', action: 'create', subject: 'User' },
  { module: 'users', action: 'read', subject: 'User' },
  { module: 'users', action: 'update', subject: 'User' },
  { module: 'users', action: 'delete', subject: 'User' },
  { module: 'users', action: 'manage', subject: 'Role' },
  // องค์กร / กอง
  { module: 'organizations', action: 'read', subject: 'Organization' },
  { module: 'organizations', action: 'update', subject: 'Organization' },
  { module: 'organizations', action: 'manage', subject: 'Department' },
  // สารบรรณ (Ticket)
  { module: 'correspondence', action: 'create', subject: 'Ticket' },
  { module: 'correspondence', action: 'read', subject: 'Ticket' },
  { module: 'correspondence', action: 'update', subject: 'Ticket' },
  { module: 'correspondence', action: 'approve_clerk', subject: 'Ticket' },
  { module: 'correspondence', action: 'approve_mayor', subject: 'Ticket' },
  { module: 'correspondence', action: 'delete', subject: 'Ticket' },
  { module: 'correspondence', action: 'summary', subject: 'Ticket' },
  // ลายเซ็นดิจิทัล
  { module: 'signatures', action: 'create', subject: 'Signature' },
  { module: 'signatures', action: 'read', subject: 'Signature' },
  { module: 'signatures', action: 'sign', subject: 'Document' },
  // คลังเอกสาร (DMS)
  { module: 'dms', action: 'create', subject: 'Document' },
  { module: 'dms', action: 'read', subject: 'Document' },
  { module: 'dms', action: 'update', subject: 'Document' },
  { module: 'dms', action: 'delete', subject: 'Document' },
  { module: 'dms', action: 'manage', subject: 'Category' },
  // บุคลากร (ไม่มีเงินเดือน)
  { module: 'hr', action: 'create', subject: 'Employee' },
  { module: 'hr', action: 'read', subject: 'Employee' },
  { module: 'hr', action: 'update', subject: 'Employee' },
  { module: 'hr', action: 'delete', subject: 'Employee' },
  // การลา (บันทึกเอง ไม่มีอนุมัติ)
  { module: 'leave', action: 'create', subject: 'LeaveRequest' },
  { module: 'leave', action: 'read', subject: 'LeaveRequest' },
  { module: 'leave', action: 'manage', subject: 'LeaveType' },
  // การประชุม
  { module: 'meetings', action: 'create', subject: 'Meeting' },
  { module: 'meetings', action: 'read', subject: 'Meeting' },
  { module: 'meetings', action: 'update', subject: 'Meeting' },
  { module: 'meetings', action: 'delete', subject: 'Meeting' },
  { module: 'meetings', action: 'manage', subject: 'Minutes' },
  // โครงการ (ทุกคนสร้างได้)
  { module: 'projects', action: 'read', subject: 'Project' },
  { module: 'projects', action: 'manage', subject: 'Project' },
  // น้ำประปา — หนังสือแจ้งค้างชำระ (กิจการประปา กองช่าง)
  { module: 'water', action: 'read', subject: 'WaterNotice' },
  { module: 'water', action: 'create', subject: 'WaterNotice' },
  { module: 'water', action: 'delete', subject: 'WaterNotice' },
  { module: 'water', action: 'manage', subject: 'WaterCustomer' },
  // ประวัติกิจกรรม
  { module: 'audit', action: 'read', subject: 'AuditLog' },
  // ตั้งค่าระบบ
  { module: 'settings', action: 'read', subject: 'SystemSetting' },
  { module: 'settings', action: 'manage', subject: 'SystemSetting' },
  // เรื่องแจ้ง/ร้องเรียนจากประชาชน (พอร์ทัล /citizen) — คัดกรอง/เปลี่ยนสถานะ/ลบ
  { module: 'complaint', action: 'read', subject: 'Report' },
  { module: 'complaint', action: 'manage', subject: 'Report' },
  { module: 'complaint', action: 'delete', subject: 'Report' },
  // ข่าว/ประกาศประชาสัมพันธ์ (พอร์ทัล /citizen) — CMS
  { module: 'news', action: 'read', subject: 'News' },
  { module: 'news', action: 'manage', subject: 'News' },
];
// สิทธิ์ต่อบทบาท (module:action:subject) — Rework 3.0 ตามตารางที่ตกลงกับ อบต.ลำนางรอง
// SUPER_ADMIN ไม่ต้องระบุ (bypass ทุกสิทธิ์) · ทุกบทบาทได้ projects:manage (ทุกคนสร้างโครงการได้)
// การลา = create/read เท่านั้น (ไม่มีอนุมัติ) · ทุกคนเห็นทำเนียบบุคลากร (hr:read:Employee)
const SIGN_SELF = ['signatures:create:Signature', 'signatures:read:Signature', 'signatures:sign:Document'];
// ค่าน้ำ: เจ้าหน้าที่ประปาทำได้เต็ม (จด/ออกบิล/รับเงิน ตามงานจริง) — ลบได้เฉพาะ admin
// อัตรา/งวด เป็นงานตั้งค่า จึงอยู่กับ admin เท่านั้น · บทบาทอื่นปรับเพิ่ม-ลดรายคนได้ที่หน้าจัดการผู้ใช้
const WATER_NOTICE = ['water:read:WaterNotice', 'water:create:WaterNotice'];
const WATER_ALL = [...WATER_NOTICE, 'water:delete:WaterNotice', 'water:manage:WaterCustomer'];
const BASE_STAFF = ['leave:create:LeaveRequest', 'leave:read:LeaveRequest', 'hr:read:Employee', 'projects:read:Project', 'projects:manage:Project', 'complaint:read:Report'];
// ดู + จัดการเรื่องร้องเรียน (สำหรับบทบาทที่คุมงานสารบรรณ) — ลบเฉพาะ SUPER_ADMIN
const COMPLAINT_MANAGE = ['complaint:read:Report', 'complaint:manage:Report'];
// จัดการข่าว/ประกาศประชาสัมพันธ์ (CMS พอร์ทัลประชาชน)
const NEWS_MANAGE = ['news:read:News', 'news:manage:News'];
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  // ผู้ดูแลระบบ — ทุกสิทธิ์
  ADMIN: [
    'users:create:User', 'users:read:User', 'users:update:User', 'users:delete:User', 'users:manage:Role',
    'organizations:read:Organization', 'organizations:update:Organization', 'organizations:manage:Department',
    'correspondence:create:Ticket', 'correspondence:read:Ticket', 'correspondence:update:Ticket',
    ...COMPLAINT_MANAGE,
    'correspondence:approve_clerk:Ticket', 'correspondence:approve_mayor:Ticket', 'correspondence:delete:Ticket', 'correspondence:summary:Ticket',
    ...SIGN_SELF,
    'dms:create:Document', 'dms:read:Document', 'dms:update:Document', 'dms:delete:Document', 'dms:manage:Category',
    'hr:create:Employee', 'hr:read:Employee', 'hr:update:Employee', 'hr:delete:Employee',
    'leave:create:LeaveRequest', 'leave:read:LeaveRequest', 'leave:manage:LeaveType',
    'meetings:create:Meeting', 'meetings:read:Meeting', 'meetings:update:Meeting', 'meetings:delete:Meeting', 'meetings:manage:Minutes',
    'projects:read:Project', 'projects:manage:Project',
    ...WATER_ALL,
    'complaint:delete:Report',
    ...NEWS_MANAGE,
    'audit:read:AuditLog', 'settings:read:SystemSetting', 'settings:manage:SystemSetting',
  ],
  // นายก — ดูสารบรรณทุกกอง + อนุมัติขั้นนายก + สรุป
  MAYOR: [
    'water:read:WaterNotice',
    'correspondence:read:Ticket', 'correspondence:approve_mayor:Ticket', 'correspondence:summary:Ticket',
    ...SIGN_SELF, 'dms:read:Document',
    'meetings:create:Meeting', 'meetings:read:Meeting', 'meetings:update:Meeting', 'meetings:manage:Minutes',
    ...BASE_STAFF,
  ],
  // รองนายก — เหมือนนายก (อนุมัติแทนนายกได้)
  DEPUTY_MAYOR: [
    'correspondence:read:Ticket', 'correspondence:approve_mayor:Ticket', 'correspondence:summary:Ticket',
    ...SIGN_SELF, 'dms:read:Document',
    'meetings:create:Meeting', 'meetings:read:Meeting', 'meetings:update:Meeting', 'meetings:manage:Minutes',
    ...BASE_STAFF,
  ],
  // ปลัด — คุมสารบรรณทุกกอง + อนุมัติขั้นปลัด + สรุป + จัดการบุคลากร
  CLERK: [
    ...WATER_ALL,
    'correspondence:create:Ticket', 'correspondence:read:Ticket', 'correspondence:update:Ticket',
    ...COMPLAINT_MANAGE,
    ...NEWS_MANAGE,
    'correspondence:approve_clerk:Ticket', 'correspondence:summary:Ticket',
    ...SIGN_SELF,
    'dms:create:Document', 'dms:read:Document', 'dms:update:Document',
    'hr:create:Employee', 'hr:update:Employee',
    'meetings:create:Meeting', 'meetings:read:Meeting', 'meetings:update:Meeting', 'meetings:manage:Minutes',
    ...BASE_STAFF,
  ],
  // หัวหน้าส่วน/ผอ.กอง — คุมสารบรรณกองตน + สรุปกองตน
  DEPT_HEAD: [
    ...WATER_ALL,
    'correspondence:create:Ticket', 'correspondence:read:Ticket', 'correspondence:update:Ticket', 'correspondence:summary:Ticket',
    ...COMPLAINT_MANAGE,
    ...NEWS_MANAGE,
    ...SIGN_SELF,
    'dms:create:Document', 'dms:read:Document', 'dms:update:Document',
    'meetings:create:Meeting', 'meetings:read:Meeting', 'meetings:update:Meeting', 'meetings:manage:Minutes',
    ...BASE_STAFF,
  ],
  // หัวหน้าฝ่าย — ทำงานสารบรรณกองตน (ไม่มีสรุป)
  DIV_HEAD: [
    ...WATER_NOTICE,
    'correspondence:create:Ticket', 'correspondence:read:Ticket', 'correspondence:update:Ticket',
    ...COMPLAINT_MANAGE,
    ...SIGN_SELF,
    'dms:create:Document', 'dms:read:Document', 'dms:update:Document',
    'meetings:create:Meeting', 'meetings:read:Meeting', 'meetings:update:Meeting', 'meetings:manage:Minutes',
    ...BASE_STAFF,
  ],
  // ตรวจสอบภายใน — ดูสารบรรณทุกกอง + สรุป + ดูประวัติกิจกรรม
  AUDITOR: [
    'water:read:WaterNotice',
    'correspondence:read:Ticket', 'correspondence:summary:Ticket',
    'dms:read:Document', 'meetings:read:Meeting', 'audit:read:AuditLog',
    ...BASE_STAFF,
  ],
  // เจ้าหน้าที่ — สร้าง/แก้สารบรรณกองตน
  OFFICER: [
    ...WATER_NOTICE,
    'correspondence:create:Ticket', 'correspondence:read:Ticket', 'correspondence:update:Ticket',
    ...COMPLAINT_MANAGE,
    ...SIGN_SELF,
    'dms:create:Document', 'dms:read:Document', 'dms:update:Document',
    'meetings:read:Meeting',
    ...BASE_STAFF,
  ],
  // พนักงาน — ดูสารบรรณกองตน + บันทึกลา
  EMPLOYEE: [
    'correspondence:read:Ticket',
    ...SIGN_SELF,
    'dms:read:Document', 'meetings:read:Meeting',
    ...BASE_STAFF,
  ],
  // เจ้าหน้าที่ประปา — จดมิเตอร์ / รับชำระ / ออกหนังสือค้าง (สิทธิ์ประปาเต็ม จำกัดเฉพาะประปา + งานตนเอง)
  WATER_STAFF: [
    ...WATER_ALL,
    'leave:create:LeaveRequest', 'leave:read:LeaveRequest', 'hr:read:Employee',
  ],
};
export async function seedRolesAndPermissions(dataSource: DataSource): Promise<void> {
  const roleRepo = dataSource.getRepository(Role);
  const permRepo = dataSource.getRepository(Permission);
  const rpRepo = dataSource.getRepository(RolePermission);
  console.log('Seeding permissions...');
  const permMap = new Map<string, Permission>();
  for (const p of PERMISSIONS) {
    let perm = await permRepo.findOne({ where: { module: p.module, action: p.action, subject: p.subject } });
    if (!perm) {
      perm = permRepo.create(p);
      perm = await permRepo.save(perm);
    }
    permMap.set(`${p.module}:${p.action}:${p.subject}`, perm);
  }
  console.log(`  ${permMap.size} permissions ready`);
  console.log('Seeding roles...');
  const roleMap = new Map<string, Role>();
  for (const r of SYSTEM_ROLES) {
    let role = await roleRepo.findOne({ where: { name: r.name, isSystem: r.isSystem } });
    if (!role) {
      role = roleRepo.create({ name: r.name, nameTh: r.nameTh, level: r.level, isSystem: r.isSystem });
      role = await roleRepo.save(role);
    }
    roleMap.set(r.name, role);
  }
  console.log(`  ${roleMap.size} roles ready`);
  console.log('Assigning permissions to roles...');
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = roleMap.get(roleName);
    if (!role) continue;
    for (const key of permKeys) {
      const perm = permMap.get(key);
      if (!perm) continue;
      const exists = await rpRepo.findOne({ where: { roleId: role.id, permissionId: perm.id } });
      if (!exists) {
        await rpRepo.save(rpRepo.create({ roleId: role.id, permissionId: perm.id }));
      }
    }
  }
  console.log('  Role permissions assigned');
}