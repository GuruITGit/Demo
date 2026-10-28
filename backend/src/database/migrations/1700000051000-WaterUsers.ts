import { MigrationInterface, QueryRunner } from 'typeorm';

/** บัญชีผู้ใช้ระบบประปา (แยกจาก users สารบรรณ) — idempotent */
export class WaterUsers1700000051000 implements MigrationInterface {
  name = 'WaterUsers1700000051000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS water_users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        username varchar(60) NOT NULL,
        password_hash text NOT NULL,
        full_name varchar(200) NOT NULL,
        phone varchar(30),
        role varchar(12) NOT NULL DEFAULT 'reader',
        caps jsonb NOT NULL DEFAULT '[]',
        active boolean NOT NULL DEFAULT true,
        last_login_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_water_users_org_username" ON water_users (organization_id, username)`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS water_users`);
  }
}
