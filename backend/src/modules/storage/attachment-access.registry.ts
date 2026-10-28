import { Injectable } from '@nestjs/common';

/** ตรวจว่าผู้ใช้มีสิทธิ์เห็นไฟล์แนบของรายการ (ref) นี้หรือไม่ — คืน true = เห็นได้ */
export type RefAccessChecker = (refId: string, user: any) => Promise<boolean> | boolean;

/**
 * ทะเบียนตัวตรวจสิทธิ์การเข้าถึงไฟล์แนบราย refType
 *
 * StorageModule เปิด registry นี้ให้โมดูลเจ้าของข้อมูล (สารบรรณ/คลังเอกสาร ...) ลงทะเบียน
 * ตัวตรวจสิทธิ์ของตัวเอง (ผ่าน OnModuleInit) — เพื่อไม่ให้ StorageService ต้องรู้ business logic
 * ของทุกโมดูล และเลี่ยง circular dependency (dependency ไหลทางเดียว: โมดูล → Storage)
 *
 * refType ที่ไม่มี checker → อนุญาต (ยังถูกจำกัดด้วย org ของผู้อัปโหลดใน getFilesByRef)
 */
@Injectable()
export class AttachmentAccessRegistry {
  private readonly checkers = new Map<string, RefAccessChecker>();

  register(refType: string, checker: RefAccessChecker): void {
    this.checkers.set(refType, checker);
  }

  async canAccess(refType: string, refId: string, user: any): Promise<boolean> {
    const checker = this.checkers.get(refType);
    if (!checker) return true;
    return checker(refId, user);
  }
}
