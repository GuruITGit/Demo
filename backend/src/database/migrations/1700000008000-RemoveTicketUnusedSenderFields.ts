import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ลบฟิลด์สารบรรณที่ไม่ได้ใช้งานออกตามฟีดแบ็กลูกค้า:
 * จังหวัด (source_province), เบอร์โทรศัพท์ผู้ส่ง (sender_phone), อีเมลผู้ส่ง (sender_email)
 */
export class RemoveTicketUnusedSenderFields1700000008000 implements MigrationInterface {
  name = 'RemoveTicketUnusedSenderFields1700000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "correspondence_tickets"
        DROP COLUMN IF EXISTS "source_province",
        DROP COLUMN IF EXISTS "sender_phone",
        DROP COLUMN IF EXISTS "sender_email"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "correspondence_tickets"
        ADD COLUMN IF NOT EXISTS "source_province" VARCHAR(100),
        ADD COLUMN IF NOT EXISTS "sender_phone" VARCHAR(50),
        ADD COLUMN IF NOT EXISTS "sender_email" VARCHAR(150)
    `);
  }
}
