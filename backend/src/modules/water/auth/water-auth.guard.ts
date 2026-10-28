import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { WATER_CAP_KEY } from './water-cap.decorator';
import { WaterCap, WaterRole } from '../../../database/entities/water-user.entity';

/**
 * ตรวจ JWT ของระบบประปา (typ='water') — แยกจาก JwtAuthGuard ของระบบหลักโดยสิ้นเชิง
 * ตั้ง req.user = { id, organizationId, role, caps, username } ให้ @CurrentUser ใช้ได้เหมือนเดิม
 */
@Injectable()
export class WaterAuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth: string = req.headers?.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) throw new UnauthorizedException('กรุณาเข้าสู่ระบบประปาก่อน');
    let payload: any;
    try { payload = await this.jwt.verifyAsync(token); } catch { throw new UnauthorizedException('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'); }
    if (payload?.typ !== 'water') throw new UnauthorizedException('โทเคนไม่ถูกต้องสำหรับระบบประปา');
    req.user = {
      id: payload.sub, organizationId: payload.org, username: payload.username,
      role: payload.role as WaterRole, caps: (payload.caps || []) as WaterCap[],
    };
    return true;
  }
}

/** ตรวจ capability ต่อโมดูล (admin ผ่านหมด) — ใช้คู่ @RequireWaterCap */
@Injectable()
export class WaterCapGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const caps = this.reflector.getAllAndOverride<WaterCap[]>(WATER_CAP_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!caps || caps.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    if (!user) return false;
    const has = user.caps || [];
    if (user.role === 'admin' || caps.some((c) => has.includes(c))) return true;
    throw new ForbiddenException('บัญชีนี้ไม่มีสิทธิ์ใช้งานส่วนนี้');
  }
}
