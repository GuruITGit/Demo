import { DataSource } from 'typeorm';
import { NotificationsService } from '../modules/notifications/notifications.service';

export interface PermissionRef { module: string; action: string; subject: string }
export interface StaffNotice { type: string; title: string; body: string; actionUrl?: string; refType?: string; refId?: string }

/**
 * แจ้งเตือนเจ้าหน้าที่ทุกคนในหน่วยงานที่มีสิทธิ์นั้น (ผ่านบทบาท สิทธิ์รายบุคคล หรือเป็นผู้ดูแลระบบ)
 * ใช้ตอนประชาชนทำรายการที่ต้องมีคนตรวจ เช่น จองแผง แจ้งชำระ ส่งเรื่องร้องเรียน
 */
export async function notifyUsersWithPermission(ds: DataSource, notifications: NotificationsService, orgId: string, perm: PermissionRef, notice: StaffNotice) {
  const rows: { id: string }[] = await ds.query(
    `SELECT DISTINCT u.id FROM users u
      WHERE u.organization_id = $1 AND (
        EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.name IN ('ADMIN', 'SUPER_ADMIN'))
        OR EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id
                 WHERE ur.user_id = u.id AND p.module = $2 AND p.action = $3 AND p.subject = $4)
        OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id
                 WHERE up.user_id = u.id AND p.module = $2 AND p.action = $3 AND p.subject = $4))`,
    [orgId, perm.module, perm.action, perm.subject],
  );
  for (const r of rows) {
    await notifications.createNotification({ organizationId: orgId, recipientId: r.id, ...notice }).catch(() => undefined);
  }
  return rows.length;
}
