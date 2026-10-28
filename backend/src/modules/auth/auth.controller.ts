import {
  Controller, Post, Get, Put, Patch, Body, Req, Res, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'เข้าสู่ระบบ' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
    return this.authService.login(dto, ip, ua, host);
  }

  @Public()
  @Post('hub-login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'เข้าสู่คอนโซลผู้ดูแลระบบ (/hub) — เฉพาะบัญชี SUPER_ADMIN ไม่ผูกกับ อบต. ใด' })
  async hubLogin(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const ua = req.headers['user-agent'] || '';
    return this.authService.login(dto, ip, ua, undefined, { superAdminOnly: true });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ต่ออายุ Access Token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const ip = req.ip || '';
    const ua = req.headers['user-agent'] || '';
    return this.authService.refreshTokens(dto.refreshToken, ip, ua);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'ออกจากระบบ' })
  async logout(
    @CurrentUser('id') userId: string,
    @Body() body: { refreshToken?: string },
    @Req() req: Request,
  ) {
    const ip = req.ip || '';
    const ua = req.headers['user-agent'] || '';
    await this.authService.logout(userId, body?.refreshToken, ip, ua);
    return { message: 'ออกจากระบบสำเร็จ' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'ออกจากระบบทุกอุปกรณ์' })
  async logoutAll(@CurrentUser('id') userId: string) {
    await this.authService.logoutAll(userId);
    return { message: 'ออกจากระบบทุกอุปกรณ์สำเร็จ' };
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'ข้อมูลผู้ใช้ปัจจุบัน' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Get('me/login-history')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'ประวัติการเข้าสู่ระบบล่าสุด (โปรไฟล์/ความปลอดภัย)' })
  async loginHistory(@CurrentUser('id') userId: string) {
    return this.authService.getLoginHistory(userId);
  }

  @Get('me/activity')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'กิจกรรมล่าสุดของฉัน (โปรไฟล์)' })
  async myActivity(@CurrentUser('id') userId: string) {
    return this.authService.getMyActivity(userId);
  }

  @Put('me/password')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'เปลี่ยนรหัสผ่าน' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(userId, dto);
    return { message: 'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่' };
  }

  @Patch('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'แก้ไขข้อมูลส่วนตัว' })
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: { fullNameTh?: string; fullNameEn?: string; titleTh?: string; phone?: string; avatarUrl?: string; signatureImage?: string | null },
  ) {
    return this.authService.updateMe(userId, dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'ลืมรหัสผ่าน' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return { message: 'หากอีเมลนี้มีในระบบ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'รีเซ็ตรหัสผ่าน' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return { message: 'รีเซ็ตรหัสผ่านสำเร็จ' };
  }
}
