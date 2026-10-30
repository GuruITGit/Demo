import { Controller, Get, Post, Put, Patch, Delete, Param, Query, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MarketService } from './market.service';
import { MarketBillQueryDto, PayBillDto, UpdateStallDto, RejectBillDto, GenerateBillsDto, PayConfigDto, CreateStallDto, BulkStallsDto, ZoneRateDto, CreateMarketBillDto } from './dto/market.dto';
import { PayConfigService } from './pay-config.service';

/** ค่าแผงตลาด (เจ้าหน้าที่) — สิทธิ์ market:read / market:manage */
@ApiTags('market')
@ApiBearerAuth('access-token')
@Controller('market')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MarketController {
  constructor(private readonly service: MarketService, private readonly config: PayConfigService) {}

  @Get('stalls')
  @ApiOperation({ summary: 'ผังแผงประจำ พร้อมสถานะและผู้เช่า' })
  @RequirePermissions({ module: 'market', action: 'read', subject: 'MarketStall' })
  stalls(@CurrentUser('organizationId') orgId: string) {
    return this.service.listStalls(orgId);
  }

  @Patch('stalls/:id')
  @ApiOperation({ summary: 'แก้ไขแผง: สถานะ ผู้จอง-ผู้เช่า ค่าเช่า' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketStall' })
  updateStall(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStallDto) {
    return this.service.updateStall(orgId, id, dto);
  }

  @Get('bills')
  @ApiOperation({ summary: 'บิลค่าแผง กรองตามสถานะ/งวด/รหัสแผง' })
  @RequirePermissions({ module: 'market', action: 'read', subject: 'MarketBill' })
  bills(@CurrentUser('organizationId') orgId: string, @Query() q: MarketBillQueryDto) {
    return this.service.listBills(orgId, q);
  }

  @Post('bills/:id/pay')
  @ApiOperation({ summary: 'รับชำระบิลค่าแผง (เงินสด/สแกน/โอน)' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketBill' })
  pay(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PayBillDto) {
    return this.service.pay(orgId, id, dto.method);
  }

  @Post('stalls')
  @ApiOperation({ summary: 'เพิ่มแผงทีละล็อก' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketStall' })
  createStall(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateStallDto) {
    return this.service.createStall(orgId, dto);
  }

  @Post('stalls/bulk')
  @ApiOperation({ summary: 'เพิ่มแผงเป็นช่วงในโซน (เช่น D01–D20)' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketStall' })
  bulkStalls(@CurrentUser('organizationId') orgId: string, @Body() dto: BulkStallsDto) {
    return this.service.bulkCreateStalls(orgId, dto);
  }

  @Post('zones/rate')
  @ApiOperation({ summary: 'ตั้งค่าเช่าทั้งโซน (มีผลกับบิลที่ออกต่อจากนี้)' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketStall' })
  zoneRate(@CurrentUser('organizationId') orgId: string, @Body() dto: ZoneRateDto) {
    return this.service.setZoneRate(orgId, dto.zone, dto.monthlyRate);
  }

  @Delete('stalls/:id')
  @ApiOperation({ summary: 'ลบแผง (ไม่มีบิลค้างเท่านั้น)' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketStall' })
  removeStall(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeStall(orgId, id);
  }

  @Post('bills')
  @ApiOperation({ summary: 'เพิ่มบิลค่าแผงเอง (ย้อนหลัง/พิเศษ)' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketBill' })
  createBill(@CurrentUser('organizationId') orgId: string, @Body() dto: CreateMarketBillDto) {
    return this.service.createBill(orgId, dto);
  }

  @Delete('bills/:id')
  @ApiOperation({ summary: 'ยกเลิกบิลที่ยังไม่ชำระ' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketBill' })
  removeBill(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeBill(orgId, id);
  }

  @Post('bills/generate')
  @ApiOperation({ summary: 'ออกบิลค่าเช่า+ค่าขยะแผงประจำงวด (แผงที่มีผู้เช่า) — รันซ้ำได้ ไม่ออกซ้ำ' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketBill' })
  generate(@CurrentUser('organizationId') orgId: string, @Body() dto: GenerateBillsDto) {
    return this.service.generate(orgId, dto.period);
  }

  @Post('bills/:id/reject')
  @ApiOperation({ summary: 'ไม่รับสลิป/ยอดไม่ตรง — ส่งกลับให้ประชาชนแจ้งใหม่' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketBill' })
  reject(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectBillDto) {
    return this.service.reject(orgId, id, dto.note || '');
  }

  @Get('bills/:id/receipt')
  @ApiOperation({ summary: 'ข้อมูลใบเสร็จของบิลที่ชำระแล้ว (พิมพ์จากหน้าเจ้าหน้าที่)' })
  @RequirePermissions({ module: 'market', action: 'read', subject: 'MarketBill' })
  receipt(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.receipt(orgId, id);
  }

  @Get('summary')
  @ApiOperation({ summary: 'สรุปยอดตามสถานะ + ค้างรายแผง (กรองงวดได้)' })
  @RequirePermissions({ module: 'market', action: 'read', subject: 'MarketBill' })
  summary(@CurrentUser('organizationId') orgId: string, @Query('period') period?: string) {
    return this.service.summary(orgId, period);
  }

  @Get('config')
  @ApiOperation({ summary: 'ตั้งค่ารับเงิน/ราคาค่าแผง-ค่าขยะ ของ อบต.' })
  @RequirePermissions({ module: 'market', action: 'read', subject: 'MarketBill' })
  getConfig(@CurrentUser('organizationId') orgId: string) {
    return this.config.getForStaff(orgId);
  }

  @Put('config')
  @ApiOperation({ summary: 'บันทึกตั้งค่ารับเงิน/ราคา (ใช้ร่วมกับค่าขยะบ้าน)' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketStall' })
  saveConfig(@CurrentUser('organizationId') orgId: string, @Body() dto: PayConfigDto) {
    return this.config.save(orgId, dto);
  }
}
