import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เติม organization_id ให้ประวัติกิจกรรมเก่าที่บันทึกไว้เป็น null
 *
 * ticket.service / correspondence.service / documents(download) บันทึก audit โดยไม่ใส่ organizationId
 * แต่ audit.service.findAll กรอง `organization_id = :orgId`
 * → กิจกรรมของสารบรรณทั้งหมด (สร้าง/เซ็น/อนุมัติ/ตีกลับ/ลบ/รับเอกสาร) ไม่เคยโผล่ในหน้าประวัติกิจกรรมเลย
 *
 * โค้ดฝั่ง service แก้ให้ใส่ organizationId แล้ว — migration นี้กู้ข้อมูลเก่าจากองค์กรของผู้ใช้
 */
export class BackfillAuditOrganization1700000021000 implements MigrationInterface {
  name = 'BackfillAuditOrganization1700000021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "audit_logs" a
         SET "organization_id" = u."organization_id"
        FROM "users" u
       WHERE a."user_id" = u."id"
         AND a."organization_id" IS NULL
         AND u."organization_id" IS NOT NULL
    `);
  }

  public async down(): Promise<void> {
    // ไม่ย้อนกลับ — การเติมข้อมูลที่ขาดไม่ใช่การเปลี่ยนโครงสร้าง และย้อนแล้วข้อมูลหายจากหน้าจออีก
  }
}
