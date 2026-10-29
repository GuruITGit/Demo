import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';

export class WasteBillQueryDto {
  /** บ้านเลขที่+หมู่ (เช่น "18 หมู่ 2") · ชื่อ · หรือเบอร์โทร */
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @IsIn(['unpaid', 'pending', 'paid', 'mismatch'])
  status?: string;

  @IsOptional() @IsString() @MaxLength(7)
  period?: string;
}

export class WastePayDto {
  @IsIn(['cash', 'qr', 'transfer'])
  method: 'cash' | 'qr' | 'transfer';
}

export class WasteRejectDto {
  @IsOptional() @IsString() @MaxLength(300)
  note?: string;
}

export class WasteGenerateDto {
  @IsOptional() @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'งวดต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-10' })
  period?: string;
}

/** เพิ่ม/แก้ครัวเรือน — monthlyFee ว่าง (null) = ใช้ราคากลางของ อบต. */
export class HouseholdDto {
  @IsOptional() @IsString() @MaxLength(200)
  holderName?: string;

  @IsOptional() @IsString() @Matches(/^\d{1,5}(\/\d{1,4})?$/, { message: 'บ้านเลขที่ใช้ตัวเลข เช่น 18 หรือ 12/3' })
  houseNo?: string;

  @IsOptional() @IsString() @Matches(/^\d{1,2}$/, { message: 'หมู่ใช้ตัวเลข 1–99' })
  moo?: string;

  @IsOptional() @IsString() @Matches(/^(0\d{8,9})?$/, { message: 'เบอร์โทรไม่ถูกต้อง' })
  phone?: string;

  @IsOptional() @IsNumber() @Min(0)
  monthlyFee?: number | null;
}

/** นำเข้าครัวเรือนเป็นชุด (frontend อ่านไฟล์ CSV แล้วส่งเป็น JSON) */
export class HouseholdImportDto {
  @IsArray() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => HouseholdDto)
  rows: HouseholdDto[];
}

/** เพิ่มบิลเอง (ย้อนหลัง/พิเศษ) */
export class CreateWasteBillDto {
  @IsString() @MaxLength(20)
  householdRef: string;

  @IsString() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'งวดต้องเป็นรูปแบบ พ.ศ.-เดือน เช่น 2569-10' })
  period: string;

  @IsNumber() @Min(0.01)
  amount: number;
}
