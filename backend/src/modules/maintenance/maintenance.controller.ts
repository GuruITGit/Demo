import { Controller, Post, Get, Body, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { MaintenanceService } from './maintenance.service';
import { PurgeDto } from './dto/purge.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('maintenance')
@ApiBearerAuth('access-token')
@Controller('maintenance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
  constructor(private readonly service: MaintenanceService) {}

  @Get('backup')
  @Roles('SUPER_ADMIN') // เจ้าของระบบเท่านั้น — ADMIN ของ อบต. ล้างข้อมูลไม่ได้ (กู้คืนไม่ได้)
  @ApiOperation({ summary: 'ดาวน์โหลดสำรองข้อมูลธุรกรรม (JSON) ก่อนล้าง' })
  async backup(@CurrentUser() user: any, @Res() res: Response) {
    const data = await this.service.exportBackup(user);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="smartgov-backup-${ts}.json"`,
    });
    res.send(JSON.stringify(data, null, 2));
  }

  @Post('purge')
  @Roles('SUPER_ADMIN') // เจ้าของระบบเท่านั้น — ADMIN ของ อบต. ล้างข้อมูลไม่ได้ (กู้คืนไม่ได้)
  @ApiOperation({ summary: 'ล้างข้อมูล demo (ผู้ดูแลระบบ — ยืนยัน 2 ชั้น)' })
  purge(@Body() dto: PurgeDto, @CurrentUser() user: any) {
    return this.service.purge(dto, user);
  }
}
