import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เปลี่ยนชื่อสถานะ "ส่งกลับแก้ไข" → "ตีกลับ" ทั้งระบบ (rework v20000)
 * คอลัมน์ status เป็น varchar(50) → อัปเดตค่าข้อมูลเดิมให้ตรงกับ enum ใหม่
 */
export class RenameReturnedStatus1700000019000 implements MigrationInterface {
  name = 'RenameReturnedStatus1700000019000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "correspondence_tickets" SET "status" = 'ตีกลับ' WHERE "status" = 'ส่งกลับแก้ไข'`);
    await queryRunner.query(`UPDATE "correspondence_ticket_departments" SET "status" = 'ตีกลับ' WHERE "status" = 'ส่งกลับแก้ไข'`);
    // ไทม์ไลน์ (เพื่อให้ badge/ข้อความประวัติแสดงตรงกัน)
    await queryRunner.query(`UPDATE "document_workflow_logs" SET "to_status" = 'ตีกลับ' WHERE "to_status" = 'ส่งกลับแก้ไข'`);
    await queryRunner.query(`UPDATE "document_workflow_logs" SET "from_status" = 'ตีกลับ' WHERE "from_status" = 'ส่งกลับแก้ไข'`);
    await queryRunner.query(`UPDATE "document_workflow_logs" SET "action" = 'ตีกลับ' WHERE "action" = 'ส่งกลับแก้ไข'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "correspondence_tickets" SET "status" = 'ส่งกลับแก้ไข' WHERE "status" = 'ตีกลับ'`);
    await queryRunner.query(`UPDATE "correspondence_ticket_departments" SET "status" = 'ส่งกลับแก้ไข' WHERE "status" = 'ตีกลับ'`);
    await queryRunner.query(`UPDATE "document_workflow_logs" SET "to_status" = 'ส่งกลับแก้ไข' WHERE "to_status" = 'ตีกลับ'`);
    await queryRunner.query(`UPDATE "document_workflow_logs" SET "from_status" = 'ส่งกลับแก้ไข' WHERE "from_status" = 'ตีกลับ'`);
    await queryRunner.query(`UPDATE "document_workflow_logs" SET "action" = 'ส่งกลับแก้ไข' WHERE "action" = 'ตีกลับ'`);
  }
}
