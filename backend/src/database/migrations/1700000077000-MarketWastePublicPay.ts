import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ค่าแผง/ค่าขยะ: ให้ประชาชนแจ้งชำระเอง (แนบสลิป / แจ้งจะจ่ายเงินสด) แล้วเจ้าหน้าที่ตรวจ
 * + เก็บข้อมูลติดต่อผู้จองแผงจากหน้าประชาชน · ทุกคอลัมน์เป็น nullable/มีค่าเริ่มต้น → ไม่กระทบแถวเดิม
 */
export class MarketWastePublicPay1700000077000 implements MigrationInterface {
  name = 'MarketWastePublicPay1700000077000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const t of ['market_bills', 'waste_bills']) {
      await queryRunner.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "slip_url" TEXT`);
      await queryRunner.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "submitted_method" VARCHAR(12)`);
      await queryRunner.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ`);
      await queryRunner.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "review_note" VARCHAR(300)`);
    }
    await queryRunner.query(`ALTER TABLE "market_stalls" ADD COLUMN IF NOT EXISTS "contact_phone" VARCHAR(20)`);
    await queryRunner.query(`ALTER TABLE "market_stalls" ADD COLUMN IF NOT EXISTS "reserved_at" TIMESTAMPTZ`);
    // เลขใบเสร็จรันต่อ org + ประเภท + ปี (กันซ้ำแบบ atomic)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pay_receipt_sequences" (
        "organization_id" UUID NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
        "prefix" VARCHAR(4) NOT NULL,
        "year" INT NOT NULL,
        "last_no" INT NOT NULL DEFAULT 0,
        PRIMARY KEY ("organization_id", "prefix", "year")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "pay_receipt_sequences"`);
    await queryRunner.query(`ALTER TABLE "market_stalls" DROP COLUMN IF EXISTS "reserved_at"`);
    await queryRunner.query(`ALTER TABLE "market_stalls" DROP COLUMN IF EXISTS "contact_phone"`);
    for (const t of ['waste_bills', 'market_bills']) {
      for (const c of ['review_note', 'submitted_at', 'submitted_method', 'slip_url']) {
        await queryRunner.query(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "${c}"`);
      }
    }
  }
}
