import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsInt, IsBoolean, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { WaterMasterService } from './water-master.service';
import { WaterAuthGuard, WaterCapGuard } from './auth/water-auth.guard';
import { RequireWaterCap } from './auth/water-cap.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class MasterDto {
  @IsString() @IsNotEmpty() type: string;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsString() @IsNotEmpty({ message: 'กรุณากรอกชื่อ' }) @MaxLength(200) name: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) value?: number;
  @IsOptional() config?: any;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** ข้อมูลพื้นฐาน (master) กองการประปา — หมู่/เส้นทาง/ช่องทาง/ส่วนลด/ขนาดมิเตอร์/ประเภทผู้ใช้/สถานะ */
@ApiTags('water-master')
@ApiBearerAuth('access-token')
@Controller('water/master')
@UseGuards(WaterAuthGuard, WaterCapGuard)
export class WaterMasterController {
  constructor(private readonly service: WaterMasterService) {}

  @Get()
  @ApiOperation({ summary: 'รายการ master ตามประเภท (type=area|route|payment_channel|discount|meter_size|user_type|usage_status)' })
  @RequireWaterCap('customers', 'settings', 'reading', 'payment', 'reports')
  list(@CurrentUser('organizationId') orgId: string, @Query('type') type: string) {
    return this.service.list(orgId, type);
  }

  @Post()
  @ApiOperation({ summary: 'เพิ่มข้อมูลพื้นฐาน' })
  @RequireWaterCap('settings')
  create(@Body() dto: MasterDto, @CurrentUser('organizationId') orgId: string) {
    return this.service.create(orgId, dto as any);
  }

  @Post('seed')
  @ApiOperation({ summary: 'ดึงค่าที่มีจริงจากทะเบียนผู้ใช้น้ำมาเติม master (idempotent)' })
  @RequireWaterCap('settings')
  seed(@CurrentUser('organizationId') orgId: string, @Query('type') type: string) {
    return this.service.seedFromCustomers(orgId, type);
  }

  @Put(':id')
  @ApiOperation({ summary: 'แก้ไขข้อมูลพื้นฐาน' })
  @RequireWaterCap('settings')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MasterDto, @CurrentUser('organizationId') orgId: string) {
    return this.service.update(id, orgId, dto as any);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบข้อมูลพื้นฐาน' })
  @RequireWaterCap('settings')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser('organizationId') orgId: string) {
    return this.service.remove(id, orgId);
  }
}
