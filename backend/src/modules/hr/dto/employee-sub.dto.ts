import { IsString, IsNotEmpty, IsOptional, IsInt, IsNumber, IsDateString, Min, Max } from 'class-validator';

export class CreateEducationDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุวุฒิการศึกษา' }) degree: string;
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุสถานศึกษา' }) institution: string;

  @IsOptional() @IsString() major?: string;
  @IsOptional() @IsInt() graduationYear?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(4) gpa?: number;
}

export class CreateTrainingDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อหลักสูตร' }) courseName: string;
  @IsDateString({}, { message: 'วันที่เริ่มอบรมไม่ถูกต้อง' }) startDate: string;

  @IsOptional() @IsString() organizer?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsNumber() @Min(0) hours?: number;
  @IsOptional() @IsString() certificateUrl?: string;
  @IsOptional() @IsString() note?: string;
}
