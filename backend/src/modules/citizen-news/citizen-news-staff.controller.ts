import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards,
  UseInterceptors, UploadedFile, ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CitizenNewsService } from './citizen-news.service';

const cover = () => FileInterceptor('cover', { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** จัดการข่าว/ประกาศ (เจ้าหน้าที่) — สิทธิ์ news:read / news:manage */
@ApiTags('citizen-news-staff')
@ApiBearerAuth('access-token')
@Controller('news')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CitizenNewsStaffController {
  constructor(private readonly service: CitizenNewsService) {}

  @Get()
  @ApiOperation({ summary: 'รายการข่าวทั้งหมด (รวมฉบับร่าง)' })
  @RequirePermissions({ module: 'news', action: 'read', subject: 'News' })
  list(@CurrentUser('organizationId') orgId: string, @Query('status') status?: string) {
    return this.service.listStaff(orgId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'รายละเอียดข่าว (เจ้าหน้าที่)' })
  @RequirePermissions({ module: 'news', action: 'read', subject: 'News' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.detailStaff(id, orgId);
  }

  @Post()
  @ApiOperation({ summary: 'สร้างข่าว/ประกาศ' })
  @RequirePermissions({ module: 'news', action: 'manage', subject: 'News' })
  @UseInterceptors(cover())
  create(@Body() body: any, @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser('organizationId') orgId: string, @CurrentUser('id') userId: string) {
    return this.service.create(body, file, orgId, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'แก้ไขข่าว/ประกาศ' })
  @RequirePermissions({ module: 'news', action: 'manage', subject: 'News' })
  @UseInterceptors(cover())
  update(@Param('id', ParseUUIDPipe) id: string, @Body() body: any,
    @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser('organizationId') orgId: string) {
    return this.service.update(id, body, file, orgId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบข่าว/ประกาศ' })
  @RequirePermissions({ module: 'news', action: 'manage', subject: 'News' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.remove(id, orgId);
  }
}
