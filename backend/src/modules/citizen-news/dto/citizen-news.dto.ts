import { IsOptional, IsString, IsIn, IsBoolean, MaxLength } from 'class-validator';

export const NEWS_CATEGORIES = ['ข่าวประชาสัมพันธ์', 'ประกาศจัดซื้อจัดจ้าง', 'กิจกรรม', 'ประกาศทั่วไป'] as const;
export const NEWS_STATUSES = ['draft', 'published'] as const;

export class CreateNewsDto {
  @IsString() @MaxLength(250)
  title: string;

  @IsOptional() @IsIn(NEWS_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional() @IsString()
  excerpt?: string;

  @IsOptional() @IsString()
  content?: string;

  @IsOptional() @IsIn(NEWS_STATUSES as unknown as string[])
  status?: string;

  @IsOptional() @IsBoolean()
  pinned?: boolean;
}

export class UpdateNewsDto {
  @IsOptional() @IsString() @MaxLength(250)
  title?: string;

  @IsOptional() @IsIn(NEWS_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional() @IsString()
  excerpt?: string;

  @IsOptional() @IsString()
  content?: string;

  @IsOptional() @IsIn(NEWS_STATUSES as unknown as string[])
  status?: string;

  @IsOptional() @IsBoolean()
  pinned?: boolean;
}
