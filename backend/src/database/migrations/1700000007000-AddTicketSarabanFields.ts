import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rework 2.x — เพิ่มข้อมูลหนังสือราชการเต็มรูปแบบในสารบรรณ (อิงระบบ BRM Saraban จริง)
 * เพิ่มเฉพาะคอลัมน์ข้อมูล/การจัดเก็บ ไม่กระทบ workflow เดิม
 */
export class AddTicketSarabanFields1700000007000 implements MigrationInterface {
  name = 'AddTicketSarabanFields1700000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "correspondence_tickets"
        ADD COLUMN IF NOT EXISTS "fiscal_year" SMALLINT,
        ADD COLUMN IF NOT EXISTS "received_time" VARCHAR(8),
        ADD COLUMN IF NOT EXISTS "source_org" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "source_province" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "sender_name" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "sender_position" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "sender_phone" VARCHAR(50),
        ADD COLUMN IF NOT EXISTS "sender_email" VARCHAR(150),
        ADD COLUMN IF NOT EXISTS "recipient" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "keywords" VARCHAR(500),
        ADD COLUMN IF NOT EXISTS "doc_category" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "doc_type" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "confidentiality" VARCHAR(20) NOT NULL DEFAULT 'ปกติ',
        ADD COLUMN IF NOT EXISTS "purpose" VARCHAR(50),
        ADD COLUMN IF NOT EXISTS "purpose_other" VARCHAR(255),
        ADD COLUMN IF NOT EXISTS "ref_doc_number" VARCHAR(150),
        ADD COLUMN IF NOT EXISTS "ref_doc_detail" TEXT,
        ADD COLUMN IF NOT EXISTS "enclosures" JSONB,
        ADD COLUMN IF NOT EXISTS "received_by" UUID,
        ADD COLUMN IF NOT EXISTS "received_record_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "receive_note" TEXT
    `);

    // FK ผู้รับเอกสาร -> users (ON DELETE SET NULL กันลบผู้ใช้แล้วพัง)
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'fk_ticket_received_by'
        ) THEN
          ALTER TABLE "correspondence_tickets"
            ADD CONSTRAINT "fk_ticket_received_by"
            FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ticket_confidentiality" ON "correspondence_tickets" ("organization_id", "confidentiality")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ticket_source_org" ON "correspondence_tickets" ("source_org")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ticket_source_org"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_ticket_confidentiality"`);
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" DROP CONSTRAINT IF EXISTS "fk_ticket_received_by"`);
    await queryRunner.query(`
      ALTER TABLE "correspondence_tickets"
        DROP COLUMN IF EXISTS "fiscal_year",
        DROP COLUMN IF EXISTS "received_time",
        DROP COLUMN IF EXISTS "source_org",
        DROP COLUMN IF EXISTS "source_province",
        DROP COLUMN IF EXISTS "sender_name",
        DROP COLUMN IF EXISTS "sender_position",
        DROP COLUMN IF EXISTS "sender_phone",
        DROP COLUMN IF EXISTS "sender_email",
        DROP COLUMN IF EXISTS "recipient",
        DROP COLUMN IF EXISTS "keywords",
        DROP COLUMN IF EXISTS "doc_category",
        DROP COLUMN IF EXISTS "doc_type",
        DROP COLUMN IF EXISTS "confidentiality",
        DROP COLUMN IF EXISTS "purpose",
        DROP COLUMN IF EXISTS "purpose_other",
        DROP COLUMN IF EXISTS "ref_doc_number",
        DROP COLUMN IF EXISTS "ref_doc_detail",
        DROP COLUMN IF EXISTS "enclosures",
        DROP COLUMN IF EXISTS "received_by",
        DROP COLUMN IF EXISTS "received_record_at",
        DROP COLUMN IF EXISTS "receive_note"
    `);
  }
}
