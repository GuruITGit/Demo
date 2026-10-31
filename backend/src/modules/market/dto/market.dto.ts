import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

/** วิธีรับชำระ: เงินสดที่ อบต. · สแกนจ่าย · โอน (มีสลิป) */
export const PAY_METHODS = ['cash', 'qr', 'transfer'] as const;

export class PayBillDto {
  @IsIn(PAY_METHODS as unknown as string[])
  method: (typeof PAY_METHODS)[number];
}

export class MarketBillQueryDto {
  @IsOptional() @IsIn(['unpaid', 'pending', 'paid', 'mismatch'])
  status?: string;

  /** งวด พ.ศ.-เดือน เช่น 2569-10 */
  @IsOptional() @IsString() @MaxLength(7)
  period?: string;

  @IsOptional() @IsString() @MaxLength(10)
  stallCode?: string;
}

/** แก้ไขแผง: สถานะ / ชื่อผู้จอง-ผู้เช่า (ว่างได้ด้วยการส่ง null) / ค่าเช่าต่อเดือน */
export class UpdateStallDto {
  @IsOptional() @IsIn(['available', 'reserved', 'occupied'])
  status?: 'available' | 'reserved' | 'occupied';

  @IsOptional() @IsString() @MaxLength(200)
  tenantName?: string | null;

  @IsOptional() @IsNumber() @Min(0)
  monthlyRate?: number;
}

/** เหตุผลที่ไม่รับสลิป (แสดงให้ประชาชนเห็น) */
export class RejectBillDto {
  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

/** ออกบิลประจำงวด — ไม่ส่ง period = งวดเดือนปัจจุบัน */
export class GenerateBillsDto {
  @IsOptional() @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'งวดต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-10' })
  period?: string;
}

/** ตั้งค่ารับเงิน + ราคา (หน้าเจ้าหน้าที่) */
export class PayConfigDto {
  @IsOptional() @IsString() @MaxLength(20) promptpayId?: string;
  @IsOptional() @IsIn(['mobile', 'natid', 'ewallet']) promptpayType?: 'mobile' | 'natid' | 'ewallet';
  @IsOptional() @IsIn(['', 'slip2go', 'easyslip', 'slipok']) slipProvider?: string;
  /** โทเคนตรวจสลิป: ไม่ส่ง = คงเดิม · ส่งค่าว่าง = ลบ */
  @IsOptional() @IsString() @MaxLength(300) slipToken?: string;
  @IsOptional() @IsString() @MaxLength(120) payeeName?: string;
  @IsOptional() @IsString() @MaxLength(60) accountBank?: string;
  @IsOptional() @IsString() @MaxLength(30) accountNo?: string;
  @IsOptional() @IsString() @MaxLength(120) cashPlace?: string;
  @IsOptional() @IsString() @MaxLength(120) cashHours?: string;

  @IsOptional() @IsString() @MaxLength(40) contactPhone?: string;
  @IsOptional() @IsNumber() @Min(0) wasteStallFee?: number;
  @IsOptional() @IsNumber() @Min(0) householdFee?: number;
}

/** เพิ่มแผงทีละล็อก */
export class CreateStallDto {
  @IsString() @Matches(/^[A-Za-z0-9ก-๙]{1,10}$/, { message: 'รหัสแผงใช้ตัวอักษร/ตัวเลข ไม่เกิน 10 ตัว' })
  stallCode: string;

  @IsOptional() @IsString() @MaxLength(10)
  zone?: string;

  @IsNumber() @Min(0)
  monthlyRate: number;
}

/** เพิ่มแผงเป็นช่วง เช่น โซน D ล็อก 1–20 → D01..D20 (ข้ามรหัสที่มีอยู่แล้ว) */
export class BulkStallsDto {
  @IsString() @Matches(/^[A-Za-z0-9ก-๙]{1,3}$/, { message: 'โซนใช้ตัวอักษร/ตัวเลข ไม่เกิน 3 ตัว' })
  zone: string;

  @IsInt() @Min(1) @Max(999)
  from: number;

  @IsInt() @Min(1) @Max(999)
  to: number;

  @IsNumber() @Min(0)
  monthlyRate: number;
}

/** ตั้งค่าเช่าทั้งโซน */
export class ZoneRateDto {
  @IsString() @MaxLength(10)
  zone: string;

  @IsNumber() @Min(0)
  monthlyRate: number;
}

/** เพิ่มบิลค่าแผงเอง (ย้อนหลัง/พิเศษ) */
export class CreateMarketBillDto {
  @IsString() @MaxLength(10)
  stallCode: string;

  @IsIn(['rent', 'waste'])
  kind: 'rent' | 'waste';

  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'งวดต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-10' })
  period: string;

  @IsNumber() @Min(0.01)
  amount: number;
}

export class OutsideLocationDto {
  @IsOptional() @IsString() @MaxLength(100)
  name?: string;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) openFrom?: string | null;

  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/) openUntil?: string | null;

  @IsOptional() @IsInt() @Min(1) @Max(9999) capacity?: number | null;

  @IsOptional() @IsNumber() @Min(0)
  rentRate?: number;

  @IsOptional() @IsIn(['daily', 'monthly'])
  rentPeriod?: 'daily' | 'monthly';

  @IsOptional() @IsBoolean()
  enabled?: boolean;
}

export class OutsideCollectionDto {
  @IsUUID()
  locationId: string;

  @IsString() @MaxLength(200)
  vendorName: string;

  /** วันที่เก็บ (ค.ศ. YYYY-MM-DD) — ไม่ส่ง = วันนี้ */
  @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  collectedOn?: string;

  /** ไม่ส่ง = ใช้ค่าเช่าของจุดนั้น */
  @IsOptional() @IsNumber() @Min(0.01)
  amount?: number;
}
