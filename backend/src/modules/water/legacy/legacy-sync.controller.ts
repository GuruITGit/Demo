import { Controller, Get, Post, Put, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { WaterAuthGuard } from '../auth/water-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { WaterLegacySyncService } from './legacy-sync.service';

class LegacyConfigDto {
  @IsOptional() @IsString() @MaxLength(200) url?: string;
  @IsOptional() @IsString() @MaxLength(40) org?: string;
  @IsOptional() @IsString() @MaxLength(100) user?: string;
  @IsOptional() @IsString() @MaxLength(200) password?: string;
}

/** อัปเดตข้อมูลประปาจากระบบเดิม — เฉพาะบัญชีบทบาทแอดมินเท่านั้น (สิทธิ์รายโมดูลไม่พอ) */
@ApiTags('water-legacy-sync')
@ApiBearerAuth('access-token')
@Controller('water/legacy-sync')
@UseGuards(WaterAuthGuard)
export class WaterLegacySyncController {
  constructor(private readonly service: WaterLegacySyncService) {}

  private assertAdmin(user: any) {
    if (user?.role !== 'admin') throw new ForbiddenException('เฉพาะแอดมินเท่านั้น');
  }

  @Get()
  @ApiOperation({ summary: 'การตั้งค่า (ไม่มีรหัสผ่าน) + สถานะการอัปเดตล่าสุด' })
  get(@CurrentUser() user: any) {
    this.assertAdmin(user);
    return this.service.getState(user.organizationId);
  }

  @Put()
  @ApiOperation({ summary: 'ตั้งรหัสเข้าระบบเดิม (เว้นรหัสผ่าน = ไม่เปลี่ยน)' })
  save(@CurrentUser() user: any, @Body() dto: LegacyConfigDto) {
    this.assertAdmin(user);
    return this.service.saveConfig(user.organizationId, dto);
  }

  @Post('run')
  @ApiOperation({ summary: 'เริ่มอัปเดตจากระบบเดิม (รันเบื้องหลัง ดูสถานะที่ GET)' })
  run(@CurrentUser() user: any) {
    this.assertAdmin(user);
    return this.service.start(user.organizationId, user.username);
  }
}
