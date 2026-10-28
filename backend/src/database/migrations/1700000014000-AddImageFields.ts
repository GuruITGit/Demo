import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ระบบรูปภาพ:
 *  - file_uploads.thumbnail_url = URL รูปย่อ (สร้างอัตโนมัติตอนอัปโหลดรูป)
 *  - file_uploads.caption       = คำอธิบายรูป
 *  - file_uploads.category      = หมวด/ช่วง (เช่น ก่อน/ระหว่าง/หลัง สำหรับรูปโครงการ)
 *  - organizations.seal_url     = ตราประทับหน่วยงาน (คู่กับ logo_url ที่มีอยู่แล้ว)
 */
export class AddImageFields1700000014000 implements MigrationInterface {
  name = 'AddImageFields1700000014000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "file_uploads" ADD COLUMN IF NOT EXISTS "thumbnail_url" VARCHAR(500)`);
    await q.query(`ALTER TABLE "file_uploads" ADD COLUMN IF NOT EXISTS "caption" VARCHAR(500)`);
    await q.query(`ALTER TABLE "file_uploads" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50)`);
    await q.query(`ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "seal_url" VARCHAR(500)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "organizations" DROP COLUMN IF EXISTS "seal_url"`);
    await q.query(`ALTER TABLE "file_uploads" DROP COLUMN IF EXISTS "category"`);
    await q.query(`ALTER TABLE "file_uploads" DROP COLUMN IF EXISTS "caption"`);
    await q.query(`ALTER TABLE "file_uploads" DROP COLUMN IF EXISTS "thumbnail_url"`);
  }
}
