import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * ลบฟิลด์ที่ "เซิร์ฟเวอร์เป็นผู้กำหนดเท่านั้น" ออกจาก request body ทุก request
 * — ป้องกัน mass assignment ผ่านหลาย endpoint ที่รับ `@Body() dto: any` แล้ว
 *   spread `...dto` / `Object.assign(entity, dto)` เข้า save() (client แนบ id
 *   เพื่อทับ record อื่น, แนบ organizationId เพื่อย้ายข้ามหน่วยงาน, ปลอม createdBy ฯลฯ)
 * ทำงานเฉพาะ top-level ของ body ที่เป็นอ็อบเจ็กต์ธรรมดา (ไม่ยุ่งกับ jsonb ที่ซ้อนอยู่ข้างใน)
 */
const FORBIDDEN_BODY_KEYS = [
  'id',
  'organizationId', 'organization_id',
  'createdBy', 'created_by', 'createdById',
  'updatedBy', 'updated_by',
  'deletedAt', 'deleted_at',
  'passwordHash', 'password_hash',
];

@Injectable()
export class StripServerFieldsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const body = req?.body;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      for (const key of FORBIDDEN_BODY_KEYS) {
        if (key in body) delete body[key];
      }
    }
    return next.handle();
  }
}
