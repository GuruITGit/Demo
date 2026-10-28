import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * เพิ่มสิทธิ์ "ดูรายงานสรุปประจำเดือน" (correspondence:summary:Ticket)
 * และแจกให้บทบาทผู้บริหาร/หัวหน้าโดยอัตโนมัติ (ADMIN, MAYOR, CLERK, DEPT_HEAD)
 * — รันบน prod อัตโนมัติตอน deploy จึงไม่ต้อง reseed
 */
export class AddTicketSummaryPermission1700000015000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO permissions (module, action, subject, description)
      VALUES ('correspondence', 'summary', 'Ticket', 'ดูรายงานสรุปสารบรรณประจำเดือน/ปี')
      ON CONFLICT (module, action, subject) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      CROSS JOIN permissions p
      WHERE r.name IN ('ADMIN', 'MAYOR', 'CLERK', 'DEPT_HEAD')
        AND p.module = 'correspondence' AND p.action = 'summary' AND p.subject = 'Ticket'
      ON CONFLICT (role_id, permission_id) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM role_permissions rp USING permissions p
      WHERE rp.permission_id = p.id
        AND p.module = 'correspondence' AND p.action = 'summary' AND p.subject = 'Ticket'
    `);
    await queryRunner.query(`
      DELETE FROM user_permissions up USING permissions p
      WHERE up.permission_id = p.id
        AND p.module = 'correspondence' AND p.action = 'summary' AND p.subject = 'Ticket'
    `);
    await queryRunner.query(`
      DELETE FROM permissions
      WHERE module = 'correspondence' AND action = 'summary' AND subject = 'Ticket'
    `);
  }
}
