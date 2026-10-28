import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่ม water_rate.slip_receiver_name — ชื่อบัญชีผู้รับเงินที่ถูกต้อง (ตามที่ขึ้นบนสลิป)
 * ใช้เทียบ "บัญชีปลายทางตรงไหม" ด้วยชื่อ แทนเลขบัญชี เพราะพร้อมเพย์เบอร์บนสลิปจะโชว์เป็นเลขบัญชีธนาคารจริง (คนละเลขกับเบอร์)
 */
export class WaterSlipReceiverName1700000061000 implements MigrationInterface {
  name = 'WaterSlipReceiverName1700000061000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "water_rate" ADD COLUMN IF NOT EXISTS "slip_receiver_name" varchar(200)`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "water_rate" DROP COLUMN IF EXISTS "slip_receiver_name"`);
  }
}
