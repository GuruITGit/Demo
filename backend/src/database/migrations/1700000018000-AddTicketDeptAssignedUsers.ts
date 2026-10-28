import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่ม correspondence_ticket_departments.assigned_user_ids (jsonb)
 * — รองรับมอบหมาย "หลายคนต่อกอง" (tree view) โดยคง assigned_user_id (คนแรก) ไว้เพื่อ compat
 */
export class AddTicketDeptAssignedUsers1700000018000 implements MigrationInterface {
  name = 'AddTicketDeptAssignedUsers1700000018000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_ticket_departments" ADD COLUMN IF NOT EXISTS "assigned_user_ids" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_ticket_departments" DROP COLUMN IF EXISTS "assigned_user_ids"`);
  }
}
