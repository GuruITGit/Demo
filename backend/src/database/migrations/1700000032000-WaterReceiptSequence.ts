import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ตัวรันเลขที่ใบเสร็จค่าน้ำ — atomic ต่อ องค์กร × ปีงบประมาณ
 * (vendor มีปุ่ม "สร้างเลขที่ใบเสร็จ" · ระบบเดิม อบต. เลขใบเสร็จว่างทั้งหมด → เราออกให้อัตโนมัติ)
 */
export class WaterReceiptSequence1700000032000 implements MigrationInterface {
  name = 'WaterReceiptSequence1700000032000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "water_receipt_sequences" (
        "organization_id" uuid NOT NULL,
        "fiscal_year" integer NOT NULL,
        "last_no" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_water_receipt_sequences" PRIMARY KEY ("organization_id", "fiscal_year")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "water_receipt_sequences"`);
  }
}
