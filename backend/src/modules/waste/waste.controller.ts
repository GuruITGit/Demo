import { Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WasteService } from './waste.service';
import { PayConfigService } from '../market/pay-config.service';
import { PayConfigDto } from '../market/dto/market.dto';
import {
  WasteBillQueryDto, WastePayDto, WasteRejectDto, WasteGenerateDto, HouseholdDto, HouseholdImportDto, CreateWasteBillDto,
} from './dto/waste.dto';

/** ค่าเก็บขยะบ้าน (เจ้าหน้าที่) — สิทธิ์ waste:read / waste:manage */
@ApiTags('waste')
@ApiBearerAuth('access-token')
@Controller('waste')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WasteController {
  constructor(private readonly service: WasteService, private readonly config: PayConfigService) {}

  @Get('bills')
  @ApiOperation({ summary: 'ค้นหาบิลค่าขยะบ้าน (บ้านเลขที่+หมู่ / ชื่อ / เบอร์) กรองสถานะ/งวดได้' })
  @RequirePermissions({ module: 'waste', action: 'read', subject: 'WasteBill' })
  search(@CurrentUser('organizationId') orgId: string, @Query() q: WasteBillQueryDto) {
    return this.service.search(orgId, q);
  }

  @Get('summary')
  @ApiOperation({ summary: 'สรุปยอดตามสถานะ + จำนวนครัวเรือน (กรองงวดได้)' })
  @RequirePermissions({ module: 'waste', action: 'read', subject: 'WasteBill' })
  summary(@CurrentUser('organizationId') orgId: string, @Query('period') period?: string) {
    return this.service.summary(orgId, period);
  }

  @Post('bills')
  @ApiOperation({ summary: 'เพิ่มบิลค่าขยะเอง (ย้อนหลัง/พิเศษ)' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  createBill(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateWasteBillDto) {
    return this.service.createBill(orgId, dto);
  }

  @Post('bills/generate')
  @ApiOperation({ summary: 'ออกบิลค่าขยะบ้านประจำงวดให้ทุกครัวเรือนในทะเบียน — รันซ้ำได้ ไม่ออกซ้ำ' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  generate(@CurrentUser('organizationId') orgId: string, @Body() dto: WasteGenerateDto) {
    return this.service.generate(orgId, dto.period);
  }

  @Post('bills/:id/pay')
  @ApiOperation({ summary: 'รับชำระ/ยืนยันสลิปบิลค่าขยะบ้าน' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  pay(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WastePayDto) {
    return this.service.pay(orgId, id, dto.method);
  }

  @Post('bills/:id/reject')
  @ApiOperation({ summary: 'ไม่รับสลิป/ยอดไม่ตรง — ส่งกลับให้ประชาชนแจ้งใหม่' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  reject(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WasteRejectDto) {
    return this.service.reject(orgId, id, dto.note || '');
  }

  @Delete('bills/:id')
  @ApiOperation({ summary: 'ยกเลิกบิลที่ยังไม่ชำระ' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  removeBill(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeBill(orgId, id);
  }

  @Get('config')
  @ApiOperation({ summary: 'ตั้งค่ารับเงิน/ราคา (ชุดเดียวกับค่าแผง — แก้ที่ไหนก็เห็นทั้งสองหน้า)' })
  @RequirePermissions({ module: 'waste', action: 'read', subject: 'WasteBill' })
  getConfig(@CurrentUser('organizationId') orgId: string) {
    return this.config.getForStaff(orgId);
  }

  @Put('config')
  @ApiOperation({ summary: 'บันทึกตั้งค่ารับเงิน/ราคา' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  saveConfig(@CurrentUser('organizationId') orgId: string, @Body() dto: PayConfigDto) {
    return this.config.save(orgId, dto);
  }

  @Get('arrears')
  @ApiOperation({ summary: 'รายงานค้างชำระรายครัวเรือน (กรองงวดได้)' })
  @RequirePermissions({ module: 'waste', action: 'read', subject: 'WasteBill' })
  arrears(@CurrentUser('organizationId') orgId: string, @Query('period') period?: string) {
    return this.service.arrears(orgId, period);
  }

  // ─────────────── ทะเบียนครัวเรือน
  @Get('households')
  @ApiOperation({ summary: 'ทะเบียนครัวเรือน (ค้นด้วยบ้านเลขที่+หมู่ / ชื่อ / เบอร์) พร้อมยอดค้าง' })
  @RequirePermissions({ module: 'waste', action: 'read', subject: 'WasteBill' })
  households(@CurrentUser('organizationId') orgId: string, @Query('q') q?: string) {
    return this.service.listHouseholds(orgId, q);
  }

  @Post('households')
  @ApiOperation({ summary: 'เพิ่มครัวเรือน' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  createHousehold(@CurrentUser('organizationId') orgId: string, @Body() dto: HouseholdDto) {
    return this.service.createHousehold(orgId, dto);
  }

  @Post('households/import')
  @ApiOperation({ summary: 'นำเข้าครัวเรือนเป็นชุด (อัปเดตถ้าบ้านเลขที่+หมู่ซ้ำ)' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  importHouseholds(@CurrentUser('organizationId') orgId: string, @Body() dto: HouseholdImportDto) {
    return this.service.importHouseholds(orgId, dto.rows);
  }

  @Patch('households/:id')
  @ApiOperation({ summary: 'แก้ข้อมูลครัวเรือน/ราคาเฉพาะครัวเรือน' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  updateHousehold(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: HouseholdDto) {
    return this.service.updateHousehold(orgId, id, dto);
  }

  @Delete('households/:id')
  @ApiOperation({ summary: 'ลบครัวเรือนออกจากทะเบียน (ไม่มีบิลค้างเท่านั้น)' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  removeHousehold(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeHousehold(orgId, id);
  }
}
