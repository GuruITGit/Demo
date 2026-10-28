import { ForbiddenException } from '@nestjs/common';

/**
 * Ownership / authorization helper.
 *
 * Business rule (SmartGov):
 *  - ผู้ดูแลระบบ (SUPER_ADMIN / ADMIN) ทำได้ทุกอย่าง
 *  - ผู้สร้างข้อมูล (owner) แก้ไข/ลบรายการของตัวเองได้เสมอ
 *  - ผู้ที่ได้รับสิทธิ์ระดับจัดการ (มี permission `module:action:subject`) แก้ของผู้อื่นได้
 *  - นอกนั้นทำไม่ได้
 *
 * ความเป็นเจ้าของอ้างอิงจากฟิลด์ createdBy เป็นค่าเริ่มต้น แต่บางโมดูลใช้ฟิลด์อื่น
 * (เช่น approvals ใช้ requesterId) — ให้ส่ง object ที่มี createdBy เข้ามา เช่น
 * `assertCanModify({ createdBy: req.requesterId }, user, 'approvals:create:ApprovalRequest')`
 */

export interface OwnerCheckUser {
  id: string;
  roles?: string[];
  permissions?: string[];
}

export interface OwnedRecord {
  createdBy?: string | null;
}

/** เป็นผู้ดูแลระบบหรือไม่ (ทำได้ทุกอย่าง) */
export function isAdmin(user?: OwnerCheckUser | null): boolean {
  return !!user?.roles?.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN');
}

/** เป็นเจ้าของรายการหรือไม่ */
export function isOwner(record: OwnedRecord | null | undefined, user?: OwnerCheckUser | null): boolean {
  return !!(user?.id && record?.createdBy && record.createdBy === user.id);
}

/**
 * มีสิทธิ์แก้ไข/ลบรายการนี้หรือไม่
 * = admin OR owner OR ถือ permission ที่กำหนด (ถ้าระบุ)
 */
export function canModify(
  record: OwnedRecord | null | undefined,
  user: OwnerCheckUser | null | undefined,
  requiredPermission?: string,
): boolean {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isOwner(record, user)) return true;
  if (requiredPermission && user.permissions?.includes(requiredPermission)) return true;
  return false;
}

/** โยน ForbiddenException ถ้าไม่มีสิทธิ์แก้ไข/ลบ */
export function assertCanModify(
  record: OwnedRecord | null | undefined,
  user: OwnerCheckUser | null | undefined,
  requiredPermission?: string,
): void {
  if (!canModify(record, user, requiredPermission)) {
    throw new ForbiddenException(
      'คุณไม่มีสิทธิ์แก้ไขหรือลบรายการนี้ (เฉพาะผู้สร้างรายการหรือผู้ดูแลระบบ)',
    );
  }
}
