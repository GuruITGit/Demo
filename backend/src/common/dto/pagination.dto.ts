  import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
  import { Type } from 'class-transformer';
  import { ApiPropertyOptional } from '@nestjs/swagger';

  export class PaginationDto {
    @ApiPropertyOptional({ default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    sortBy?: string;

    @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'DESC' })
    @IsOptional()
    @IsString()
    sortOrder?: 'ASC' | 'DESC' = 'DESC';

    get skip(): number {
      return ((this.page || 1) - 1) * (this.limit || 20);
    }
  }

  export interface PaginatedResult<T> {
    data: T[];
    meta: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }

  export function paginate<T>(data: T[], total: number, dto: PaginationDto): PaginatedResult<T> {
    return {
      data,
      meta: {
        page: dto.page || 1,
        limit: dto.limit || 20,
        total,
        totalPages: Math.ceil(total / (dto.limit || 20)),
      },
    };
  }
