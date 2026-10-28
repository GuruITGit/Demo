import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * แก้บั๊กเลขทะเบียนชนกันข้ามสมุด (register book)
 *
 * เดิม unique = (organization_id, ticket_number) → เล่มแบบ dept ที่ไม่มี bookCode
 * (รับทั่วไป/รับความลับ/รับบันทึก/ร้องทุกข์/ส่งทั่วไป/ส่งความลับ/ส่งบันทึก) ออกเลขรูปแบบ
 * เดียวกัน "กค 00001/2569" แต่คนละ sequence → เลขซ้ำ → insert ล้มเหลว (500)
 *
 * แก้เป็น unique "ต่อสมุด" = (organization_id, register_book, ticket_number)
 * ตามระเบียบงานสารบรรณ แต่ละสมุดมีเลขรันอิสระ เลขซ้ำข้ามสมุดเป็นปกติ
 *
 * ใช้ IF EXISTS → ปลอดภัยกับ production
 */
export class FixTicketNumberUniquePerBook1700000004000 implements MigrationInterface {
  name = 'FixTicketNumberUniquePerBook1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" DROP CONSTRAINT IF EXISTS "uq_ticket_org_number"`);
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" DROP CONSTRAINT IF EXISTS "uq_ticket_org_book_number"`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_ticket_org_number'
        ) THEN
          ALTER TABLE "correspondence_tickets"
            ADD CONSTRAINT "uq_ticket_org_number"
            UNIQUE ("organization_id", "ticket_number");
        END IF;
      END $$;
    `);
  }
}
