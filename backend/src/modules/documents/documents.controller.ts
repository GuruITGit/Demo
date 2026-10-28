import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, ParseUUIDPipe, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { DocumentQueryDto } from './dto/document-query.dto';
import { CreateFromTextDto } from './dto/document.dto';

@ApiTags('documents')
@ApiBearerAuth('access-token')
@Controller('documents')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @RequirePermissions({ module: 'dms', action: 'read', subject: 'Document' })
  @ApiOperation({ summary: 'รายการเอกสาร' })
  findAll(@CurrentUser('organizationId') orgId: string, @CurrentUser() user: any, @Query() dto: DocumentQueryDto) {
    return this.service.findAll(orgId, dto, user);
  }

  @Get('categories')
  @RequirePermissions({ module: 'dms', action: 'read', subject: 'Document' })
  @ApiOperation({ summary: 'หมวดหมู่เอกสาร' })
  getCategories(@CurrentUser('organizationId') orgId: string) {
    return this.service.getCategories(orgId);
  }

  @Post('categories')
  @RequirePermissions({ module: 'settings', action: 'manage', subject: 'SystemSetting' })
  @ApiOperation({ summary: 'เพิ่มหมวดหมู่เอกสาร (admin)' })
  createCategory(@Body() dto: any, @CurrentUser('organizationId') orgId: string) {
    return this.service.createCategory(dto, orgId);
  }

  @Put('categories/:id')
  @RequirePermissions({ module: 'settings', action: 'manage', subject: 'SystemSetting' })
  @ApiOperation({ summary: 'แก้ไขหมวดหมู่เอกสาร (admin)' })
  updateCategory(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any, @CurrentUser('organizationId') orgId: string) {
    return this.service.updateCategory(id, dto, orgId);
  }

  @Delete('categories/:id')
  @RequirePermissions({ module: 'settings', action: 'manage', subject: 'SystemSetting' })
  @ApiOperation({ summary: 'ลบหมวดหมู่เอกสาร (admin)' })
  deleteCategory(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.deleteCategory(id, orgId);
  }

  @Get('stats')
  @RequirePermissions({ module: 'dms', action: 'read', subject: 'Document' })
  @ApiOperation({ summary: 'สถิติเอกสาร' })
  getStats(@CurrentUser('organizationId') orgId: string) {
    return this.service.getStats(orgId);
  }

  @Get(':id')
  @RequirePermissions({ module: 'dms', action: 'read', subject: 'Document' })
  @ApiOperation({ summary: 'รายละเอียดเอกสาร' })
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.findOne(id, orgId, user);
  }

  @Post('from-text')
  @RequirePermissions({ module: 'dms', action: 'create', subject: 'Document' })
  @ApiOperation({ summary: 'สร้างเอกสารจากข้อความ' })
  createFromText(@Body() dto: CreateFromTextDto, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.createFromText(dto, orgId, userId);
  }

  @Post()
  @RequirePermissions({ module: 'dms', action: 'create', subject: 'Document' })
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'อัปโหลดเอกสาร' })
  upload(@UploadedFile() file: Express.Multer.File, @Body() dto: any, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.upload(dto, orgId, userId, file);
  }

  @Put(':id')
  @RequirePermissions({ module: 'dms', action: 'update', subject: 'Document' })
  @ApiOperation({ summary: 'แก้ไขข้อมูลเอกสาร' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: any, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.update(id, dto, orgId, user);
  }

  @Delete(':id')
  @RequirePermissions({ module: 'dms', action: 'read', subject: 'Document' })
  @ApiOperation({ summary: 'ลบเอกสาร (เจ้าของหรือผู้ดูแลระบบ)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser() user: any) {
    return this.service.softDelete(id, orgId, user);
  }

  @Get(':id/download')
  @RequirePermissions({ module: 'dms', action: 'read', subject: 'Document' })
  @ApiOperation({ summary: 'ดาวน์โหลดเอกสาร' })
  download(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.download(id, orgId, userId);
  }

  @Post(':id/versions')
  @RequirePermissions({ module: 'dms', action: 'update', subject: 'Document' })
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'อัปโหลดเวอร์ชั่นใหม่' })
  addVersion(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: Express.Multer.File, @Body('note') note: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.addVersion(id, orgId, userId, file, note);
  }

  @Get(':id/versions')
  @RequirePermissions({ module: 'dms', action: 'read', subject: 'Document' })
  @ApiOperation({ summary: 'รายการเวอร์ชั่น' })
  getVersions(@Param('id', ParseUUIDPipe) id: string) { return this.service.getVersions(id); }
}
