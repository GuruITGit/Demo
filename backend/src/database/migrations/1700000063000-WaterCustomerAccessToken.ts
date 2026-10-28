import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่ม water_customers.access_token — รหัสสุ่ม 6 หลัก (ตัวเลข+ตัวอักษร ตัดตัวที่กำกวม 0/O/1/I ออก)
 * ต่อผู้ใช้น้ำ 1 ราย ใช้พิมพ์/ทำ QR บนใบแจ้งหนี้ ให้สแกน/กรอกแล้วเข้าหน้าเช็ค-จ่ายค่าน้ำได้ทันที
 * โดยไม่ต้องกรอกชื่อ+บ้านเลขที่ (ปัจจัยที่ 4 ของ assertOwner เดิม ดู water-billing.service.ts)
 *
 * backfill ลูกค้าเดิมทุกรายด้วย DO block (กันชนด้วยการเช็คซ้ำก่อน insert ทีละแถว — รันซ้ำได้
 * เพราะเงื่อนไข WHERE access_token IS NULL เอง) แล้วค่อยตั้ง unique index ทีหลัง
 */
export class WaterCustomerAccessToken1700000063000 implements MigrationInterface {
  name = 'WaterCustomerAccessToken1700000063000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "water_customers" ADD COLUMN IF NOT EXISTS "access_token" varchar(10)`);

    await q.query(`
      DO $$
      DECLARE
        r RECORD;
        candidate text;
        chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        i int;
      BEGIN
        FOR r IN SELECT id, organization_id FROM water_customers WHERE access_token IS NULL LOOP
          LOOP
            candidate := '';
            FOR i IN 1..6 LOOP
              candidate := candidate || substr(chars, floor(random() * length(chars) + 1)::int, 1);
            END LOOP;
            EXIT WHEN NOT EXISTS (
              SELECT 1 FROM water_customers
               WHERE organization_id = r.organization_id AND access_token = candidate AND deleted_at IS NULL
            );
          END LOOP;
          UPDATE water_customers SET access_token = candidate WHERE id = r.id;
        END LOOP;
      END $$;
    `);

    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_water_customers_org_access_token"
        ON "water_customers" ("organization_id", "access_token")
        WHERE "deleted_at" IS NULL
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS "UQ_water_customers_org_access_token"`);
    await q.query(`ALTER TABLE "water_customers" DROP COLUMN IF EXISTS "access_token"`);
  }
}
