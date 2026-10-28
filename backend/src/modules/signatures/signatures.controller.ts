import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, Req, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SignaturesService } from './signatures.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('signatures')
@ApiBearerAuth('access-token')
@Controller('signatures')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SignaturesController {
  constructor(private readonly service: SignaturesService) {}

  @Get()
  @RequirePermissions({ module: 'signatures', action: 'read', subject: 'Signature' })
  @ApiOperation({ summary: 'ประวัติการลงนามทั้งหมด' })
  getAllLogs(@CurrentUser('id') userId: string, @Query() dto: PaginationDto) {
    return this.service.getSignatureLogs(userId, dto);
  }

  @Get('stats')
  @RequirePermissions({ module: 'signatures', action: 'read', subject: 'Signature' })
  @ApiOperation({ summary: 'สถิติการลงนาม' })
  getStats(@CurrentUser('id') userId: string) { return this.service.getSignatureStats(userId); }

  @Get('my')
  @RequirePermissions({ module: 'signatures', action: 'read', subject: 'Signature' })
  @ApiOperation({ summary: 'ลายเซ็นของฉัน' })
  getMySignatures(@CurrentUser('id') userId: string) { return this.service.getMySignatures(userId); }

  @Post('my')
  @RequirePermissions({ module: 'signatures', action: 'create', subject: 'Signature' })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'บันทึกลายเซ็นใหม่' })
  createSignature(@CurrentUser('id') userId: string, @Body() dto: any, @UploadedFile() file?: Express.Multer.File) {
    return this.service.createSignature(userId, dto, file);
  }

  @Put('my/:id')
  @RequirePermissions({ module: 'signatures', action: 'create', subject: 'Signature' })
  @ApiOperation({ summary: 'แก้ไขลายเซ็น' })
  updateSignature(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string, @Body() dto: any) {
    return this.service.updateSignature(id, userId, dto);
  }

  @Delete('my/:id')
  @RequirePermissions({ module: 'signatures', action: 'create', subject: 'Signature' })
  @ApiOperation({ summary: 'ลบลายเซ็น' })
  deleteSignature(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('id') userId: string) {
    return this.service.deleteSignature(id, userId);
  }

  @Post('sign')
  @RequirePermissions({ module: 'signatures', action: 'sign', subject: 'Document' })
  @ApiOperation({ summary: 'เซ็นเอกสาร' })
  signDocument(@CurrentUser('id') userId: string, @Body() dto: any, @Req() req: any) {
    return this.service.signDocument(userId, dto.signatureId, dto.documentType, dto.documentId, dto.documentTitle, req.ip || '', req.headers['user-agent'] || '', dto.documentHash, dto.position);
  }

  @Get('logs')
  @RequirePermissions({ module: 'signatures', action: 'read', subject: 'Signature' })
  @ApiOperation({ summary: 'ประวัติการเซ็นของฉัน' })
  getLogs(@CurrentUser('id') userId: string, @Query() dto: PaginationDto) {
    return this.service.getSignatureLogs(userId, dto);
  }

  @Get('logs/:documentType/:id')
  @RequirePermissions({ module: 'signatures', action: 'read', subject: 'Signature' })
  @ApiOperation({ summary: 'ประวัติการเซ็นของเอกสาร' })
  getDocumentLogs(@Param('documentType') documentType: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.getDocumentSignatureLogs(documentType, id);
  }
}
