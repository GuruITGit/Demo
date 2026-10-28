import { IsString, IsNotEmpty, IsOptional, IsUUID, IsNumber, IsDateString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

const emptyToUndef = ({ value }: any) => (value === '' || value === null ? undefined : value);

export class CreateEmployeeDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุรหัสพนักงาน' })
  employeeCode: string;

  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อ (ไทย)' })
  firstNameTh: string;

  @IsString() @IsNotEmpty({ message: 'กรุณาระบุนามสกุล (ไทย)' })
  lastNameTh: string;

  @IsString() @IsNotEmpty({ message: 'กรุณาระบุเลขบัตรประชาชน' })
  nationalId: string;

  @IsString() @IsNotEmpty({ message: 'กรุณาระบุประเภทพนักงาน' })
  employeeType: string;

  @IsDateString({}, { message: 'วันที่บรรจุไม่ถูกต้อง' })
  hireDate: string;

  @IsOptional() @Transform(emptyToUndef) @IsUUID() userId?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() firstNameEn?: string;
  @IsOptional() @IsString() lastNameEn?: string;
  @IsOptional() @IsDateString() birthDate?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() religion?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() emergencyContact?: string;
  @IsOptional() @IsString() emergencyPhone?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() departmentId?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() divisionId?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() positionId?: string;
  @IsOptional() @IsString() positionName?: string;
  @IsOptional() @IsDateString() probationEndDate?: string;
  @IsOptional() @IsDateString() contractEndDate?: string;
  @IsOptional() @IsDateString() resignDate?: string;
  @IsOptional() @IsNumber() @Min(0) salary?: number;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() photoUrl?: string;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}
