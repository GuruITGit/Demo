import { IsString, IsNotEmpty, IsOptional, IsUUID, IsInt, IsNumber, IsDateString, IsObject, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

const emptyToUndef = ({ value }: any) => (value === '' || value === null ? undefined : value);

export class CreateProjectDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อโครงการ' })
  title: string;

  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() strategy?: string;
  @IsOptional() @IsInt() fiscalYear?: number;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() deptId?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() projectManagerId?: string;
  @IsOptional() @IsNumber() @Min(0) budgetAmount?: number;
  @IsOptional() @IsNumber() @Min(0) actualAmount?: number;
  @IsOptional() @IsString() targetGroup?: string;
  @IsOptional() @IsString() expectedOutput?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) progressPct?: number;
  @IsOptional() @IsString() status?: string;

  /** ข้อเสนอโครงการ (แบบฟอร์ม 10 หัวข้อ) — เก็บเป็น jsonb ไม่ตรวจรายฟิลด์ */
  @IsOptional() @IsObject() proposal?: Record<string, any>;
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
