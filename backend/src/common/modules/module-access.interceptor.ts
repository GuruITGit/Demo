import { CallHandler, ExecutionContext, ForbiddenException, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ModuleAccessService } from './module-access.service';
import { resolveModuleFromPath, TOGGLEABLE_MODULES } from './module-registry';

/**
 * บล็อก API ของโมดูลที่หน่วยงานนั้น "ปิดใช้งาน" ไว้ — ชั้นบังคับใช้จริงฝั่ง backend
 * (คู่กับการซ่อนเมนูฝั่ง frontend) กันคนยิง API ตรงแม้เมนูจะถูกซ่อน
 *
 * ใช้ interceptor (ไม่ใช่ global guard) เพราะต้องรัน "หลัง" JwtAuthGuard/WaterAuthGuard
 * เพื่ออ่าน req.user.organizationId ที่ guard ตั้งไว้ · route สาธารณะ → resolve org จาก Host
 * หา org ไม่ได้ (ก่อนล็อกอิน ไม่มีโดเมน) → ปล่อยผ่าน (หน้า login ของแต่ละส่วนกันเอง)
 */
@Injectable()
export class ModuleAccessInterceptor implements NestInterceptor {
  private readonly labels = new Map(TOGGLEABLE_MODULES.map((m) => [m.key, m.label]));

  constructor(private readonly access: ModuleAccessService) {}

  async intercept(ctx: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest();
    const moduleKey = resolveModuleFromPath(req.originalUrl || req.url || '');
    if (!moduleKey) return next.handle();

    let orgId: string | null = req.user?.organizationId ?? null;
    if (!orgId) {
      const host = (req.headers?.['x-forwarded-host'] as string) || req.headers?.host;
      orgId = await this.access.orgIdByHost(host);
    }
    if (!orgId) return next.handle();

    if (!(await this.access.isEnabled(orgId, moduleKey))) {
      throw new ForbiddenException(`หน่วยงานนี้ไม่ได้เปิดใช้งานโมดูล "${this.labels.get(moduleKey) || moduleKey}"`);
    }
    return next.handle();
  }
}
