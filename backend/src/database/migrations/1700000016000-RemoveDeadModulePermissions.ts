import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เก็บกวาด dead code: ลบสิทธิ์ของโมดูลที่ถอดออกจากระบบแล้ว
 * (approvals/complaints/reports — ยุบเข้าสารบรรณตั้งแต่ Rework 2.x, endpoint ถูกลบแล้ว)
 * role_permissions / user_permissions ลบตามอัตโนมัติ (FK ON DELETE CASCADE)
 * หมายเหตุ: ตารางข้อมูลเดิม (complaints, approval_requests ฯลฯ) คงไว้ ไม่แตะข้อมูล
 */
export class RemoveDeadModulePermissions1700000016000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM permissions WHERE module IN ('approvals', 'complaints', 'reports')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // คืน permission rows (role/user grants ไม่คืน — แจกใหม่ผ่าน seed ได้)
    await queryRunner.query(`
      INSERT INTO permissions (module, action, subject) VALUES
        ('approvals', 'create', 'ApprovalRequest'),
        ('approvals', 'read', 'ApprovalRequest'),
        ('approvals', 'approve', 'ApprovalRequest'),
        ('approvals', 'manage', 'ApprovalRequestType'),
        ('complaints', 'read', 'Complaint'),
        ('complaints', 'update', 'Complaint'),
        ('complaints', 'assign', 'Complaint'),
        ('complaints', 'manage', 'ComplaintCategory'),
        ('reports', 'read', 'all'),
        ('reports', 'export', 'all')
      ON CONFLICT (module, action, subject) DO NOTHING
    `);
  }
}
