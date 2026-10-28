import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { fetchLegacy, saveBackup, loadBackup, syncLegacy, verifyLegacy, DEFAULT_LEGACY_URL } from '../../modules/water/legacy/legacy-sync';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

/**
 * ซิงก์ข้อมูลประปาจากระบบเดิม (Prapa On Mobile) → ระบบเรา แบบอัปเดตทับ ไม่ล้างทั้งก้อน — รันซ้ำได้เรื่อย ๆ จนกว่าจะย้ายมาใช้ระบบเราเต็มตัว
 * (ตัวทำงานจริงอยู่ที่ modules/water/legacy/legacy-sync.ts — ใช้ร่วมกับปุ่ม "อัปเดตจากระบบเดิม" ในหน้าแอดมินประปา)
 *   ผู้ใช้น้ำ: upsert ตามรหัส (ยึดระบบเดิม แต่คง access_token / walk_order ของเราไว้)
 *   บิล:     upsert ตาม (ผู้ใช้น้ำ, เดือน) (ยึดระบบเดิม แต่คง receipt_no / slip / รูปมาตร ของเราไว้)
 *   ไม่ลบอะไร ยกเว้นสั่ง --purge-test = ลบบิลที่สร้างในระบบเรา (legacy IS NULL) ซึ่งระบบเดิมไม่มี
 *
 * ดึงจากระบบเดิมด้วย GET อย่างเดียว · รหัสเข้าระบบเดิมส่งทาง env เท่านั้น (ห้ามเขียนลงไฟล์)
 *   LEGACY_ORG / LEGACY_USER / LEGACY_PASSWORD   (LEGACY_URL ค่าเริ่มต้น http://139.59.124.118)
 *   WATER_ORG_ID = id องค์กรปลายทาง (ไม่ใส่ = องค์กรที่ชื่อมี "ลำนางรอง")
 *
 * ตัวเลือก
 *   --dry               ทำทุกอย่างใน transaction แล้ว ROLLBACK — ดูว่าจะเปลี่ยนอะไรโดยไม่เขียนจริง
 *   --verify            ไม่เขียนอะไรเลย แค่เทียบระบบเดิมกับฐานข้อมูลเรา รายคน/รายบิล
 *   --since=69-001      ดึงบิลเฉพาะรอบนี้ขึ้นไป (ค่าเริ่มต้น = ทุกรอบ)
 *   --backup-dir=<dir>  เก็บข้อมูลดิบที่ดึงมาไว้ (ค่าเริ่มต้น ./prapa-backup) — มีข้อมูลส่วนบุคคล ห้ามเอาเข้า git
 *   --from-backup=<dir> ใช้ข้อมูลจาก backup ที่เคยดึงไว้ ไม่ต้องดึงใหม่
 *   --purge-test        ลบบิลทดสอบ (สร้างในระบบเรา + ระบบเดิมไม่มี) — ใช้ได้เฉพาะช่วงที่ระบบเรายังไม่ได้ใช้จริง
 *
 * local:  npm run sync:prapa -- --dry
 * prod:   docker compose -f docker-compose.lean.yml exec -e LEGACY_ORG=.. -e LEGACY_USER=.. -e LEGACY_PASSWORD=.. \
 *           backend node dist/database/seeds/sync-prapa-legacy.js --dry
 */

const args = process.argv.slice(2);
const flag = (n: string) => args.includes('--' + n);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=');

const DRY = flag('dry');
const VERIFY = flag('verify');
const PURGE = flag('purge-test');
const SINCE = opt('since');
const FROM_BACKUP = opt('from-backup');
const BACKUP_DIR = opt('backup-dir') || path.resolve(process.cwd(), 'prapa-backup');
const log = (s: string) => console.log(s);

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'smartgov_dev',
    synchronize: false,
  });
  await ds.initialize();

  const [org] = process.env.WATER_ORG_ID
    ? await ds.query(`SELECT id, name_th FROM organizations WHERE id = $1`, [process.env.WATER_ORG_ID])
    : await ds.query(`SELECT id, name_th FROM organizations WHERE name_th ILIKE '%ลำนางรอง%' ORDER BY created_at LIMIT 1`);
  if (!org) throw new Error('ไม่พบองค์กรปลายทาง — ตั้ง WATER_ORG_ID');
  console.log(`ปลายทาง: ${org.name_th} (${process.env.DB_DATABASE})${DRY ? ' · โหมดทดลอง (ไม่บันทึก)' : ''}${VERIFY ? ' · โหมดตรวจอย่างเดียว' : ''}`);

  const data = FROM_BACKUP
    ? loadBackup(FROM_BACKUP, SINCE)
    : await fetchLegacy({
      url: process.env.LEGACY_URL || DEFAULT_LEGACY_URL,
      org: process.env.LEGACY_ORG || '', user: process.env.LEGACY_USER || '', password: process.env.LEGACY_PASSWORD || '',
    }, { since: SINCE }, log);
  if (!FROM_BACKUP) saveBackup(data, BACKUP_DIR, log);

  let problems = 0;
  if (VERIFY) {
    problems = await verifyLegacy(q(ds), org.id, data, { showFrom: SINCE }, log);
  } else {
    const qr = ds.createQueryRunner();
    await qr.startTransaction();
    try {
      await syncLegacy(q(qr), org.id, data, { purge: PURGE }, log);
      problems = await verifyLegacy(q(qr), org.id, data, { showFrom: SINCE }, log);
      if (DRY) { await qr.rollbackTransaction(); console.log('\n[--dry] ยกเลิกทั้งหมด ไม่ได้บันทึก'); }
      else { await qr.commitTransaction(); console.log('\n✓ บันทึกแล้ว'); }
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }
  await ds.destroy();
  process.exit(problems ? 2 : 0);
}

const q = (r: { query: (sql: string, params?: any[]) => Promise<any> }) => (sql: string, params?: any[]) => r.query(sql, params);

main().catch((e) => { console.error('✗', e.message || e); process.exit(1); });
