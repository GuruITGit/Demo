import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';

export class CreateFromTextDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อเอกสาร' })
  title: string;

  @IsString() @IsNotEmpty({ message: 'กรุณาระบุเนื้อหา' })
  ocrText: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];
}
