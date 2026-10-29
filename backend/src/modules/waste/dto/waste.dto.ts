import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class WasteBillQueryDto {
  /** บ้านเลขที่+หมู่ (เช่น "18 หมู่ 2") · ชื่อ · หรือเบอร์โทร */
  @IsOptional() @IsString() @MaxLength(100)
  q?: string;

  @IsOptional() @IsIn(['unpaid', 'paid'])
  status?: string;

  @IsOptional() @IsString() @MaxLength(7)
  period?: string;
}

export class WastePayDto {
  @IsIn(['cash', 'qr', 'transfer'])
  method: 'cash' | 'qr' | 'transfer';
}
