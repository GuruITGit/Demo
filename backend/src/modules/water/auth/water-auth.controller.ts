import { Controller, Post, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WaterAuthService } from './water-auth.service';
import { WaterAuthGuard } from './water-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('water-auth')
@Controller('water/auth')
export class WaterAuthController {
  constructor(private readonly service: WaterAuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'เข้าสู่ระบบประปา (บัญชีแยกจากระบบหลัก)' })
  login(@Body() body: { orgCode: string; username: string; password: string }) {
    return this.service.login(body?.orgCode, body?.username, body?.password);
  }

  @Get('me')
  @UseGuards(WaterAuthGuard)
  @ApiOperation({ summary: 'ข้อมูลบัญชีประปาที่ล็อกอินอยู่' })
  me(@CurrentUser('id') id: string) {
    return this.service.me(id);
  }

  @Get('org')
  @UseGuards(WaterAuthGuard)
  @ApiOperation({ summary: 'ข้อมูลหน่วยงาน (ชื่อ/โลโก้) ของบัญชีที่ล็อกอิน — ใช้แสดงบนแถบบน' })
  org(@CurrentUser('organizationId') orgId: string) {
    return this.service.org(orgId);
  }

  @Put('me/password')
  @UseGuards(WaterAuthGuard)
  @ApiOperation({ summary: 'เปลี่ยนรหัสผ่านตัวเอง' })
  changePassword(@CurrentUser('id') id: string, @Body() body: { oldPassword: string; newPassword: string }) {
    return this.service.changePassword(id, body?.oldPassword, body?.newPassword);
  }
}
