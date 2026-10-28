import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('settings')
@ApiBearerAuth('access-token')
@Controller('settings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  @Get()
  @RequirePermissions({ module: 'settings', action: 'read', subject: 'SystemSetting' })
  @ApiOperation({ summary: 'รายการการตั้งค่าทั้งหมด' })
  findAll(@CurrentUser('organizationId') orgId: string) {
    return this.service.findAll(orgId);
  }

  @Get(':key')
  @RequirePermissions({ module: 'settings', action: 'read', subject: 'SystemSetting' })
  @ApiOperation({ summary: 'ดูการตั้งค่าตาม key' })
  findOne(@Param('key') key: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.findOne(key, orgId);
  }

  @Patch(':key')
  @RequirePermissions({ module: 'settings', action: 'manage', subject: 'SystemSetting' })
  @ApiOperation({ summary: 'อัปเดตการตั้งค่า' })
  update(
    @Param('key') key: string,
    @Body('value') value: string,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('id') userId: string,
  ) { return this.service.update(key, value, orgId, userId); }
}
