import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
