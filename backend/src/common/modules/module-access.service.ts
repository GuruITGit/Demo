import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * อ่าน "โมดูลที่ปิดของแต่ละ อบต." + resolve org จากโดเมน — มี cache ในหน่วยความจำ (TTL สั้น)
 * กัน DB โดนยิงทุก request · SUPER_ADMIN สลับปุ่มแล้ว invalidate ให้เห็นผลทันที (ไม่ต้องรอ TTL)
 */
@Injectable()
export class ModuleAccessService {
  private disabledCache = new Map<string, { v: Set<string>; exp: number }>();
  private hostCache = new Map<string, { v: string | null; exp: number }>();
  private readonly DISABLED_TTL = 30_000;
  private readonly HOST_TTL = 60_000;

  constructor(@InjectDataSource() private ds: DataSource) {}

  /** เซ็ตคีย์โมดูลที่ "ปิด" ของหน่วยงานนี้ */
  async disabledFor(orgId: string): Promise<Set<string>> {
    const now = Date.now();
    const hit = this.disabledCache.get(orgId);
    if (hit && hit.exp > now) return hit.v;
    const [row] = await this.ds.query(`SELECT metadata FROM organizations WHERE id = $1`, [orgId]);
    const arr: string[] = Array.isArray(row?.metadata?.disabledModules) ? row.metadata.disabledModules : [];
    const set = new Set(arr);
    this.disabledCache.set(orgId, { v: set, exp: now + this.DISABLED_TTL });
    return set;
  }

  /** โมดูลนี้เปิดอยู่ไหมสำหรับ อบต. นี้ */
  async isEnabled(orgId: string, moduleKey: string): Promise<boolean> {
    return !(await this.disabledFor(orgId)).has(moduleKey);
  }

  /** resolve org จาก Host header (สำหรับ route สาธารณะที่ยังไม่ล็อกอิน เช่น เว็บประชาชน) */
  async orgIdByHost(host?: string): Promise<string | null> {
    const h = String(host || '').toLowerCase().split(':')[0].replace(/^www\./, '').trim();
    if (!h) return null;
    const now = Date.now();
    const hit = this.hostCache.get(h);
    if (hit && hit.exp > now) return hit.v;
    const [row] = await this.ds.query(
      `SELECT id FROM organizations WHERE is_active = true AND $1 = ANY(hostnames) LIMIT 1`, [h]);
    const id = row?.id ?? null;
    this.hostCache.set(h, { v: id, exp: now + this.HOST_TTL });
    return id;
  }

  /** ล้าง cache เมื่อ SUPER_ADMIN สลับปุ่มเปิด-ปิดโมดูล */
  invalidate(orgId?: string) {
    if (orgId) this.disabledCache.delete(orgId);
    else this.disabledCache.clear();
  }
}
