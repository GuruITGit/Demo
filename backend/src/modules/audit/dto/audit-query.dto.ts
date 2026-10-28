import { IsOptional, IsString, IsUUID, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const emptyToUndef = ({ value }: any) => (value === '' || value === null ? undefined : value);

/**
 * ฟิลเตอร์หน้าประวัติกิจกรรม
 * ⚠ ทุกฟิลเตอร์ต้องประกาศไว้ที่นี่ — ValidationPipe({whitelist:true}) ใน main.ts
 * จะตัด query param ที่ไม่ได้ประกาศทิ้ง ทำให้ฟิลเตอร์ "เงียบ" (service ได้ undefined)
 */
export class AuditQueryDto extends PaginationDto {
  @IsOptional() @Transform(emptyToUndef) @IsString() action?: string;
  @IsOptional() @Transform(emptyToUndef) @IsString() module?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() userId?: string;
  @IsOptional() @Transform(emptyToUndef) @IsDateString() dateFrom?: string;
  @IsOptional() @Transform(emptyToUndef) @IsDateString() dateTo?: string;
}
