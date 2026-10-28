import { IsOptional, IsString, IsUUID, IsObject, IsBoolean, IsIn, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** รายละเอียดยาวสุด 2,000 ตัวอักษร — ฟอร์ม multipart แปลงขึ้นบรรทัดใหม่เป็น CRLF (นับ 2 ตัว) จึง normalize เป็น LF ก่อนนับ */
export const DETAIL_MAX = 2000;
const normalizeNewlines = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\r\n?/g, '\n') : value);

export class CreateReportDto {
  @IsString() @MaxLength(60)
  category: string;

  @Transform(normalizeNewlines)
  @IsString() @MinLength(5, { message: 'กรุณากรอกรายละเอียดอย่างน้อย 5 ตัวอักษร' }) @MaxLength(DETAIL_MAX, { message: 'รายละเอียดยาวเกิน 2,000 ตัวอักษร' })
  detail: string;

  @IsOptional() @IsString() @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(150)
  reporterName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  reporterPhone?: string;

  @IsOptional() @IsString() @MaxLength(500)
  location?: string;

  // มาจาก multipart/form-data เสมอเป็นสตริง — แปลงเป็นตัวเลขฝั่ง service
  @IsOptional() @IsString()
  villageNo?: string;

  @IsOptional() @IsString()
  geoLat?: string;

  @IsOptional() @IsString()
  geoLng?: string;

  @IsOptional() @IsString()
  org?: string;

  // ─── คำร้องทั่วไป (เรื่องทั่วไป) — ลูกบ้านกรอกเองตั้งแต่หน้าแจ้งเรื่องเลย ───
  @IsOptional() @IsString() @MaxLength(500)
  subject?: string;

  @IsOptional() @IsString() @MaxLength(20)
  titlePrefix?: string;

  @IsOptional() @IsString() @MaxLength(200)
  houseNo?: string;
}

export class UpdateReportDto {
  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  staffNote?: string;

  // ─── แก้ไขข้อมูลเอกสารก่อนพิมพ์ (เหมือนสารบรรณที่แก้ subject/body ได้) ───
  @IsOptional() @IsString() @MaxLength(500)
  subject?: string;

  @Transform(normalizeNewlines)
  @IsOptional() @IsString() @MinLength(5, { message: 'กรุณากรอกรายละเอียดอย่างน้อย 5 ตัวอักษร' }) @MaxLength(DETAIL_MAX, { message: 'รายละเอียดยาวเกิน 2,000 ตัวอักษร' })
  detail?: string;

  @IsOptional() @IsString() @MaxLength(150)
  reporterName?: string;

  @IsOptional() @IsString() @MaxLength(30)
  reporterPhone?: string;

  @IsOptional() @IsString() @MaxLength(500)
  location?: string;

  @IsOptional() @IsString()
  villageNo?: string;

  /** ช่องว่างเฉพาะของ "คำร้องทั่วไป" (คำนำหน้า/บ้านเลขที่/ตำบล/อำเภอ/จังหวัด/วันที่เอกสาร) — เก็บใน jsonb เดิม ไม่เพิ่มคอลัมน์ */
  @IsOptional() @IsObject()
  answers?: Record<string, any>;

  /** ส่งมาจากหน้า /citizen-reports/:id/petition เท่านั้น — ทำเครื่องหมายว่า admin ตรวจเอกสารแล้ว */
  @IsOptional() @IsBoolean()
  petitionChecked?: boolean;

}

/** admin กลาง "ส่งไปกองเพื่ออนุมัติ" — เลือกกองเดียว */
export class RouteReportDto {
  @IsUUID()
  targetDeptId: string;
}

/** เซ็น/อนุมัติขั้นที่ถึงตา — แนบรูปลายเซ็นได้ (ไม่บังคับ) ตรวจชนิดเป็น data:image จริงฝั่ง pdf.service */
export class ApproveReportDto {
  // body JSON จำกัด 1MB รวม (main.ts) — เผื่อพื้นที่ field อื่น จำกัดรูปลายเซ็นไว้ที่ ~700KB (base64)
  @IsOptional() @IsString() @MaxLength(700_000, { message: 'ไฟล์รูปลายเซ็นใหญ่เกินไป' })
  signatureImage?: string;
}

export const SIGNATURE_SLOTS = ['deptHead', 'clerk', 'mayor'] as const;
export type SignatureSlot = (typeof SIGNATURE_SLOTS)[number];

/**
 * แนบ/ลบรูปลายเซ็นจากหน้ากรอก/แก้ไขเอกสาร — แนบได้เฉพาะช่องของตัวเอง (ตรวจ role ที่ service)
 * ไม่ยุ่งกับ signed_at — สถานะอนุมัติยังเดินตามขั้นตอน 3 ผู้เซ็นเหมือนเดิม
 */
export class AttachSignatureDto {
  @IsIn(SIGNATURE_SLOTS as unknown as string[], { message: 'ช่องลายเซ็นไม่ถูกต้อง' })
  slot: SignatureSlot;

  /** data:image base64 — ส่ง '' = ลบรูป */
  @IsString() @MaxLength(300_000, { message: 'ไฟล์รูปลายเซ็นใหญ่เกินไป' })
  signatureImage: string;
}
