import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  /**
   * รหัสองค์กร (สำหรับเว็บประปา /prapa แบบ multi-tenant) — ไม่ส่งมา = ล็อกอินระบบ อบต.หลักตามเดิม
   * ถ้าส่งมา จะจำกัดการหา user เฉพาะในองค์กรนั้น (username ซ้ำข้ามองค์กรได้)
   */
  @ApiProperty({ required: false, example: 'LNR', description: 'รหัสองค์กร (เว็บประปา)' })
  @IsOptional() @IsString()
  orgCode?: string;

  @ApiProperty({ example: 'admin', description: 'ชื่อผู้ใช้หรืออีเมล' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกชื่อผู้ใช้' })
  username: string;

  @ApiProperty({ example: 'YourPassword123', description: 'รหัสผ่าน' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกรหัสผ่าน' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกรหัสผ่านเดิม' })
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกอีเมล' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' })
  newPassword: string;
}
