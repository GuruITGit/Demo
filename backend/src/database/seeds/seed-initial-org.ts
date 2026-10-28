import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Organization } from '../entities/organization.entity';
import { Department } from '../entities/department.entity';
import { Division } from '../entities/division.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import { EmployeePosition } from '../entities/employee-position.entity';
import { Employee } from '../entities/employee.entity';
import { LeaveType } from '../entities/leave-type.entity';
import { LeaveQuota } from '../entities/leave-quota.entity';
import { getCurrentThaiYear } from '../../common/utils/date.util';

/**
 * Rework 2.1 — โครงสร้างองค์กร อบต. มาตรฐาน 3 ชั้น (ฝ่าย/กลุ่ม → กอง → งาน)
 * + ผู้ใช้สมมติครบทุกตำแหน่ง/กอง/กลุ่ม
 */

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'ChangeMe@Local1';

// ── กอง/หน่วยงาน (group_label ใช้จัดกลุ่มใน Tree, dept_type = POLITICAL/COUNCIL/ADMIN) ──
const DEPARTMENTS = [
  { code: 'EXEC', nameTh: 'คณะผู้บริหาร', groupLabel: 'ฝ่ายบริหารและปลัด อบต.', deptType: 'POLITICAL', orderNo: 1 },
  { code: 'MGMT', nameTh: 'ปลัด อบต.', groupLabel: 'ฝ่ายบริหารและปลัด อบต.', deptType: 'ADMIN', orderNo: 2 },
  { code: 'COUNCIL', nameTh: 'สภาองค์การบริหารส่วนตำบล', groupLabel: 'ฝ่ายสภา อบต.', deptType: 'COUNCIL', orderNo: 3 },
  { code: 'ADMIN', nameTh: 'สำนักปลัด', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 4 },
  { code: 'FINANCE', nameTh: 'กองคลัง', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 5 },
  { code: 'ENGINEERING', nameTh: 'กองช่าง', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 6 },
  { code: 'EDUCATION', nameTh: 'กองการศึกษา ศาสนาและวัฒนธรรม', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 7 },
  { code: 'HEALTH', nameTh: 'กองสาธารณสุขและสิ่งแวดล้อม', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 8 },
  { code: 'WELFARE', nameTh: 'กองสวัสดิการสังคม', groupLabel: 'ส่วนราชการ', deptType: 'ADMIN', orderNo: 9 },
];

// ── งาน (ส่วนงานย่อยในแต่ละกอง) ──
const DIVISIONS = [
  { code: 'ADM_GENERAL', nameTh: 'งานบริหารทั่วไป', deptCode: 'ADMIN', orderNo: 1 },
  { code: 'ADM_PERSONNEL', nameTh: 'งานการเจ้าหน้าที่', deptCode: 'ADMIN', orderNo: 2 },
  { code: 'ADM_PLAN', nameTh: 'งานนโยบายและแผน', deptCode: 'ADMIN', orderNo: 3 },
  { code: 'ADM_LEGAL', nameTh: 'งานนิติการ', deptCode: 'ADMIN', orderNo: 4 },
  { code: 'ADM_DISASTER', nameTh: 'งานป้องกันและบรรเทาสาธารณภัย', deptCode: 'ADMIN', orderNo: 5 },
  { code: 'FIN_MONEY', nameTh: 'งานการเงิน', deptCode: 'FINANCE', orderNo: 1 },
  { code: 'FIN_ACCT', nameTh: 'งานบัญชี', deptCode: 'FINANCE', orderNo: 2 },
  { code: 'FIN_REVENUE', nameTh: 'งานพัฒนาและจัดเก็บรายได้', deptCode: 'FINANCE', orderNo: 3 },
  { code: 'FIN_SUPPLY', nameTh: 'งานทะเบียนทรัพย์สินและพัสดุ', deptCode: 'FINANCE', orderNo: 4 },
  { code: 'ENG_BUILD', nameTh: 'งานก่อสร้าง', deptCode: 'ENGINEERING', orderNo: 1 },
  { code: 'ENG_DESIGN', nameTh: 'งานออกแบบและควบคุมอาคาร', deptCode: 'ENGINEERING', orderNo: 2 },
  { code: 'ENG_INFRA', nameTh: 'งานสาธารณูปโภค', deptCode: 'ENGINEERING', orderNo: 3 },
  { code: 'ENG_CIVIL', nameTh: 'งานวิศวกรรมโยธา', deptCode: 'ENGINEERING', orderNo: 4 },
  { code: 'EDU_ADMIN', nameTh: 'งานบริหารการศึกษา', deptCode: 'EDUCATION', orderNo: 1 },
  { code: 'EDU_PROMOTE', nameTh: 'งานส่งเสริมการศึกษา ศาสนาและวัฒนธรรม', deptCode: 'EDUCATION', orderNo: 2 },
  { code: 'EDU_CHILD', nameTh: 'งานศูนย์พัฒนาเด็กเล็ก', deptCode: 'EDUCATION', orderNo: 3 },
  { code: 'HLT_ENV', nameTh: 'งานอนามัยและสิ่งแวดล้อม', deptCode: 'HEALTH', orderNo: 1 },
  { code: 'HLT_PROMOTE', nameTh: 'งานส่งเสริมสุขภาพและสาธารณสุข', deptCode: 'HEALTH', orderNo: 2 },
  { code: 'HLT_CLEAN', nameTh: 'งานรักษาความสะอาด', deptCode: 'HEALTH', orderNo: 3 },
  { code: 'WEL_COMM', nameTh: 'งานสวัสดิการและพัฒนาชุมชน', deptCode: 'WELFARE', orderNo: 1 },
  { code: 'WEL_SOCIAL', nameTh: 'งานสังคมสงเคราะห์', deptCode: 'WELFARE', orderNo: 2 },
  { code: 'WEL_CAREER', nameTh: 'งานส่งเสริมอาชีพและพัฒนาสตรี', deptCode: 'WELFARE', orderNo: 3 },
];

interface SeedUser {
  username: string; fullNameTh: string; titleTh: string; positionName: string;
  roleName: string; deptCode: string; divCode?: string; isHead?: boolean;
}

const USERS: SeedUser[] = [
  // ── ฝ่ายบริหาร (การเมือง) ──
  { username: 'mayor', fullNameTh: 'สมชาย ดีใจ', titleTh: 'นาย', positionName: 'นายกองค์การบริหารส่วนตำบล', roleName: 'MAYOR', deptCode: 'EXEC' },
  { username: 'deputy_mayor1', fullNameTh: 'อนันต์ มั่นคง', titleTh: 'นาย', positionName: 'รองนายกองค์การบริหารส่วนตำบล', roleName: 'DEPUTY_MAYOR', deptCode: 'EXEC' },
  { username: 'deputy_mayor2', fullNameTh: 'มาลี ใจดี', titleTh: 'นาง', positionName: 'รองนายกองค์การบริหารส่วนตำบล', roleName: 'DEPUTY_MAYOR', deptCode: 'EXEC' },
  { username: 'secretary_mayor', fullNameTh: 'วีระ ช่วยงาน', titleTh: 'นาย', positionName: 'เลขานุการนายก อบต.', roleName: 'EMPLOYEE', deptCode: 'EXEC' },
  // ── ปลัด ──
  { username: 'clerk', fullNameTh: 'สมศรี บริหาร', titleTh: 'นาง', positionName: 'ปลัดองค์การบริหารส่วนตำบล', roleName: 'CLERK', deptCode: 'MGMT', isHead: true },
  { username: 'deputy_clerk', fullNameTh: 'ประยุทธ รองปลัด', titleTh: 'นาย', positionName: 'รองปลัดองค์การบริหารส่วนตำบล', roleName: 'CLERK', deptCode: 'MGMT' },
  // ── สภา ──
  { username: 'council_chair', fullNameTh: 'บุญมี ประธาน', titleTh: 'นาย', positionName: 'ประธานสภา อบต.', roleName: 'EMPLOYEE', deptCode: 'COUNCIL', isHead: true },
  { username: 'council_vice', fullNameTh: 'สมหมาย รองประธาน', titleTh: 'นาย', positionName: 'รองประธานสภา อบต.', roleName: 'EMPLOYEE', deptCode: 'COUNCIL' },
  { username: 'council_member1', fullNameTh: 'ทองดี ชาวบ้าน', titleTh: 'นาย', positionName: 'สมาชิกสภา อบต.', roleName: 'EMPLOYEE', deptCode: 'COUNCIL' },
  { username: 'council_member2', fullNameTh: 'สมปอง รักถิ่น', titleTh: 'นาง', positionName: 'สมาชิกสภา อบต.', roleName: 'EMPLOYEE', deptCode: 'COUNCIL' },
  // ── สำนักปลัด ──
  { username: 'head_admin', fullNameTh: 'ประสิทธิ์ หัวหน้า', titleTh: 'นาย', positionName: 'หัวหน้าสำนักปลัด', roleName: 'DEPT_HEAD', deptCode: 'ADMIN', divCode: 'ADM_GENERAL', isHead: true },
  { username: 'off_general', fullNameTh: 'นภา ทำงาน', titleTh: 'นางสาว', positionName: 'นักจัดการงานทั่วไป', roleName: 'OFFICER', deptCode: 'ADMIN', divCode: 'ADM_GENERAL' },
  { username: 'off_hr', fullNameTh: 'วันชัย บุคคล', titleTh: 'นาย', positionName: 'นักทรัพยากรบุคคล', roleName: 'OFFICER', deptCode: 'ADMIN', divCode: 'ADM_PERSONNEL' },
  { username: 'off_plan', fullNameTh: 'จิราพร วางแผน', titleTh: 'นางสาว', positionName: 'นักวิเคราะห์นโยบายและแผน', roleName: 'OFFICER', deptCode: 'ADMIN', divCode: 'ADM_PLAN' },
  { username: 'off_legal', fullNameTh: 'ธนา ยุติธรรม', titleTh: 'นาย', positionName: 'นิติกร', roleName: 'OFFICER', deptCode: 'ADMIN', divCode: 'ADM_LEGAL' },
  // ── กองคลัง ──
  { username: 'dir_finance', fullNameTh: 'รัตนา การเงิน', titleTh: 'นาง', positionName: 'ผู้อำนวยการกองคลัง', roleName: 'DEPT_HEAD', deptCode: 'FINANCE', divCode: 'FIN_MONEY', isHead: true },
  { username: 'off_finance', fullNameTh: 'ศิริพร บัญชี', titleTh: 'นางสาว', positionName: 'นักวิชาการเงินและบัญชี', roleName: 'OFFICER', deptCode: 'FINANCE', divCode: 'FIN_ACCT' },
  { username: 'off_revenue', fullNameTh: 'มานพ จัดเก็บ', titleTh: 'นาย', positionName: 'นักวิชาการจัดเก็บรายได้', roleName: 'OFFICER', deptCode: 'FINANCE', divCode: 'FIN_REVENUE' },
  { username: 'off_procure', fullNameTh: 'อารีย์ พัสดุ', titleTh: 'นาง', positionName: 'เจ้าพนักงานพัสดุ', roleName: 'OFFICER', deptCode: 'FINANCE', divCode: 'FIN_SUPPLY' },
  // ── กองช่าง ──
  { username: 'dir_eng', fullNameTh: 'สมศักดิ์ ช่างดี', titleTh: 'นาย', positionName: 'ผู้อำนวยการกองช่าง', roleName: 'DEPT_HEAD', deptCode: 'ENGINEERING', divCode: 'ENG_CIVIL', isHead: true },
  { username: 'off_civil', fullNameTh: 'วิชัย สร้างบ้าน', titleTh: 'นาย', positionName: 'นายช่างโยธา', roleName: 'OFFICER', deptCode: 'ENGINEERING', divCode: 'ENG_CIVIL' },
  { username: 'off_infra', fullNameTh: 'ประเสริฐ ประปา', titleTh: 'นาย', positionName: 'นายช่างสาธารณูปโภค', roleName: 'OFFICER', deptCode: 'ENGINEERING', divCode: 'ENG_INFRA' },
  // ── กองการศึกษา ──
  { username: 'dir_edu', fullNameTh: 'พรทิพย์ การศึกษา', titleTh: 'นาง', positionName: 'ผู้อำนวยการกองการศึกษา', roleName: 'DEPT_HEAD', deptCode: 'EDUCATION', divCode: 'EDU_ADMIN', isHead: true },
  { username: 'off_edu', fullNameTh: 'กนกพร สอนดี', titleTh: 'นางสาว', positionName: 'นักวิชาการศึกษา', roleName: 'OFFICER', deptCode: 'EDUCATION', divCode: 'EDU_PROMOTE' },
  // ── กองสาธารณสุขฯ ──
  { username: 'dir_health', fullNameTh: 'วิโรจน์ สุขภาพ', titleTh: 'นาย', positionName: 'ผู้อำนวยการกองสาธารณสุขและสิ่งแวดล้อม', roleName: 'DEPT_HEAD', deptCode: 'HEALTH', divCode: 'HLT_ENV', isHead: true },
  { username: 'off_health', fullNameTh: 'สุนีย์ อนามัย', titleTh: 'นาง', positionName: 'นักวิชาการสาธารณสุข', roleName: 'OFFICER', deptCode: 'HEALTH', divCode: 'HLT_PROMOTE' },
  // ── กองสวัสดิการสังคม ──
  { username: 'dir_welfare', fullNameTh: 'สมหญิง พัฒนา', titleTh: 'นาง', positionName: 'ผู้อำนวยการกองสวัสดิการสังคม', roleName: 'DEPT_HEAD', deptCode: 'WELFARE', divCode: 'WEL_COMM', isHead: true },
  { username: 'off_welfare', fullNameTh: 'ชูเกียรติ ชุมชน', titleTh: 'นาย', positionName: 'นักพัฒนาชุมชน', roleName: 'OFFICER', deptCode: 'WELFARE', divCode: 'WEL_COMM' },
];

export async function seedInitialOrg(dataSource: DataSource): Promise<{ org: Organization; adminUser: User }> {
  const orgRepo = dataSource.getRepository(Organization);
  const deptRepo = dataSource.getRepository(Department);
  const divRepo = dataSource.getRepository(Division);
  const userRepo = dataSource.getRepository(User);
  const roleRepo = dataSource.getRepository(Role);
  const userRoleRepo = dataSource.getRepository(UserRole);
  const positionRepo = dataSource.getRepository(EmployeePosition);

  // Organization
  let org = await orgRepo.findOne({ where: { code: 'ABT-DEMO' } });
  if (!org) {
    org = await orgRepo.save(orgRepo.create({
      code: 'ABT-DEMO',
      nameTh: 'องค์การบริหารส่วนตำบลตัวอย่าง',
      nameEn: 'Example Sub-district Administrative Organization',
      type: 'อบต',
      province: 'กรุงเทพมหานคร', district: 'บางรัก', subDistrict: 'สี่พระยา',
      address: '123 ถนนสีลม แขวงสี่พระยา เขตบางรัก กรุงเทพมหานคร 10500',
      phone: '02-234-5678', email: 'admin@example-abt.go.th',
      headerText: 'องค์การบริหารส่วนตำบลตัวอย่าง',
    }));
    console.log('  Organization created:', org.nameTh);
  }

  // Departments
  const deptMap = new Map<string, Department>();
  for (const d of DEPARTMENTS) {
    let dept = await deptRepo.findOne({ where: { organizationId: org.id, code: d.code } });
    if (!dept) {
      dept = await deptRepo.save(deptRepo.create({ ...d, organizationId: org.id }));
    } else {
      await deptRepo.update(dept.id, { nameTh: d.nameTh, groupLabel: d.groupLabel, deptType: d.deptType, orderNo: d.orderNo });
    }
    deptMap.set(d.code, dept);
  }
  console.log(`  ${DEPARTMENTS.length} departments created/verified`);

  // Divisions
  const divMap = new Map<string, Division>();
  for (const dv of DIVISIONS) {
    const dept = deptMap.get(dv.deptCode);
    if (!dept) continue;
    let div = await divRepo.findOne({ where: { departmentId: dept.id, code: dv.code } });
    if (!div) {
      div = await divRepo.save(divRepo.create({ code: dv.code, nameTh: dv.nameTh, departmentId: dept.id, orderNo: dv.orderNo }));
    }
    divMap.set(dv.code, div);
  }
  console.log(`  ${DIVISIONS.length} divisions created/verified`);

  // Admin user (SUPER_ADMIN)
  const adminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'ChangeMe@Local1';
  let adminUser = await userRepo.findOne({ where: { username: adminUsername } });
  if (!adminUser) {
    adminUser = await userRepo.save(userRepo.create({
      organizationId: org.id,
      username: adminUsername,
      email: process.env.INITIAL_ADMIN_EMAIL || 'admin@smartgov.local',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      fullNameTh: 'ผู้ดูแลระบบ', titleTh: 'นาย',
      departmentId: deptMap.get('MGMT')?.id,
      positionName: 'ผู้ดูแลระบบ', isActive: true, isVerified: true,
    }));
    console.log(`  Admin user created: ${adminUsername} / ${adminPassword}`);
  }
  const superAdminRole = await roleRepo.findOne({ where: { name: 'SUPER_ADMIN' } });
  if (superAdminRole) {
    const exists = await userRoleRepo.findOne({ where: { userId: adminUser.id, roleId: superAdminRole.id } });
    if (!exists) await userRoleRepo.save(userRoleRepo.create({ userId: adminUser.id, roleId: superAdminRole.id, assignedBy: adminUser.id }));
  }

  // Demo users ทุกตำแหน่ง/กอง + employee record + โควตาลา (ให้โมดูล HR/การลาใช้งานได้)
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const empRepo = dataSource.getRepository(Employee);
  const leaveTypeRepo = dataSource.getRepository(LeaveType);
  const quotaRepo = dataSource.getRepository(LeaveQuota);
  const leaveTypes = await leaveTypeRepo.find({ where: { organizationId: org.id } });
  const year = getCurrentThaiYear();
  let empIdx = 0;

  const makeEmployee = async (user: User, u: SeedUser, deptId?: string) => {
    if (await empRepo.findOne({ where: { userId: user.id } })) return;
    empIdx++;
    const [firstNameTh, ...rest] = u.fullNameTh.split(' ');
    const emp = await empRepo.save(empRepo.create({
      organizationId: org.id,
      userId: user.id,
      employeeCode: `EMP-${String(empIdx).padStart(3, '0')}`,
      title: u.titleTh,
      firstNameTh,
      lastNameTh: rest.join(' ') || '-',
      nationalId: String(1100000000000 + empIdx),
      departmentId: deptId,
      positionName: u.positionName,
      employeeType: 'พนักงานส่วนตำบล',
      hireDate: new Date('2020-01-01'),
    }));
    // โควตาวันลาตามประเภท
    for (const lt of leaveTypes) {
      const exists = await quotaRepo.findOne({ where: { employeeId: emp.id, leaveTypeId: lt.id, year } });
      if (!exists) {
        await quotaRepo.save(quotaRepo.create({
          employeeId: emp.id, leaveTypeId: lt.id, year,
          totalDays: (lt as any).maxDaysYear || 10, usedDays: 0,
        }));
      }
    }
  };

  for (const u of USERS) {
    let user = await userRepo.findOne({ where: { username: u.username } });
    const dept = deptMap.get(u.deptCode);
    const div = u.divCode ? divMap.get(u.divCode) : undefined;
    if (!user) {
      user = await userRepo.save(userRepo.create({
        organizationId: org.id,
        username: u.username,
        email: `${u.username}@smartgov.local`,
        passwordHash,
        fullNameTh: u.fullNameTh,
        titleTh: u.titleTh,
        departmentId: dept?.id,
        divisionId: div?.id,
        positionName: u.positionName,
        isActive: true, isVerified: true,
      }));
      const role = await roleRepo.findOne({ where: { name: u.roleName } });
      if (role) await userRoleRepo.save(userRoleRepo.create({ userId: user.id, roleId: role.id, assignedBy: adminUser.id }));
    }
    await makeEmployee(user, u, dept?.id);
    // ตั้งหัวหน้ากอง
    if (u.isHead && dept && dept.headUserId !== user.id) {
      await deptRepo.update(dept.id, { headUserId: user.id });
    }
  }
  console.log(`  ${USERS.length} demo users + employees created/verified (password: ${DEMO_PASSWORD})`);

  // Employee positions (อ้างอิงตำแหน่งมาตรฐาน)
  const positions = [
    { code: 'MAYOR', nameTh: 'นายกองค์การบริหารส่วนตำบล', level: 10, salaryMin: 50000, salaryMax: 80000 },
    { code: 'DEPUTY_MAYOR', nameTh: 'รองนายกองค์การบริหารส่วนตำบล', level: 9, salaryMin: 40000, salaryMax: 60000 },
    { code: 'CLERK', nameTh: 'ปลัดองค์การบริหารส่วนตำบล', level: 9, salaryMin: 40000, salaryMax: 65000 },
    { code: 'DEPUTY_CLERK', nameTh: 'รองปลัดองค์การบริหารส่วนตำบล', level: 8, salaryMin: 35000, salaryMax: 55000 },
    { code: 'DEPT_HEAD', nameTh: 'ผู้อำนวยการกอง/หัวหน้าสำนักปลัด', level: 7, salaryMin: 28000, salaryMax: 45000 },
    { code: 'OFFICER', nameTh: 'นักวิชาการ/เจ้าพนักงาน', level: 5, salaryMin: 18000, salaryMax: 32000 },
    { code: 'STAFF', nameTh: 'เจ้าพนักงานปฏิบัติงาน', level: 3, salaryMin: 13000, salaryMax: 20000 },
    { code: 'WORKER', nameTh: 'พนักงานจ้าง', level: 1, salaryMin: 9000, salaryMax: 15000 },
  ];
  for (const pos of positions) {
    const exists = await positionRepo.findOne({ where: { organizationId: org.id, code: pos.code } });
    if (!exists) await positionRepo.save(positionRepo.create({ ...pos, organizationId: org.id }));
  }
  console.log(`  ${positions.length} employee positions created/verified`);

  return { org, adminUser };
}
