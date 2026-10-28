import { DataSource } from 'typeorm';

/**
 * Rework 2.1 — ลบข้อมูลของระบบเก่าออกทุกโมดูล + ลบ user ทั้งหมด
 * (เก็บเฉพาะตาราง migrations ไว้ ที่เหลือ seed ใหม่ทั้งหมด)
 *
 * ใช้ TRUNCATE ... RESTART IDENTITY CASCADE กับทุกตารางใน schema public
 * จากนั้น seedRolesAndPermissions / seedMasterData / seedInitialOrg จะสร้างขึ้นใหม่
 */
export async function resetAllData(dataSource: DataSource): Promise<void> {
  const KEEP = ['migrations', 'typeorm_metadata'];
  const rows: Array<{ tablename: string }> = await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
  );
  const tables = rows
    .map((r) => r.tablename)
    .filter((t) => !KEEP.includes(t))
    .map((t) => `"${t}"`);

  if (tables.length === 0) {
    console.log('  ไม่มีตารางให้ล้าง');
    return;
  }

  await dataSource.query(`TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
  console.log(`  ล้างข้อมูล ${tables.length} ตารางเรียบร้อย (ลบ user + ข้อมูลทุกโมดูล)`);
}
