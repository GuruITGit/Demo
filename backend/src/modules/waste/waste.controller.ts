import { Controller, Get, Post, Param, Query, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WasteService } from './waste.service';
import { WasteBillQueryDto, WastePayDto } from './dto/waste.dto';

/** ค่าเก็บขยะบ้าน (เจ้าหน้าที่) — สิทธิ์ waste:read / waste:manage */
@ApiTags('waste')
@ApiBearerAuth('access-token')
@Controller('waste')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WasteController {
  constructor(private readonly service: WasteService) {}

  @Get('bills')
  @ApiOperation({ summary: 'ค้นหาบิลค่าขยะบ้าน (บ้านเลขที่+หมู่ / ชื่อ / เบอร์)' })
  @RequirePermissions({ module: 'waste', action: 'read', subject: 'WasteBill' })
  search(@CurrentUser('organizationId') orgId: string, @Query() q: WasteBillQueryDto) {
    return this.service.search(orgId, q);
  }

  @Get('summary')
  @ApiOperation({ summary: 'สรุปยอดค้างค่าขยะบ้าน (หน้าหลัก)' })
  @RequirePermissions({ module: 'waste', action: 'read', subject: 'WasteBill' })
  summary(@CurrentUser('organizationId') orgId: string) {
    return this.service.summary(orgId);
  }

  @Post('bills/:id/pay')
  @ApiOperation({ summary: 'รับชำระบิลค่าขยะบ้าน' })
  @RequirePermissions({ module: 'waste', action: 'manage', subject: 'WasteBill' })
  pay(@CurrentUser('organizationId') orgId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: WastePayDto) {
    return this.service.pay(orgId, id, dto.method);
  }
}
