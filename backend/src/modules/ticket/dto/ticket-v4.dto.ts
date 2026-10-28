import {
  IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString, IsArray, IsEnum,
  IsInt, Min, Max, Matches, IsBoolean, IsObject,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TicketUrgency, TicketConfidentiality, RegisterBook } from '../../../database/entities/correspondence-ticket.entity';

/** ลายเซ็นต้องเป็น data URL รูปภาพ (base64) เท่านั้น — กัน XSS/SSRF ตอนเรนเดอร์ PDF */
const SIGNATURE_DATA_URL = /^data:image\/(png|jpe?g|gif|webp);base64,/i;

/**
 * สร้างสารบรรณ — ผู้ลงรับเซ็นแล้วส่งต่อให้ "คน" (toUserId) หรือ "ปลัด" (toClerk) ได้เลย
 * กองเจ้าของ = กองของคนรับคนแรก (ส่งปลัดตรง = กองของผู้ลงรับ)
 */
export class CreateTicketV4Dto {
  /** เลขทะเบียนรับ (กรอกเอง) = เลขหลักของสารบรรณ */
  @ApiProperty({ example: '1988' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกเลขทะเบียนรับ' })
  receiveRegNumber: string;

  /** เอกสารเลขที่ (เลข บร ตามหนังสือต้นฉบับ) */
  @ApiProperty({ example: 'บร 0023.1/1234' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกเอกสารเลขที่' })
  externalDocNumber: string;

  /** ลงวันที่ (วันที่ของเอกสารต้นฉบับ) */
  @ApiProperty({ example: '2026-08-10' })
  @IsDateString()
  docDate: string;

  /** จาก (สำนักงานต้นทาง) */
  @ApiProperty({ example: 'อำเภอโนนดินแดง' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกช่อง "จาก"' })
  sourceOrg: string;

  @ApiProperty({ example: 'ขอความร่วมมือสำรวจข้อมูลผู้สูงอายุ' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกเรื่อง' })
  subject: string;

  /** เรียน */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipient?: string;

  /** รายละเอียดโดยย่อ */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ enum: TicketUrgency })
  @IsOptional()
  @IsEnum(TicketUrgency, { message: 'ระดับความเร่งด่วนไม่ถูกต้อง' })
  urgencyLevel?: string;

  @ApiPropertyOptional({ enum: TicketConfidentiality })
  @IsOptional()
  @IsEnum(TicketConfidentiality, { message: 'ชั้นความลับไม่ถูกต้อง' })
  confidentiality?: string;

  /** สมุดทะเบียน (ค่าเริ่มต้น R_MAIN) */
  @ApiPropertyOptional({ enum: RegisterBook })
  @IsOptional()
  @IsEnum(RegisterBook, { message: 'สมุดทะเบียนไม่ถูกต้อง' })
  registerBook?: string;

  @ApiPropertyOptional({ example: 2569 })
  @IsOptional()
  @IsInt()
  @Min(2400)
  @Max(2700)
  fiscalYear?: number;

  /** วัตถุประสงค์ (เลือกได้ >1) */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  purposes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purposeOther?: string;

  /** ลายเซ็นผู้ลงรับ (บังคับ — ทุกการส่งต้องเซ็น) */
  @ApiProperty()
  @IsString()
  @Matches(SIGNATURE_DATA_URL, { message: 'กรุณาประทับลายเซ็นก่อนส่ง' })
  signatureImage: string;

  /** เอกสารที่ผู้ลงรับลากลายเซ็นของตัวเองไปวางแล้ว (ตัวแต่งเอกสาร layout v2) — บังคับ */
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  overlayLayout?: any;

  /** ส่งถึงคน (หัวหน้ากอง/ใครก็ได้) — ใช้คู่กับ toClerk อย่างใดอย่างหนึ่ง */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toUserId?: string;

  /** ส่งปลัดเลย */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  toClerk?: boolean;

  /** (เดิม) ผู้ปฏิบัติ — ยังรับไว้เผื่อ client เก่า: ถือเป็น toUserId */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedHeadUserId?: string;
}

/** ทุกฟิลด์ optional สำหรับ "ขอแก้ไขเอกสาร" v4 (ไม่เกี่ยวกับการส่งต่อ/ลายเซ็น) */
export class UpdateTicketV4Dto extends PartialType(CreateTicketV4Dto) {}

/** ประเภท action ในสารบรรณ (ไดนามิก) */
export enum TicketActionType {
  FORWARD = 'forward',     // ผู้ถือเรื่อง: เซ็น → ส่งต่อให้คน (toUserId) หรือปลัด (toClerk)
  SIGN_SEND = 'sign_send', // ปลัด: เซ็น → ส่งนายก · นายก: เซ็น → ปิดงาน
}

/** ดำเนินการ 1 ทอด (endpoint เดียว — service ตรวจขั้น + สิทธิ์เอง) */
export class TicketActionV4Dto {
  @ApiProperty({ enum: TicketActionType })
  @IsEnum(TicketActionType, { message: 'ประเภทการดำเนินการไม่ถูกต้อง' })
  type: TicketActionType;

  /** หมายเหตุ (popup ก่อนส่งดำเนินการ) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  /** ลายเซ็น (บังคับทุกการส่ง) — data URL base64 */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(SIGNATURE_DATA_URL, { message: 'รูปแบบลายเซ็นไม่ถูกต้อง' })
  signatureImage?: string;

  /** forward: ส่งถึงคน */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toUserId?: string;

  /** forward: ส่งปลัด */
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  toClerk?: boolean;

  /** forward: เลขทะเบียนรับกอง (ไม่บังคับ — ธุรการกองลงเลขของกองตัวเองได้) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deptRegNumber?: string;
}

/** ตีกลับ — คืนให้ผู้ส่งทอดก่อนหน้า (ค่าเริ่มต้น) หรือผู้ลงรับ (toCreator) */
export class ReturnV4Dto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุเหตุผลการตีกลับ' })
  note: string;

  /** true = ตีกลับไปหาคนสร้าง (ผู้ลงรับ) ให้แก้ไข */
  @ApiPropertyOptional()
  @IsOptional()
  toCreator?: boolean;
}
