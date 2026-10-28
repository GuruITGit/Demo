import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsInt, IsUUID, IsEmail, IsIn, IsArray, IsObject, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

const emptyToUndef = ({ value }: any) => (value === '' || value === null ? undefined : value);

export class CreateOrganizationDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุรหัสหน่วยงาน' }) code: string;
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อหน่วยงาน' }) nameTh: string;
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุจังหวัด' }) province: string;
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุอำเภอ' }) district: string;
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุตำบล' }) subDistrict: string;

  @IsIn(['อบต', 'เทศบาลตำบล', 'เทศบาลเมือง', 'เทศบาลนคร'], { message: 'ประเภทหน่วยงานไม่ถูกต้อง' })
  type: string;

  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() fax?: string;
  @IsOptional() @Transform(emptyToUndef) @IsEmail() email?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() sealUrl?: string;
  @IsOptional() @IsString() headerText?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;

  /** โดเมนที่ผูกกับหน่วยงาน (multi-tenant) — เปิดโดเมนไหน = รู้ว่า อบต. ไหน */
  @IsOptional() @IsArray() @IsString({ each: true }) hostnames?: string[];

  /** ค่ากำหนดรายหน่วยงาน — เช่น metadata.enabledModules (เปิด-ปิดโมดูลราย อบต. ในเฟส B) */
  @IsOptional() @IsObject() metadata?: Record<string, any>;
}

/** รีเซ็ตรหัสผ่านผู้ใช้ในหน่วยงาน (SUPER_ADMIN) — ไม่ระบุ userId/username = admin คนแรก */
export class ResetAdminPasswordDto {
  @IsString() @MinLength(8, { message: 'รหัสผ่านอย่างน้อย 8 ตัวอักษร' }) @MaxLength(100)
  password: string;

  @IsOptional() @Transform(emptyToUndef) @IsUUID() userId?: string;
  @IsOptional() @IsString() username?: string;
}

/** ล้างข้อมูลเรื่องแจ้ง/ร้องเรียนของหน่วยงาน (SUPER_ADMIN) — ต้องพิมพ์รหัสหน่วยงานยืนยัน กันกดพลาด */
export class ClearCitizenReportsDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาพิมพ์รหัสหน่วยงานเพื่อยืนยัน' }) confirm: string;
}

/** ตั้งค่าโมดูลที่ปิดของหน่วยงาน (SUPER_ADMIN) */
export class SetModulesDto {
  @IsArray() @IsString({ each: true }) disabledModules: string[];
}

/** เปิดใช้งาน อบต. ใหม่ในคลิกเดียว — สร้างหน่วยงาน + ผู้ดูแลคนแรก (SUPER_ADMIN เท่านั้น) */
export class OnboardOrgDto extends CreateOrganizationDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อผู้ใช้แอดมิน' }) @MaxLength(100)
  adminUsername: string;

  @IsString() @MinLength(8, { message: 'รหัสผ่านอย่างน้อย 8 ตัวอักษร' }) @MaxLength(100)
  adminPassword: string;

  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อ-สกุลแอดมิน' }) @MaxLength(200)
  adminFullName: string;

  @IsOptional() @Transform(emptyToUndef) @IsEmail() adminEmail?: string;
}
export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}

export class CreateDepartmentDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุรหัสกอง' }) code: string;
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อกอง' }) nameTh: string;

  @IsOptional() @IsString() groupLabel?: string;
  @IsOptional() @IsString() deptType?: string;
  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() docPrefix?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() headUserId?: string;
  @IsOptional() @IsInt() orderNo?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() hiddenFromForms?: boolean;
  @IsOptional() @IsBoolean() hiddenFromDirectory?: boolean;
}
export class UpdateDepartmentDto extends PartialType(CreateDepartmentDto) {}

export class CreateDivisionDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุรหัสงาน/ฝ่าย' }) code: string;
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่องาน/ฝ่าย' }) nameTh: string;

  @IsOptional() @IsString() nameEn?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() headUserId?: string;
  @IsOptional() @IsInt() orderNo?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
