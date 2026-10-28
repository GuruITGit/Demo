import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * username/email ของ users: เปลี่ยนจาก unique "ทั้งระบบ" → unique "ต่อหน่วยงาน" (multi-tenant)
 * แต่ละ อบต. ตั้งชื่อผู้ใช้ของตัวเองได้ (เช่น "admin" ซ้ำข้าม อบต. ได้)
 *
 * prod: ชื่อ constraint เดิมเป็น auto-gen (UQ_xx…) → หา+ลบแบบไดนามิกจาก catalog
 * ข้อมูลเดิมผ่าน composite แน่นอน (global-unique ⊃ per-org-unique) · idempotent
 */
export class UsersUniquePerOrg1700000056000 implements MigrationInterface {
  name = 'UsersUniquePerOrg1700000056000';

  public async up(q: QueryRunner): Promise<void> {
    // 1) ลบ unique constraint เดิมที่ครอบ "คอลัมน์เดียว" (username หรือ email)
    await q.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT c.conname,
                 (SELECT array_agg(a.attname::text ORDER BY a.attnum)
                    FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k) AS cols
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
           WHERE t.relname = 'users' AND c.contype = 'u'
        LOOP
          IF r.cols = ARRAY['username'] OR r.cols = ARRAY['email'] THEN
            EXECUTE 'ALTER TABLE users DROP CONSTRAINT ' || quote_ident(r.conname);
          END IF;
        END LOOP;
      END $$;
    `);
    // เผื่อเป็น unique index (ไม่ใช่ constraint) ที่ครอบคอลัมน์เดียว
    await q.query(`
      DO $$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT i.relname AS idxname, array_agg(a.attname::text ORDER BY x.n) AS cols
            FROM pg_index ix
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN unnest(ix.indkey) WITH ORDINALITY AS x(attnum, n) ON true
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
           WHERE t.relname = 'users' AND ix.indisunique AND NOT ix.indisprimary
           GROUP BY i.relname
        LOOP
          IF r.cols = ARRAY['username'] OR r.cols = ARRAY['email'] THEN
            EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(r.idxname);
          END IF;
        END LOOP;
      END $$;
    `);
    // 2) เพิ่ม composite unique (organization_id, username) และ (organization_id, email)
    await q.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_users_org_username') THEN
          ALTER TABLE users ADD CONSTRAINT "UQ_users_org_username" UNIQUE (organization_id, username);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_users_org_email') THEN
          ALTER TABLE users ADD CONSTRAINT "UQ_users_org_email" UNIQUE (organization_id, email);
        END IF;
      END $$;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "UQ_users_org_username"`);
    await q.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS "UQ_users_org_email"`);
    // (ไม่คืน global-unique อัตโนมัติ — ถ้าจะย้อนต้องมั่นใจว่าไม่มีชื่อซ้ำข้าม อบต.)
  }
}
