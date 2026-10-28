import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const emptyToUndef = ({ value }: any) => (value === '' || value === null ? undefined : value);

/** ฟิลเตอร์รายการครุภัณฑ์ (ดูหมายเหตุ whitelist ใน AuditQueryDto) */
export class AssetQueryDto extends PaginationDto {
  @IsOptional() @Transform(emptyToUndef) @IsString() status?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() deptId?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() categoryId?: string;
}
