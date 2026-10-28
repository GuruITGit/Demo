import { IsArray, IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class PurgeDto {
  /** รหัสผ่านของผู้ดูแลที่กำลังทำรายการ (ยืนยันชั้นที่ 2) */
  @IsString()
  password: string;

  /** ต้องพิมพ์ให้ตรงกับชื่อองค์กร (ยืนยันชั้นที่ 1) */
  @IsString()
  confirmText: string;

  /** ล้างข้อมูลธุรกรรมทุกโมดูล (คงไว้เฉพาะ master data) */
  @IsOptional() @IsBoolean()
  resetAll?: boolean;

  /** ล้างเฉพาะโมดูลที่เลือก: correspondence|projects|meetings|leave|dms|notifications|citizen_reports */
  @IsOptional() @IsArray() @IsString({ each: true })
  modules?: string[];

  /** ล้างเฉพาะช่วงเวลา (createdAt) */
  @IsOptional() @IsDateString()
  dateFrom?: string;
  @IsOptional() @IsDateString()
  dateTo?: string;

  /** ล้างผู้ใช้ตาม id (ยกเว้น admin/ตัวเอง/ผู้ดูแลเสมอ) */
  @IsOptional() @IsArray() @IsString({ each: true })
  deleteUserIds?: string[];

  /** ลบสารบรรณเฉพาะรายการที่เลือก (เลือกลบทีละเรื่อง — rework v20000) */
  @IsOptional() @IsArray() @IsString({ each: true })
  deleteTicketIds?: string[];

  /** รีเซ็ตเลขทะเบียนเอกสาร */
  @IsOptional() @IsBoolean()
  resetSequences?: boolean;
}
