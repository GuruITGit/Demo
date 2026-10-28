import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่ม water_bills_v2.slip_group_bill_ids — เก็บรายชื่อบิลพี่น้องที่จ่ายรวมกันด้วยสลิปใบเดียว
 * (จ่ายหลายบิลพร้อมกันด้วย QR รวม แต่ slip_trans_ref เขียนได้แค่บิล anchor ใบเดียว
 * เพราะชน UQ_water_bill_slip_ref — คอลัมน์นี้ให้ confirmSlip/rejectSlip/pendingSlips ตามหากลุ่มเจอ)
 */
export class WaterSlipGroup1700000062000 implements MigrationInterface {
  name = 'WaterSlipGroup1700000062000';
  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "water_bills_v2" ADD COLUMN IF NOT EXISTS "slip_group_bill_ids" jsonb`);
  }
  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "water_bills_v2" DROP COLUMN IF EXISTS "slip_group_bill_ids"`);
  }
}
