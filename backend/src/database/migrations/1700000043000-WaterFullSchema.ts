import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ขยาย schema ประปาให้ครบตามระบบเก่า (Prapa On Mobile) — เตรียม migrate ข้อมูลจริง 2,739 ราย + 32,725 บิล
 * เพิ่มฟิลด์ผู้ใช้น้ำ/บิลครบ + เรตแบบก้าวหน้า (tiered) + คอลัมน์ legacy(jsonb) เก็บ record ดิบเดิมไว้ทั้งก้อน
 * (กัน mapping ผิด — refine ทีหลังได้โดยไม่ต้อง import ใหม่) · idempotent (ADD COLUMN IF NOT EXISTS)
 */
export class WaterFullSchema1700000043000 implements MigrationInterface {
  name = 'WaterFullSchema1700000043000';

  public async up(q: QueryRunner): Promise<void> {
    // ── ผู้ใช้น้ำ ──
    await q.query(`ALTER TABLE water_customers
      ADD COLUMN IF NOT EXISTS national_id varchar(20),
      ADD COLUMN IF NOT EXISTS soi varchar(100),
      ADD COLUMN IF NOT EXISTS road varchar(100),
      ADD COLUMN IF NOT EXISTS meter_last_reading int,
      ADD COLUMN IF NOT EXISTS meter_size_code varchar(10),
      ADD COLUMN IF NOT EXISTS meter_digits int,
      ADD COLUMN IF NOT EXISTS meter_serial varchar(60),
      ADD COLUMN IF NOT EXISTS fee_rate numeric(10,2),
      ADD COLUMN IF NOT EXISTS rate_type varchar(20),
      ADD COLUMN IF NOT EXISTS collection_route varchar(20),
      ADD COLUMN IF NOT EXISTS apply_date date,
      ADD COLUMN IF NOT EXISTS garbage_fee numeric(10,2),
      ADD COLUMN IF NOT EXISTS wastewater_fee numeric(10,2),
      ADD COLUMN IF NOT EXISTS pay_method varchar(20),
      ADD COLUMN IF NOT EXISTS bank_account varchar(40),
      ADD COLUMN IF NOT EXISTS bank_name varchar(120),
      ADD COLUMN IF NOT EXISTS bank_branch varchar(120),
      ADD COLUMN IF NOT EXISTS discount_type varchar(20),
      ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2),
      ADD COLUMN IF NOT EXISTS want_vat boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS usage_status varchar(20),
      ADD COLUMN IF NOT EXISTS gps varchar(60),
      ADD COLUMN IF NOT EXISTS issues jsonb,
      ADD COLUMN IF NOT EXISTS cutoff_date date,
      ADD COLUMN IF NOT EXISTS legacy jsonb`);

    // ── บิล/จดมิเตอร์ ──
    await q.query(`ALTER TABLE water_bills_v2
      ADD COLUMN IF NOT EXISTS period_round varchar(10),
      ADD COLUMN IF NOT EXISTS bill_no varchar(40),
      ADD COLUMN IF NOT EXISTS reader_name varchar(200),
      ADD COLUMN IF NOT EXISTS prev_read_at timestamptz,
      ADD COLUMN IF NOT EXISTS curr_read_at timestamptz,
      ADD COLUMN IF NOT EXISTS wastewater_fee numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS garbage_fee numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS gps varchar(60),
      ADD COLUMN IF NOT EXISTS legacy jsonb`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_water_bills_v2_round ON water_bills_v2 (organization_id, period_round)`);

    // ── เรต (รองรับก้าวหน้า tiered) ──
    await q.query(`ALTER TABLE water_rate
      ADD COLUMN IF NOT EXISTS rate_mode varchar(12) NOT NULL DEFAULT 'flat',
      ADD COLUMN IF NOT EXISTS tiers jsonb,
      ADD COLUMN IF NOT EXISTS min_units int NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS min_charge numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS garbage_fee numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS wastewater_fee numeric(10,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS tax_rate numeric(6,3) NOT NULL DEFAULT 0`);
  }

  public async down(q: QueryRunner): Promise<void> {
    const cCols = ['national_id','soi','road','meter_last_reading','meter_size_code','meter_digits','meter_serial','fee_rate','rate_type','collection_route','apply_date','garbage_fee','wastewater_fee','pay_method','bank_account','bank_name','bank_branch','discount_type','discount_amount','want_vat','usage_status','gps','issues','cutoff_date','legacy'];
    for (const c of cCols) await q.query(`ALTER TABLE water_customers DROP COLUMN IF EXISTS ${c}`);
    const bCols = ['period_round','bill_no','reader_name','prev_read_at','curr_read_at','wastewater_fee','tax','garbage_fee','gps','legacy'];
    for (const c of bCols) await q.query(`ALTER TABLE water_bills_v2 DROP COLUMN IF EXISTS ${c}`);
    const rCols = ['rate_mode','tiers','min_units','min_charge','garbage_fee','wastewater_fee','tax_rate'];
    for (const c of rCols) await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS ${c}`);
  }
}
