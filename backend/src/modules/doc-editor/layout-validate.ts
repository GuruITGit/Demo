import { BadRequestException } from '@nestjs/common';

/**
 * ตรวจ/อ่าน layout v2 ของตัวแต่งเอกสาร — แยกไฟล์ไว้ไม่ให้ ticket.service ต้อง import service ของ doc-editor (กัน import วน)
 */
const MAX_LAYOUT_BYTES = 900 * 1024;

/** ตรวจโครง layout v2 ก่อนบันทึก (กันข้อมูลเสีย/ใหญ่เกิน) */
export function assertLayout(layout: any) {
  if (!layout || layout.version !== 2 || !Array.isArray(layout.pages) || !Array.isArray(layout.items)) {
    throw new BadRequestException('รูปแบบเอกสารไม่ถูกต้อง');
  }
  if (!layout.pages.length || layout.pages.length > 60) throw new BadRequestException('จำนวนหน้าต้องอยู่ระหว่าง 1–60 หน้า');
  if (layout.items.length > 500) throw new BadRequestException('ชิ้นส่วนในเอกสารมากเกินไป');
  if (Buffer.byteLength(JSON.stringify(layout)) > MAX_LAYOUT_BYTES) {
    throw new BadRequestException('เอกสารใหญ่เกินไป (รูปภาพในเอกสารอาจใหญ่เกิน) — ลองลดจำนวน/ขนาดรูป');
  }
}

/** ชิ้นลายเซ็นในเอกสาร (ที่มีเจ้าของ) */
export function signatureItems(layout: any): { id: string; ownerId: string }[] {
  const items = Array.isArray(layout?.items) ? layout.items : [];
  return items
    .filter((it: any) => it?.type === 'signature' && it.props?.ownerId)
    .map((it: any) => ({ id: String(it.id), ownerId: String(it.props.ownerId) }));
}

/** ผู้ใช้คนนี้วางลายเซ็นของตัวเองไว้ในเอกสารแล้วหรือยัง */
export const hasSignatureBy = (layout: any, userId: string) => signatureItems(layout).some((s) => s.ownerId === userId);
