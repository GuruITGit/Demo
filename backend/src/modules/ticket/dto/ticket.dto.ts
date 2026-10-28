import {
  IsString, IsNotEmpty, IsOptional, IsUUID, IsDateString, IsArray, IsEnum, ArrayNotEmpty,
  IsInt, ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TicketUrgency, TicketConfidentiality, RegisterBook } from '../../../database/entities/correspondence-ticket.entity';

/** รายการ "สิ่งที่ส่งมาด้วย" */
export class EnclosureDto {
  @ApiProperty({ example: 'สำเนาแผนพัฒนา' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณาระบุชื่อสิ่งที่ส่งมาด้วย' })
  name: string;

  @ApiPropertyOptional({ example: '1' })
  @IsOptional()
  @IsString()
  qty?: string;

  @ApiPropertyOptional({ example: 'ชุด' })
  @IsOptional()
  @IsString()
  unit?: string;
}

/** สร้างสารบรรณใหม่ + มอบหมายกอง */
/** ผู้รับผิดชอบต่อกอง (มอบหมายแบบ tree view — 1 กอง หลายคนได้) */
export class TicketDeptAssigneeDto {
  @IsUUID()
  departmentId: string;

  @IsArray()
  @IsUUID('all', { each: true })
  userIds: string[];
}

export class CreateTicketDto {
  /**
   * เลขทะเบียนรับ (กรอกเอง) — เลขหลักของสารบรรณ (rework v20000)
   * เลิก auto-gen แล้ว: ค่านี้ใช้เป็น ticketNumber ด้วย → ห้ามซ้ำต่อสมุดทะเบียน
   */
  @ApiProperty({ example: '1988' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกเลขทะเบียนรับ' })
  receiveRegNumber: string;

  @ApiProperty({ example: 'ขอความร่วมมือสำรวจข้อมูลผู้สูงอายุ' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกเรื่อง' })
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  /** เลขหนังสือภายนอกที่มากับเอกสาร (กรอกเอง) */
  @ApiPropertyOptional({ example: '1234/2569' })
  @IsOptional()
  @IsString()
  externalDocNumber?: string;

  /** ปีงบประมาณ (พ.ศ.) */
  @ApiPropertyOptional({ example: 2569 })
  @IsOptional()
  @IsInt()
  @Min(2400)
  @Max(2700)
  fiscalYear?: number;

  @ApiPropertyOptional({ example: '09:30' })
  @IsOptional()
  @IsString()
  receivedTime?: string;

  // ── หน่วยงานต้นทาง / ผู้ส่ง ──
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceOrg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderPosition?: string;

  /** เรียน (ผู้รับ) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipient?: string;

  /** คำสำคัญ (Keyword) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  keywords?: string;

  /** หมวดหนังสือ (รับ/ส่ง/ภายใน) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  docCategory?: string;

  /** ประเภทหนังสือ */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  docType?: string;

  /** สมุดทะเบียน (ข้อ 1) — ค่าเริ่มต้น R_MAIN รับทั่วไป */
  @ApiPropertyOptional({ enum: RegisterBook })
  @IsOptional()
  @IsEnum(RegisterBook, { message: 'สมุดทะเบียนไม่ถูกต้อง' })
  registerBook?: string;

  /** ผู้รับหนังสือเวียน (หลายราย — เฉพาะเล่มเวียน ข้อ 2) */
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  circularRecipients?: string[];

  /** ชั้นความลับ */
  @ApiPropertyOptional({ enum: TicketConfidentiality })
  @IsOptional()
  @IsEnum(TicketConfidentiality, { message: 'ชั้นความลับไม่ถูกต้อง' })
  confidentiality?: string;

  /** วัตถุประสงค์ (สำนวนหนังสือราชการแบบเต็ม — ไม่จำกัด enum) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purpose?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purposeOther?: string;

  // ── อ้างถึง ──
  @ApiPropertyOptional({ example: 'บล 123/2569' })
  @IsOptional()
  @IsString()
  refDocNumber?: string;

  @ApiPropertyOptional({ example: 'ลงวันที่ 10 มกราคม 2569' })
  @IsOptional()
  @IsString()
  refDocDetail?: string;

  /** สิ่งที่ส่งมาด้วย (หลายรายการ) */
  @ApiPropertyOptional({ type: [EnclosureDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EnclosureDto)
  enclosures?: EnclosureDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  docDate?: string;

  /** วันที่ต้นทางส่ง */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  sentDate?: string;

  @ApiPropertyOptional({ example: '14:55' })
  @IsOptional()
  @IsString()
  sentTime?: string;

  /** วันครบกำหนดดำเนินการ */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({ enum: TicketUrgency })
  @IsOptional()
  @IsEnum(TicketUrgency, { message: 'ระดับความเร่งด่วนไม่ถูกต้อง' })
  urgencyLevel?: string;

  /** กองเจ้าของเรื่อง */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerDeptId?: string;

  /** ผู้รับผิดชอบหลัก */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  /** กองที่มอบหมายให้ดำเนินการ (อย่างน้อย 1 กอง) */
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty({ message: 'กรุณาเลือกกองที่มอบหมายอย่างน้อย 1 กอง' })
  @IsUUID('all', { each: true })
  departmentIds: string[];

  /** ผู้รับผิดชอบต่อกอง (tree view) — 1 กองเลือกได้หลายคน */
  @ApiPropertyOptional({ type: [TicketDeptAssigneeDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketDeptAssigneeDto)
  assignees?: TicketDeptAssigneeDto[];
}

/**
 * แก้ไขเอกสารสารบรรณ (ข้อมูลหนังสือ) — ทุกฟิลด์ optional
 * ไม่แก้: เลขทะเบียน/สมุด/ทิศทาง/สถานะ/ลายเซ็น (รักษาความถูกต้องตามระเบียบ)
 */
export class UpdateTicketDto extends PartialType(CreateTicketDto) {}

/** ค้นหา/กรองรายการสารบรรณ (รองรับค้นหาขั้นสูงหลายเงื่อนไข) */
export class TicketQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  status?: string;

  /** กรองตาม step v4 (current_step) */
  @ApiPropertyOptional()
  @IsOptional()
  step?: string;

  @ApiPropertyOptional()
  @IsOptional()
  urgencyLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deptId?: string;

  /** หน่วยงานต้นทาง (ค้นหาบางส่วน) */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceOrg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  responsibleUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  confidentiality?: string;

  /** กรองตามสมุดทะเบียน (ข้อ 1) */
  @ApiPropertyOptional({ enum: RegisterBook })
  @IsOptional()
  registerBook?: string;

  /** กรองตามทิศทาง รับ/ส่ง */
  @ApiPropertyOptional()
  @IsOptional()
  direction?: string;

  /** กรองตามปีงบประมาณ (พ.ศ.) สำหรับค้นย้อนหลังรายปี (ข้อ 7) */
  @ApiPropertyOptional({ example: 2569 })
  @IsOptional()
  @IsInt()
  fiscalYear?: number;

  /** ช่วงวันที่รับหนังสือ */
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
