import { MigrationInterface, QueryRunner } from 'typeorm';

/** Rework 2.1 — วันครบกำหนดของสารบรรณ (ติดตามงานค้าง/เกินกำหนด) */
export class AddTicketDueDate1700000006000 implements MigrationInterface {
  name = 'AddTicketDueDate1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" ADD COLUMN IF NOT EXISTS "due_date" DATE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "correspondence_tickets" DROP COLUMN IF EXISTS "due_date"`);
  }
}
