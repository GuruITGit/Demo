import { MigrationInterface, QueryRunner } from 'typeorm';

/** เพิ่มฟิลด์ตั้งค่าเอกสาร/ใบเสร็จใน water_rate (admin ตั้งค่าได้) — idempotent */
export class WaterRateDocConfig1700000045000 implements MigrationInterface {
  name = 'WaterRateDocConfig1700000045000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_rate
      ADD COLUMN IF NOT EXISTS receipt_header text,
      ADD COLUMN IF NOT EXISTS receipt_footer text,
      ADD COLUMN IF NOT EXISTS doc_title varchar(120)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_rate
      DROP COLUMN IF EXISTS receipt_header,
      DROP COLUMN IF EXISTS receipt_footer,
      DROP COLUMN IF EXISTS doc_title`);
  }
}
