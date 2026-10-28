import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ทำเครื่องหมายว่า admin เปิด "แก้ไขเอกสาร" (หน้า /citizen-reports/:id/petition) ตรวจ/ยืนยันข้อมูล
 * คำร้องทั่วไปแล้วอย่างน้อย 1 ครั้ง — ใช้โชว์ติ๊กถูก "เอกสารตรวจสอบแล้ว" แทนปุ่มกรอก/แก้ไขปุ่มเดียว
 */
export class CitizenReportPetitionChecked1700000067000 implements MigrationInterface {
  name = 'CitizenReportPetitionChecked1700000067000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" ADD COLUMN IF NOT EXISTS "petition_checked_at" TIMESTAMPTZ`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "citizen_reports" DROP COLUMN IF EXISTS "petition_checked_at"`);
  }
}
