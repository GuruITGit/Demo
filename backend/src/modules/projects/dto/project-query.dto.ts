import { IsOptional, IsString, IsInt } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const emptyToUndef = ({ value }: any) => (value === '' || value === null ? undefined : value);

/** ฟิลเตอร์รายการโครงการ (ดูหมายเหตุ whitelist ใน AuditQueryDto) */
export class ProjectQueryDto extends PaginationDto {
  @IsOptional() @Transform(emptyToUndef) @IsString() status?: string;
  @IsOptional() @Transform(emptyToUndef) @Type(() => Number) @IsInt() fiscalYear?: number;
}
