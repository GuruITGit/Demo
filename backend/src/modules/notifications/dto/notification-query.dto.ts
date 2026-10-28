import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

/** ฟิลเตอร์รายการแจ้งเตือน (ดูหมายเหตุ whitelist ใน AuditQueryDto) */
export class NotificationQueryDto extends PaginationDto {
  /** query string ส่งมาเป็นข้อความ ("true"/"1") → แปลงเป็น boolean ก่อนตรวจ */
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null || value === undefined ? undefined : value === true || value === 'true' || value === '1'))
  @IsBoolean()
  unreadOnly?: boolean;
}
