import { IsString, IsEmail, IsOptional, IsUUID, IsBoolean, MinLength, IsNotEmpty, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** ค้นหา/กรองผู้ใช้ (rework v20000) — กอง + บทบาท + สถานะ + ค้นหา */
export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'กรองตามกอง' })
  @IsOptional() @IsUUID()
  deptId?: string;

  @ApiPropertyOptional({ description: 'กรองตามบทบาท' })
  @IsOptional() @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ enum: ['active', 'suspended', 'locked'], description: 'สถานะ: ใช้งาน/ระงับ/ล็อก' })
  @IsOptional() @IsIn(['active', 'suspended', 'locked'])
  status?: 'active' | 'suspended' | 'locked';
}

export class CreateUserDto {
  @ApiProperty({ example: 'somchai.j' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกชื่อผู้ใช้' })
  username: string;

  @ApiPropertyOptional({ example: 'somchai@example.com' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value) || undefined)
  @IsEmail({}, { message: 'รูปแบบอีเมลไม่ถูกต้อง' })
  email?: string;

  @ApiProperty({ example: 'Password@123' })
  @IsString()
  @MinLength(8, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  password: string;

  @ApiProperty({ example: 'สมชาย ใจดี' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกชื่อ-สกุล' })
  fullNameTh: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fullNameEn?: string;

  @ApiPropertyOptional({ example: 'นาย' })
  @IsOptional()
  @IsString()
  titleTh?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value || undefined)
  @IsUUID()
  divisionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  positionName?: string;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignRoleDto {
  @ApiProperty()
  @IsUUID()
  roleId: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  newPassword?: string;
}
