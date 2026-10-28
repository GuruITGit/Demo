import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WaterUsersService } from './water-users.service';
import { WaterAuthGuard, WaterCapGuard } from './water-auth.guard';
import { RequireWaterCap } from './water-cap.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('water-users')
@Controller('water/users')
@UseGuards(WaterAuthGuard, WaterCapGuard)
export class WaterUsersController {
  constructor(private readonly service: WaterUsersService) {}

  @Get()
  @RequireWaterCap('users')
  @ApiOperation({ summary: 'รายชื่อผู้ใช้ระบบประปา' })
  list(@CurrentUser('organizationId') orgId: string) {
    return this.service.list(orgId);
  }

  @Post()
  @RequireWaterCap('users')
  @ApiOperation({ summary: 'สร้างผู้ใช้ระบบประปา' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: any) {
    return this.service.create(orgId, dto);
  }

  @Put(':id')
  @RequireWaterCap('users')
  @ApiOperation({ summary: 'แก้ไขผู้ใช้ (role/สิทธิ์/สถานะ/รหัสผ่าน)' })
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @Body() dto: any) {
    return this.service.update(id, orgId, dto);
  }

  @Delete(':id')
  @RequireWaterCap('users')
  @ApiOperation({ summary: 'ลบผู้ใช้' })
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string, @CurrentUser('id') me: string) {
    return this.service.remove(id, orgId, me);
  }
}
