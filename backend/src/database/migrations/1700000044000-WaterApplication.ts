import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ตารางแบบคำขอใช้น้ำ/สัญญา (water_applications) — 1 ชุดต่อผู้ใช้น้ำ
 * idempotent (CREATE TABLE IF NOT EXISTS) เผื่อสภาพ prod ค้าง
 */
export class WaterApplication1700000044000 implements MigrationInterface {
  name = 'WaterApplication1700000044000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS water_applications (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        customer_id uuid NOT NULL REFERENCES water_customers(id) ON DELETE CASCADE,
        age int,
        id_expiry date,
        occupation varchar(120),
        workplace varchar(200),
        purpose varchar(120),
        operate_at varchar(255),
        nearby varchar(255),
        pipe_size varchar(20),
        faucet_size varchar(20),
        faucet_count int,
        deposit_amount numeric(10,2),
        receiver varchar(200),
        apply_date date,
        done boolean NOT NULL DEFAULT false,
        contract_signer varchar(200),
        witness1 varchar(200),
        witness2 varchar(200),
        created_by uuid,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_water_app_org_customer" ON water_applications (organization_id, customer_id)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS water_applications`);
  }
}
