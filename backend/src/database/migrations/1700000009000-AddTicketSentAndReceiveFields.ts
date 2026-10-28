import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่มฟิลด์ให้ตรงระบบสารบรรณจริง (BRM จ.บุรีรัมย์):
 * - วันที่ส่ง / เวลาส่ง (ต้นทางส่งออนไลน์ แยกจากวันที่เรารับ)
 * - เลขทะเบียนรับ (กรอกตอนรับเอกสาร)
 * (เสนอ/ผู้ปฏิบัติ ตอนรับ ใช้ responsible_user_id เดิม)
 */
export class AddTicketSentAndReceiveFields1700000009000 implements MigrationInterface {
  name = 'AddTicketSentAndReceiveFields1700000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "correspondence_tickets"
        ADD COLUMN IF NOT EXISTS "sent_date" DATE,
        ADD COLUMN IF NOT EXISTS "sent_time" VARCHAR(8),
        ADD COLUMN IF NOT EXISTS "receive_reg_number" VARCHAR(100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "correspondence_tickets"
        DROP COLUMN IF EXISTS "sent_date",
        DROP COLUMN IF EXISTS "sent_time",
        DROP COLUMN IF EXISTS "receive_reg_number"
    `);
  }
}
