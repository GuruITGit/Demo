import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * โดเมนต่อหน่วยงาน (organizations.hostnames text[]) — เปิดโดเมนไหน = รู้ว่า อบต. ไหน (multi-tenant)
 * backfill ลำนางรอง = sao-lamnangrong.com (โดเมน prod ปัจจุบัน) เฉพาะแถวที่ยังว่าง · idempotent
 */
export class OrgHostnames1700000057000 implements MigrationInterface {
  name = 'OrgHostnames1700000057000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS hostnames text[]`);
    // index ช่วยค้น host → org เร็ว (GIN บน array)
    await q.query(`CREATE INDEX IF NOT EXISTS "IDX_org_hostnames" ON organizations USING gin (hostnames)`);
    await q.query(`
      UPDATE organizations
         SET hostnames = ARRAY['sao-lamnangrong.com']
       WHERE name_th LIKE '%ลำนางรอง%' AND (hostnames IS NULL OR cardinality(hostnames) = 0)
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "IDX_org_hostnames"`);
    await q.query(`ALTER TABLE organizations DROP COLUMN IF EXISTS hostnames`);
  }
}
