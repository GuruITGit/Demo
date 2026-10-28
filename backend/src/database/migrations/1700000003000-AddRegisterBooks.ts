import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rework 3.0 — สมุดทะเบียนแยกเล่ม (Register Books) ตามระเบียบงานสารบรรณ
 * อ้างอิงระบบจริง brmsarabanflow — ดู docs/brm-rework-spec.md
 *
 * เพิ่มฟิลด์ใน correspondence_tickets:
 *   register_book        = เล่มทะเบียน (R_MAIN/S_NORMAL/S_VIAN/S_DIRECTION ...) เลขรันแยกตามเล่ม
 *   direction            = รับ/ส่ง
 *   is_circular          = หนังสือเวียน (ข้อ 2)
 *   circular_recipients  = ผู้รับหนังสือเวียนหลายราย (jsonb)
 *   stamped_pdf_path     = ไฟล์ PDF ที่ประทับตรารับแล้ว (ข้อ 4)
 *
 * เลขรันต่อเล่มต่อปีใช้ document_number_sequences (doc_type='BOOK:<เล่ม>:<กอง>', year=พ.ศ.)
 * ใช้ IF NOT EXISTS → ปลอดภัยกับ production (ต้องรัน migration เองหลัง deploy)
 */
export class AddRegisterBooks1700000003000 implements MigrationInterface {
  name = 'AddRegisterBooks1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "correspondence_tickets"
        ADD COLUMN IF NOT EXISTS "register_book" VARCHAR(30) DEFAULT 'R_MAIN' NOT NULL,
        ADD COLUMN IF NOT EXISTS "direction" VARCHAR(10) DEFAULT 'รับ' NOT NULL,
        ADD COLUMN IF NOT EXISTS "is_circular" BOOLEAN DEFAULT false NOT NULL,
        ADD COLUMN IF NOT EXISTS "circular_recipients" JSONB,
        ADD COLUMN IF NOT EXISTS "stamped_pdf_path" VARCHAR(500)
    `);
    // fiscal_year ถูกเพิ่มเต็มรูปแบบใน migration 1700000007000 (รันทีหลัง) แต่ index ด้านล่างต้องใช้
    // → เพิ่มที่นี่ด้วย IF NOT EXISTS เพื่อให้ DB ใหม่ (รันตามลำดับ) ไม่พังตอนสร้าง index
    await queryRunner.query(`
      ALTER TABLE "correspondence_tickets"
        ADD COLUMN IF NOT EXISTS "fiscal_year" SMALLINT
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ticket_register_book"
        ON "correspondence_tickets" ("organization_id", "register_book", "fiscal_year")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ticket_register_book"`);
    await queryRunner.query(`
      ALTER TABLE "correspondence_tickets"
        DROP COLUMN IF EXISTS "register_book",
        DROP COLUMN IF EXISTS "direction",
        DROP COLUMN IF EXISTS "is_circular",
        DROP COLUMN IF EXISTS "circular_recipients",
        DROP COLUMN IF EXISTS "stamped_pdf_path"
    `);
  }
}
