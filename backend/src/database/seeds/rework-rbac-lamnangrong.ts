import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { seedRolesAndPermissions, PERMISSIONS, ROLE_PERMISSIONS } from './seed-roles-permissions';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { UserPermission } from '../entities/user-permission.entity';
import { User } from '../entities/user.entity';
import { Department } from '../entities/department.entity';
import { Organization } from '../entities/organization.entity';
import { SystemSetting } from '../entities/system-setting.entity';

/**
 * Rework 3.0 — รื้อระบบสิทธิ์เป็น role-based ล้วน + ล้างของตาย
 *
 * ส่วน "แคตตาล็อก" (รันได้ทุก env, ปลอดภัย):
 *   - sync catalog สิทธิ์ + บทบาท (เพิ่ม AUDITOR) จาก seed
 *   - prune สิทธิ์ตายที่ไม่อยู่ใน catalog (Incoming/Outgoing/assets/salary/leave-approve...)
 *   - บังคับ preset ของแต่ละบทบาทให้ตรง ROLE_PERMISSIONS (ลบสิทธิ์เกิน)
 *   - ล้าง direct user_permissions ทั้งหมด (ให้บทบาทคุมแทน — override เพิ่มใหม่ได้ทีหลัง)
 *   - ล้าง system settings ที่ไม่ได้ใช้ + ยุบแถวซ้ำ
 *
 * ส่วน "ข้อมูลจริง อบต.ลำนางรอง" (เฉพาะเมื่อส่ง --prod):
 *   - ผูกบทบาทให้พนักงานจริงตามตำแหน่ง
 *   - สร้าง "สุทัศน์" (รองนายก) เพิ่ม
 *   - แก้ที่อยู่องค์กรเป็นของจริง
 */

// username → บทบาท (พนักงานจริง อบต.ลำนางรอง — ตามตารางที่ยืนยันกับลูกค้า)
const USER_ROLE_MAP: Record<string, string> = {
  'santi.n': 'MAYOR',
  'samruai.p': 'DEPUTY_MAYOR',
  'thansita.k': 'CLERK',
  'jidapa.b': 'DEPT_HEAD',
  'nattanan.m': 'DEPT_HEAD',
  'peerapan.k': 'DEPT_HEAD',
  'ratchaphon.i': 'DEPT_HEAD',
  'chakkapan.n': 'DIV_HEAD',
  'thawanhathai.d': 'AUDITOR',
  // เจ้าหน้าที่ (ธุรการ/นักวิชาการ/ผู้ช่วย ฯลฯ)
  'rattikan.p': 'OFFICER', 'phanida.p': 'OFFICER', 'suphakit.j': 'OFFICER',
  'kanlaya.l': 'OFFICER', 'natthaphon.k': 'OFFICER', 'angkana.p': 'OFFICER',
  'udomlug.p': 'OFFICER', 'nattawut.j': 'OFFICER', 'chalermpong.j': 'OFFICER',
  'nattarika.k': 'OFFICER', 'pacharee.h': 'OFFICER', 'wichayanon.p': 'OFFICER',
  'nanthicha.j': 'OFFICER', 'thitima.c': 'OFFICER', 'jirapa.n': 'OFFICER',
  'suthida.w': 'OFFICER',
};

// ผู้ใช้ที่จะสร้างเพิ่ม (ยังไม่มีบัญชีบน prod)
const NEW_USERS = [
  { username: 'sutach.k', fullNameTh: 'สุทัศน์ โคตรประทุม', titleTh: 'นาย', positionName: 'รองนายก อบต.', roleName: 'DEPUTY_MAYOR', deptNameTh: 'สำนักปลัด', password: 'Head@1234' },
];

// system settings ที่ใช้จริง (นอกจากนี้ลบทิ้ง)
const KEEP_SETTINGS = ['auth.max_failed_attempts', 'auth.lockout_minutes', 'file.max_size_mb', 'file.allowed_types'];

const REAL_ORG = {
  nameTh: 'องค์การบริหารส่วนตำบลลำนางรอง',
  province: 'บุรีรัมย์', district: 'โนนดินแดง', subDistrict: 'ลำนางรอง',
  address: '194 หมู่ 14 ถนนละหานทราย-ตาพระยา ตำบลลำนางรอง อำเภอโนนดินแดง จังหวัดบุรีรัมย์ 31260',
  phone: '044-610201-2', website: 'https://www.lamnangrong.go.th',
  headerText: 'องค์การบริหารส่วนตำบลลำนางรอง',
};

export async function reworkRbacCatalog(ds: DataSource): Promise<void> {
  const permRepo = ds.getRepository(Permission);
  const roleRepo = ds.getRepository(Role);
  const rolePermRepo = ds.getRepository(RolePermission);
  const settingRepo = ds.getRepository(SystemSetting);

  // 1) sync catalog + roles + presets (เพิ่ม AUDITOR + สิทธิ์ใหม่)
  console.log('  1) sync catalog + roles + presets...');
  await seedRolesAndPermissions(ds);

  // 2) prune สิทธิ์ตาย (ไม่อยู่ใน catalog ปัจจุบัน)
  const catalogKeys = new Set(PERMISSIONS.map((p) => `${p.module}:${p.action}:${p.subject}`));
  const allPerms = await permRepo.find();
  let pruned = 0;
  for (const p of allPerms) {
    const key = `${p.module}:${p.action}:${p.subject}`;
    if (catalogKeys.has(key)) continue;
    await rolePermRepo.delete({ permissionId: p.id });
    await ds.getRepository(UserPermission).delete({ permissionId: p.id });
    await permRepo.delete({ id: p.id });
    pruned++;
  }
  console.log(`  2) prune สิทธิ์ตาย: ลบ ${pruned} สิทธิ์`);

  // 3) บังคับ preset ต่อบทบาทให้ตรง (ลบสิทธิ์เกินที่ไม่อยู่ใน preset)
  let trimmed = 0;
  for (const [roleName, presetKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await roleRepo.findOne({ where: { name: roleName } });
    if (!role) continue;
    const presetSet = new Set(presetKeys);
    const rps = await rolePermRepo.find({ where: { roleId: role.id }, relations: ['permission'] });
    for (const rp of rps) {
      const key = `${rp.permission.module}:${rp.permission.action}:${rp.permission.subject}`;
      if (!presetSet.has(key)) {
        await rolePermRepo.delete({ roleId: role.id, permissionId: rp.permissionId });
        trimmed++;
      }
    }
  }
  console.log(`  3) preset authoritative: ลบสิทธิ์เกิน ${trimmed} รายการ`);

  // 4) ล้าง direct user_permissions ทั้งหมด (ให้บทบาทคุม — override เพิ่มใหม่ได้ทีหลัง)
  const delDirect = await ds.getRepository(UserPermission).createQueryBuilder().delete().execute();
  console.log(`  4) ล้าง direct perms: ${delDirect.affected ?? 0} รายการ`);

  // 5) ล้าง settings ที่ไม่ใช้ + ยุบแถวซ้ำ (เก็บ override ของ org ถ้ามี ไม่งั้น global)
  const allSettings = await settingRepo.find();
  let delSetting = 0;
  const byKey = new Map<string, SystemSetting[]>();
  for (const s of allSettings) {
    if (!KEEP_SETTINGS.includes(s.key)) { await settingRepo.delete({ id: s.id }); delSetting++; continue; }
    if (!byKey.has(s.key)) byKey.set(s.key, []);
    byKey.get(s.key)!.push(s);
  }
  for (const [, rows] of byKey) {
    if (rows.length <= 1) continue;
    // เก็บแถวที่มี organizationId (ค่าที่ผู้ใช้ตั้ง) ไว้ 1 แถว ลบที่เหลือ
    rows.sort((a, b) => (a.organizationId ? -1 : 1) - (b.organizationId ? -1 : 1));
    for (const r of rows.slice(1)) { await settingRepo.delete({ id: r.id }); delSetting++; }
  }
  console.log(`  5) ล้าง/ยุบ settings: ลบ ${delSetting} แถว`);
}

async function applyLamnangrongData(ds: DataSource): Promise<void> {
  const userRepo = ds.getRepository(User);
  const roleRepo = ds.getRepository(Role);
  const userRoleRepo = ds.getRepository(UserRole);
  const deptRepo = ds.getRepository(Department);
  const orgRepo = ds.getRepository(Organization);

  // 6) ผูกบทบาทให้พนักงานจริง (skip ถ้าไม่พบ user — ปลอดภัยบน local)
  let assigned = 0, skipped = 0;
  for (const [username, roleName] of Object.entries(USER_ROLE_MAP)) {
    const user = await userRepo.findOne({ where: { username } });
    if (!user) { skipped++; continue; }
    const role = await roleRepo.findOne({ where: { name: roleName } });
    if (!role) { skipped++; continue; }
    await userRoleRepo.delete({ userId: user.id });
    await userRoleRepo.save(userRoleRepo.create({ userId: user.id, roleId: role.id, assignedBy: user.id }));
    assigned++;
  }
  console.log(`  6) ผูกบทบาทพนักงานจริง: ${assigned} คน (ข้าม ${skipped})`);

  // หา org (จาก admin ก่อน ไม่งั้น org แรก)
  const adminUser = await userRepo.findOne({ where: { username: 'admin' } });
  const org = adminUser?.organizationId
    ? await orgRepo.findOne({ where: { id: adminUser.organizationId } })
    : (await orgRepo.find({ take: 1 }))[0];
  if (!org) { console.log('  ! ไม่พบ organization — ข้ามสร้าง user/แก้ที่อยู่'); return; }

  // 7) สร้างผู้ใช้เพิ่ม (สุทัศน์)
  let created = 0;
  for (const nu of NEW_USERS) {
    if (await userRepo.findOne({ where: { username: nu.username } })) continue;
    const dept = await deptRepo.findOne({ where: { organizationId: org.id, nameTh: nu.deptNameTh } });
    const user = await userRepo.save(userRepo.create({
      organizationId: org.id, username: nu.username, email: `${nu.username}@smartgov.local`,
      passwordHash: await bcrypt.hash(nu.password, 12), fullNameTh: nu.fullNameTh, titleTh: nu.titleTh,
      departmentId: dept?.id, positionName: nu.positionName, isActive: true, isVerified: true,
    }));
    const role = await roleRepo.findOne({ where: { name: nu.roleName } });
    if (role) await userRoleRepo.save(userRoleRepo.create({ userId: user.id, roleId: role.id, assignedBy: user.id }));
    created++;
  }
  console.log(`  7) สร้างผู้ใช้เพิ่ม: ${created} คน`);

  // 8) แก้ที่อยู่องค์กรเป็นของจริง
  await orgRepo.update(org.id, { ...REAL_ORG });
  console.log(`  8) อัปเดตที่อยู่องค์กร → ${REAL_ORG.nameTh}`);
}

async function main(): Promise<void> {
  const withProdData = process.argv.includes('--prod');
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'smartgov_dev',
    entities: [path.join(__dirname, '../entities/**/*.entity{.ts,.js}')],
    synchronize: false,
  });

  try {
    await ds.initialize();
    console.log('=== Rework RBAC 3.0 ===');
    await reworkRbacCatalog(ds);
    if (withProdData) {
      console.log('  --prod: ใส่ข้อมูลจริง อบต.ลำนางรอง...');
      await applyLamnangrongData(ds);
    } else {
      console.log('  (ข้ามข้อมูลจริง — ส่ง --prod เพื่อผูกบทบาทพนักงาน/แก้ที่อยู่)');
    }
    console.log('=== เสร็จ ===');
  } catch (err) {
    console.error('Rework failed:', err);
    process.exit(1);
  } finally {
    await ds.destroy();
  }
}

if (require.main === module) main();
