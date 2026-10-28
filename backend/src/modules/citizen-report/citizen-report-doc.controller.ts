import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CitizenReportDocService } from './citizen-report-doc.service';
import type { DocPdfPayload } from '../doc-editor/doc-editor.service';

const READ = { module: 'complaint', action: 'read', subject: 'Report' };

/** แต่งเอกสาร + ความเห็นภายใน ของเรื่องแจ้ง/ร้องเรียน (เจ้าหน้าที่) */
@ApiTags('citizen-report-staff')
@ApiBearerAuth('access-token')
@Controller('citizen-reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CitizenReportDocController {
  constructor(private readonly service: CitizenReportDocService) {}

  @Get(':id/doc-layout')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'ลายเซ็น/ข้อความที่วางบนเอกสารที่อัปโหลด (ระบุ fileId)' })
  getLayout(@Param('id', ParseUUIDPipe) id: string, @Query('fileId', ParseUUIDPipe) fileId: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.getLayout(id, orgId, fileId);
  }

  @Get(':id/doc-summary')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'ใครวางลายเซ็นไว้ในเอกสารไหนบ้าง' })
  summary(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.summary(id, orgId);
  }

  @Patch(':id/doc-layout')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'บันทึกลายเซ็น/ข้อความที่วางบนเอกสาร (ระบุ fileId)' })
  saveLayout(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @Body('fileId') fileId: string, @Body('layout') layout: any) {
    return this.service.saveLayout(id, orgId, fileId, layout);
  }

  @Post(':id/doc-pdf')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'สร้าง PDF จากตัวแต่งเอกสาร (พื้นหลังส่งมาจากหน้าเว็บ)' })
  @UseInterceptors(FileInterceptor('payload', { storage: memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 1 } }))
  async docPdf(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser('organizationId') orgId: string, @Res() res: Response) {
    let payload: DocPdfPayload;
    try { payload = JSON.parse(file?.buffer?.toString('utf8') || ''); } catch { throw new BadRequestException('ข้อมูลเอกสารไม่ถูกต้อง'); }
    const { buffer, filename } = await this.service.renderPdf(id, orgId, payload);
    const ascii = filename.replace(/[^\x20-\x7e]/g, '_');
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}` });
    res.end(buffer);
  }

  @Get(':id/comments')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'ความเห็นภายในของเจ้าหน้าที่ (ประชาชนไม่เห็น)' })
  listComments(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.listComments(id, orgId);
  }

  @Post(':id/comments')
  @RequirePermissions(READ)
  addComment(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any, @Body('body') body: string) {
    return this.service.addComment(id, user, body);
  }

  @Delete(':id/comments/:cid')
  @RequirePermissions(READ)
  deleteComment(@Param('id', ParseUUIDPipe) id: string, @Param('cid', ParseUUIDPipe) cid: string, @CurrentUser() user: any) {
    return this.service.deleteComment(id, cid, user);
  }
}
