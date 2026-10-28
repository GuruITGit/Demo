/**
 * รัน migration ที่ค้างอยู่ก่อนสตาร์ทแอป (ใช้ตอน deploy)
 * ใช้ DataSource เดียวกับ config — apply เฉพาะ migration ที่ยังไม่ได้รัน (idempotent)
 * ถ้าล้มเหลว → exit code 1 เพื่อให้ deploy fail (กัน schema ไม่ตรง)
 */
import AppDataSource from './config/typeorm.config';

(async () => {
  try {
    await AppDataSource.initialize();
    const ran = await AppDataSource.runMigrations();
    console.log(ran.length ? `✓ รัน migration ${ran.length} รายการ: ${ran.map((m) => m.name).join(', ')}` : '✓ ไม่มี migration ค้าง');
    await AppDataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('✗ รัน migration ไม่สำเร็จ:', err);
    process.exit(1);
  }
})();
