import { MigrationInterface, QueryRunner } from 'typeorm';

/** ลบ setting ที่อ้างถึงโมดูลที่ตัด/ยุบไปแล้ว (Rework 2.x) */
export class CleanupStaleSettings1700000012000 implements MigrationInterface {
  name = 'CleanupStaleSettings1700000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "system_settings" WHERE "key" IN ('complaint.auto_assign_enabled')`);
  }

  public async down(): Promise<void> {
    // ไม่ต้องคืน — เป็น setting ที่ไม่ใช้แล้ว
  }
}
