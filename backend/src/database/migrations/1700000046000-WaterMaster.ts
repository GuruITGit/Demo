import { MigrationInterface, QueryRunner } from 'typeorm';

/** ตารางข้อมูลพื้นฐาน (master) กองการประปา — ตัวเดียวครอบทุกประเภท · idempotent */
export class WaterMaster1700000046000 implements MigrationInterface {
  name = 'WaterMaster1700000046000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS water_master (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        type varchar(20) NOT NULL,
        code varchar(20),
        name varchar(200) NOT NULL,
        value numeric(12,2),
        config jsonb,
        sort_order int NOT NULL DEFAULT 0,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_water_master_org_type" ON water_master (organization_id, type)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS water_master`);
  }
}
