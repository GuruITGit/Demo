import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เลขทะเบียนรับต้องไม่ซ้ำ "ต่อสมุด ต่อปีงบ" (ไม่ใช่ต่อสมุดตลอดกาล)
 *
 * เดิม unique = (organization_id, register_book, ticket_number)
 * → ขึ้นปีงบใหม่ กรอกเลข 1 ไม่ได้ เพราะชนกับเลข 1 ของปีก่อน
 *   ทั้งที่ระบบ (suggestNextReceiveNumber) แนะนำเลข 1 ให้เอง — แนะนำเลขที่บันทึกไม่ได้
 * → เรื่องที่ถูกลบ (soft delete) ยังกินเลขค้างไว้ตลอดไป
 *
 * แก้เป็น partial unique index = (organization_id, register_book, fiscal_year, ticket_number)
 * เฉพาะแถวที่ยังไม่ถูกลบ (deleted_at IS NULL) — ใช้ index แทน constraint เพราะ constraint ทำ partial ไม่ได้
 * ใช้ COALESCE(fiscal_year, 0) กันข้อมูลเก่าที่ fiscal_year เป็น null (null ไม่ชนกันเองใน Postgres)
 *
 * ข้อจำกัดหลวมลงกว่าเดิม → ไม่มีทางที่ข้อมูลเดิมจะชนกัน migration จึงปลอดภัยกับ production
 */
export class TicketNumberUniquePerFiscalYear1700000020000 implements MigrationInterface {
  name = 'TicketNumberUniquePerFiscalYear1700000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" DROP CONSTRAINT IF EXISTS "uq_ticket_org_book_number"`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_ticket_org_book_year_number"
        ON "correspondence_tickets" ("organization_id", "register_book", (COALESCE("fiscal_year", 0)), "ticket_number")
        WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_ticket_org_book_year_number"`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_ticket_org_book_number'
        ) THEN
          ALTER TABLE "correspondence_tickets"
            ADD CONSTRAINT "uq_ticket_org_book_number"
            UNIQUE ("organization_id", "register_book", "ticket_number");
        END IF;
      END $$;
    `);
  }
}
