import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUUID, IsDateString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

const emptyToUndef = ({ value }: any) => (value === '' || value === null ? undefined : value);

export class CreateAssetDto {
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุชื่อครุภัณฑ์' })
  name: string;

  @IsOptional() @IsString() assetCode?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() categoryId?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsDateString() purchaseDate?: string;
  @IsOptional() @IsNumber() @Min(0) purchasePrice?: number;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsDateString() warrantyExpire?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() departmentId?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @Transform(emptyToUndef) @IsUUID() custodianId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsNumber() @Min(0) currentValue?: number;
  @IsOptional() @IsNumber() @Min(0) depreciationRate?: number;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAssetDto extends PartialType(CreateAssetDto) {}

export class TransferAssetDto {
  @Transform(emptyToUndef) @IsUUID('all', { message: 'กรุณาเลือกกองปลายทาง' }) toDepartmentId: string;
  @Transform(emptyToUndef) @IsUUID('all', { message: 'กรุณาเลือกผู้รับผิดชอบปลายทาง' }) toCustodianId: string;
  @IsOptional() @IsString() reason?: string;
}

export class InspectAssetDto {
  @IsDateString({}, { message: 'วันที่ตรวจไม่ถูกต้อง' }) inspectionDate: string;
  @IsString() @IsNotEmpty({ message: 'กรุณาระบุสภาพครุภัณฑ์' }) condition: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() remarks?: string;
  @IsOptional() @IsString() photoUrl?: string;
}
