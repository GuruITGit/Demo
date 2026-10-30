import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MarketOutsideService } from './market-outside.service';
import { OutsideCollectionDto, OutsideLocationDto } from './dto/market.dto';

/** แผงลอย (เจ้าหน้าที่) — จุดเก็บค่าที่นอกผังประจำ · สิทธิ์ market:read / market:manage */
@ApiTags('market')
@ApiBearerAuth('access-token')
@Controller('market/outside')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MarketOutsideController {
  constructor(private readonly service: MarketOutsideService) {}

  @Get('locations')
  @ApiOperation({ summary: 'จุดแผงลอยทั้งหมด' })
  @RequirePermissions({ module: 'market', action: 'read', subject: 'MarketStall' })
  list(@CurrentUser('organizationId') orgId: string) {
    return this.service.list(orgId);
  }

  @Post('locations')
  @ApiOperation({ summary: 'เปิดจุดแผงลอยใหม่' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketStall' })
  create(@CurrentUser('organizationId') orgId: string, @Body() dto: OutsideLocationDto) {
    return this.service.create(orgId, dto);
  }

  @Patch('locations/:id')
  @ApiOperation({ summary: 'แก้ชื่อ/ค่าเช่า/เปิด-ปิดจุดแผงลอย' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketStall' })
  update(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: OutsideLocationDto) {
    return this.service.update(orgId, id, dto);
  }

  @Delete('locations/:id')
  @ApiOperation({ summary: 'ลบจุดแผงลอย (เก็บประวัติรายการเก็บเงิน)' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketStall' })
  remove(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(orgId, id);
  }

  @Get('collections')
  @ApiOperation({ summary: 'รายการเก็บเงินแผงลอย (กรองจุด/ช่วงวันที่) พร้อมยอดรวม' })
  @RequirePermissions({ module: 'market', action: 'read', subject: 'MarketBill' })
  collections(@CurrentUser('organizationId') orgId: string, @Query('locationId') locationId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    return this.service.collections(orgId, locationId, from, to);
  }

  @Post('collections')
  @ApiOperation({ summary: 'บันทึกการเก็บเงินแผงลอยหน้างาน (ออกเลขใบเสร็จ)' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketBill' })
  collect(@CurrentUser('organizationId') orgId: string, @Body() dto: OutsideCollectionDto) {
    return this.service.collect(orgId, dto);
  }

  @Delete('collections/:id')
  @ApiOperation({ summary: 'ลบรายการเก็บเงิน (บันทึกผิด)' })
  @RequirePermissions({ module: 'market', action: 'manage', subject: 'MarketBill' })
  removeCollection(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeCollection(orgId, id);
  }
}
