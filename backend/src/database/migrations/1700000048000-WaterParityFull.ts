import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Parity เต็มกับระบบเก่า (25/08/2569) — idempotent, ADD COLUMN IF NOT EXISTS
 * - water_bills_v2: discount_amount (ส่วนลดต่อบิล), ack_signature_url (ลายเซ็นรับทราบ)
 * - water_rate: bill_expiry_days (ใบเสร็จหมดอายุ/วัน = 30), invoice_header/footer (ใบแจ้งหนี้แยกจากใบเสร็จ),
 *               report_signature_url / warning_signature_url (รูปลายเซ็นรายงาน/ใบเตือน)
 */
export class WaterParityFull1700000048000 implements MigrationInterface {
  name = 'WaterParityFull1700000048000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_bills_v2
      ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ack_signature_url text`);
    await q.query(`ALTER TABLE water_rate
      ADD COLUMN IF NOT EXISTS bill_expiry_days int NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS invoice_header text,
      ADD COLUMN IF NOT EXISTS invoice_footer text,
      ADD COLUMN IF NOT EXISTS report_signature_url text,
      ADD COLUMN IF NOT EXISTS warning_signature_url text`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_bills_v2 DROP COLUMN IF EXISTS discount_amount, DROP COLUMN IF EXISTS ack_signature_url`);
    await q.query(`ALTER TABLE water_rate
      DROP COLUMN IF EXISTS bill_expiry_days, DROP COLUMN IF EXISTS invoice_header, DROP COLUMN IF EXISTS invoice_footer,
      DROP COLUMN IF EXISTS report_signature_url, DROP COLUMN IF EXISTS warning_signature_url`);
  }
}
