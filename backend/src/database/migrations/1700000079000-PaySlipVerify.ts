import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ตรวจสลิปอัตโนมัติ (Slip2Go ฯลฯ): เก็บเลขอ้างอิงธุรกรรมของสลิปที่ใช้ชำระแล้ว
 * unique (ต่อ อบต.) กันสลิปเดียวกันถูกนำมาชำระซ้ำ · NULL ซ้ำได้ (ยังไม่มีสลิป)
 */
export class PaySlipVerify1700000079000 implements MigrationInterface {
  name = 'PaySlipVerify1700000079000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const t of ['market_bills', 'waste_bills']) {
      await queryRunner.query(`ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "slip_trans_ref" VARCHAR(60)`);
    }
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_market_bills_slip_ref" ON "market_bills" ("organization_id", "slip_trans_ref") WHERE "slip_trans_ref" IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_waste_bills_slip_ref" ON "waste_bills" ("organization_id", "slip_trans_ref") WHERE "slip_trans_ref" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_waste_bills_slip_ref"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_market_bills_slip_ref"`);
    for (const t of ['waste_bills', 'market_bills']) {
      await queryRunner.query(`ALTER TABLE "${t}" DROP COLUMN IF EXISTS "slip_trans_ref"`);
    }
  }
}
