import { IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const emptyToUndef = ({ value }: any) => (value === '' || value === null ? undefined : value);

/** ฟิลเตอร์รายการใบลา (ดูหมายเหตุ whitelist ใน AuditQueryDto) */
export class LeaveQueryDto extends PaginationDto {
  @IsOptional() @Transform(emptyToUndef) @IsString() status?: string;
}
