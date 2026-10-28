import {
  IsString, IsNotEmpty, IsOptional, IsEnum, IsUUID, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { DocumentUrgency, IncomingDocStatus } from '../../../database/entities/incoming-document.entity';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateIncomingDocDto {
  @ApiProperty({ example: 'ขอความร่วมมือประชาสัมพันธ์' })
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกเรื่อง' })
  subject: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  docDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalDocNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderOrg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional({ enum: DocumentUrgency })
  @IsOptional()
  urgencyLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  receiverDeptId?: string;
}

export class UpdateIncomingDocDto extends PartialType(CreateIncomingDocDto) {}

export class AssignDocDto {
  @ApiProperty()
  @IsUUID()
  assignedTo: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class ActionNoteDto {
  @ApiProperty({ example: 'ให้กองช่างดำเนินการตามอำนาจหน้าที่' })
  @IsString()
  @IsNotEmpty()
  actionNote: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class CreateOutgoingDocDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกเรื่อง' })
  subject: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกเนื้อหา' })
  body: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'กรุณากรอกชื่อผู้รับ' })
  recipientName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientOrg?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  urgencyLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  replyToId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class CorrespondenceQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  urgencyLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  deptId?: string;
}
