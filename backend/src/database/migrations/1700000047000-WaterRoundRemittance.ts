import { MigrationInterface, QueryRunner } from 'typeorm';

/** รอบบิลปัจจุบัน (water_rate) + ตารางรอบส่งเงิน (water_remittance) — idempotent */
export class WaterRoundRemittance1700000047000 implements MigrationInterface {
  name = 'WaterRoundRemittance1700000047000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE water_rate
      ADD COLUMN IF NOT EXISTS current_period_year int,
      ADD COLUMN IF NOT EXISTS current_period_month int`);
    await q.query(`
      CREATE TABLE IF NOT EXISTS water_remittance (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        remit_date date NOT NULL,
        bill_count int NOT NULL DEFAULT 0,
        total_amount numeric(12,2) NOT NULL DEFAULT 0,
        note text,
        closed_by uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_water_remit_org_date" ON water_remittance (organization_id, remit_date)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS water_remittance`);
    await q.query(`ALTER TABLE water_rate DROP COLUMN IF EXISTS current_period_year, DROP COLUMN IF EXISTS current_period_month`);
  }
}
