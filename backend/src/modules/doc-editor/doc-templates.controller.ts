import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocTemplatesService } from './doc-templates.service';

const READ = { module: 'correspondence', action: 'read', subject: 'Ticket' };
/** บันทึก/ลบแม่แบบ = ผู้ดูแลระบบของ อบต. */
const MANAGE = { module: 'settings', action: 'manage', subject: 'SystemSetting' };

/** แม่แบบเอกสาร + เอกสารที่ร่างใหม่ในเรื่องสารบรรณ — path ขึ้นต้น correspondence (ปิดตามโมดูลสารบรรณ) */
@ApiTags('correspondence-doc-editor')
@ApiBearerAuth('access-token')
@Controller('correspondence')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocTemplatesController {
  constructor(private readonly service: DocTemplatesService) {}

  @Get('doc-templates')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'แม่แบบเอกสาร (มาตรฐาน + ของหน่วยงาน) — category=overlay|document' })
  list(@CurrentUser() user: any, @Query('category') category?: string) {
    return this.service.listTemplates(user, category);
  }

  @Post('doc-templates')
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: 'บันทึกแม่แบบใหม่ของหน่วยงาน (ผู้ดูแลระบบ)' })
  create(@CurrentUser() user: any, @Body() dto: any) {
    return this.service.createTemplate(user, dto);
  }

  @Delete('doc-templates/:tid')
  @RequirePermissions(MANAGE)
  @ApiOperation({ summary: 'ลบแม่แบบของหน่วยงาน (แม่แบบมาตรฐานลบไม่ได้)' })
  remove(@CurrentUser() user: any, @Param('tid', ParseUUIDPipe) tid: string) {
    return this.service.deleteTemplate(user, tid);
  }

  @Get('tickets/:id/documents')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'เอกสารที่ร่างในเรื่องนี้' })
  listDocs(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.service.listDocs(id, user);
  }

  @Post('tickets/:id/documents')
  @RequirePermissions(READ)
  @ApiOperation({ summary: 'ร่างเอกสารใหม่ (จากแม่แบบ templateId หรือหน้าเปล่า)' })
  createDoc(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.service.createDoc(id, user, dto);
  }

  @Get('tickets/:id/documents/:docId')
  @RequirePermissions(READ)
  getDoc(@Param('id', ParseUUIDPipe) id: string, @Param('docId', ParseUUIDPipe) docId: string, @CurrentUser() user: any) {
    return this.service.getDocFull(id, docId, user);
  }

  @Put('tickets/:id/documents/:docId')
  @RequirePermissions(READ)
  updateDoc(@Param('id', ParseUUIDPipe) id: string, @Param('docId', ParseUUIDPipe) docId: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.service.updateDoc(id, docId, user, dto);
  }

  @Delete('tickets/:id/documents/:docId')
  @RequirePermissions(READ)
  deleteDoc(@Param('id', ParseUUIDPipe) id: string, @Param('docId', ParseUUIDPipe) docId: string, @CurrentUser() user: any) {
    return this.service.deleteDoc(id, docId, user);
  }
}
