import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const emptyToUndef = ({ value }: any) => (value === '' || value === null ? undefined : value);

/** ฟิลเตอร์รายชื่อบุคลากร (ดูหมายเหตุ whitelist ใน AuditQueryDto) */
export class EmployeeQueryDto extends PaginationDto {
  @IsOptional() @Transform(emptyToUndef) @IsString() status?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() deptId?: string;
}
