import { IsString, IsNotEmpty, IsOptional, IsUUID, IsBoolean, IsDateString, IsInt } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

const emptyToUndef = ({ value }: any) => (value === '' || value === null ? undefined : value);

export class CreateMeetingDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อการประชุม' })
  title: string;

  @IsDateString({}, { message: 'กรุณาระบุวัน-เวลาเริ่มประชุม' })
  startDatetime: string;

  @IsDateString({}, { message: 'กรุณาระบุวัน-เวลาสิ้นสุดประชุม' })
  endDatetime: string;

  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsBoolean() isOnline?: boolean;
  @IsOptional() @IsString() meetingUrl?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() chairId?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() secretaryId?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() departmentId?: string;
  @IsOptional() @IsString() status?: string;
}

export class UpdateMeetingDto extends PartialType(CreateMeetingDto) {}

export class CreateAgendaItemDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุหัวข้อวาระ' }) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() durationMin?: number;
  @IsOptional() @IsString() type?: string;
}

export class CreateResolutionDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุมติที่ประชุม' }) resolutionText: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() status?: string;
}
