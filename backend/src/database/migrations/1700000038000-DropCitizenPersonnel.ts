import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ถอนฟีเจอร์ "ทำเนียบบุคลากร" (Phase 4) — ลบตาราง citizen_personnel
 * (create อยู่ที่ 1700000037000) ยกเลิกฟีเจอร์ก่อน deploy จริง จึงลบตารางทิ้ง
 * กันพัง: DROP TABLE IF EXISTS (idempotent — ปลอดภัยไม่ว่าตารางเคยถูกสร้างหรือไม่)
 */
export class DropCitizenPersonnel1700000038000 implements MigrationInterface {
  name = 'DropCitizenPersonnel1700000038000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "citizen_personnel"`);
  }

  public async down(): Promise<void> {
    // ไม่ต้องสร้างคืน — ฟีเจอร์ถูกยกเลิก
  }
}
