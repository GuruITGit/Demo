import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MarketService } from './market.service';
import { MarketBillQueryDto, PayBillDto, UpdateStallDto } from './dto/market.dto';

/** ค่าแผงตลาด (เจ้าหน้าที่) — สิทธิ์ market:read / market:manage */
@ApiTags('market')
@ApiBearerAuth('access-token')
@Controller('market')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MarketController {
  constructor(private readonly service: MarketService) {}

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
}
