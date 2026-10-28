import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WaterMaster, WaterMasterType } from '../../database/entities/water-master.entity';

const TYPES: WaterMasterType[] = ['area', 'route', 'payment_channel', 'discount', 'meter_size', 'user_type', 'usage_status'];

/** CRUD ข้อมูลพื้นฐาน (master) กองการประปา — ตัวเดียวครอบทุกประเภท */
@Injectable()
export class WaterMasterService {
  constructor(@InjectRepository(WaterMaster) private repo: Repository<WaterMaster>) {}

  private assertType(t: string) {
    if (!TYPES.includes(t as WaterMasterType)) throw new BadRequestException('ประเภทข้อมูลพื้นฐานไม่ถูกต้อง');
  }

  async list(orgId: string, type: string) {
    this.assertType(type);
    return this.repo.find({ where: { organizationId: orgId, type: type as WaterMasterType }, order: { sortOrder: 'ASC', code: 'ASC' } });
  }

  async create(orgId: string, dto: Partial<WaterMaster>) {
    this.assertType(dto.type as string);
    if (!dto.name?.trim()) throw new BadRequestException('กรุณากรอกชื่อ');
    return this.repo.save(this.repo.create({
      organizationId: orgId, type: dto.type, code: dto.code?.trim() || null,
      name: dto.name.trim(), value: dto.value ?? null, config: dto.config ?? null,
      sortOrder: dto.sortOrder ?? 0, active: dto.active ?? true,
    } as any));
  }

  async update(id: string, orgId: string, dto: Partial<WaterMaster>) {
    const m = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!m) throw new NotFoundException('ไม่พบข้อมูล');
    if (dto.code !== undefined) m.code = dto.code?.trim() || null;
    if (dto.name !== undefined) m.name = dto.name.trim();
    if (dto.value !== undefined) m.value = dto.value as any;
    if (dto.config !== undefined) m.config = dto.config;
    if (dto.sortOrder !== undefined) m.sortOrder = dto.sortOrder;
    if (dto.active !== undefined) m.active = dto.active;
    return this.repo.save(m);
  }

  async remove(id: string, orgId: string) {
    const m = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!m) throw new NotFoundException('ไม่พบข้อมูล');
    await this.repo.remove(m);
    return { message: 'ลบแล้ว' };
  }

  /**
   * ดึงค่าที่มีอยู่จริงจากทะเบียนผู้ใช้น้ำ → เติมลง master (idempotent — ไม่เพิ่มซ้ำ)
   * ทำให้ dropdown ฟอร์มลูกค้าไม่ว่างตั้งแต่แรก · payment_channel/discount = ค่ามาตรฐาน
   */
  async seedFromCustomers(orgId: string, type: string) {
    this.assertType(type);
    const existing = await this.repo.find({ where: { organizationId: orgId, type: type as WaterMasterType } });
    const has = new Set(existing.map((m) => (m.code || m.name || '').trim()));
    const rows: { code: string | null; name: string; value?: number; sortOrder?: number }[] = [];

    const distinct = async (col: string) => this.repo.query(
      `SELECT DISTINCT ${col} AS v FROM water_customers
        WHERE organization_id = $1 AND deleted_at IS NULL AND ${col} IS NOT NULL AND TRIM(${col}::text) <> ''
        ORDER BY v`, [orgId]);

    if (type === 'area') {
      for (const r of await distinct('village_no'))
        rows.push({ code: String(r.v), name: `หมู่ ${r.v}`, value: Number(r.v), sortOrder: Number(r.v) });
    } else if (type === 'route') {
      for (const r of await distinct('collection_route')) rows.push({ code: String(r.v), name: `เส้นทาง ${r.v}` });
    } else if (type === 'meter_size') {
      for (const r of await distinct('meter_size_code')) rows.push({ code: String(r.v), name: `ขนาด ${r.v}` });
    } else if (type === 'usage_status') {
      // ค่าในทะเบียนเป็นรหัส 01/02/03 — แปลงเป็นชื่อที่อ่านได้ (ตามระบบเก่า) เก็บ code ไว้ให้ dropdown แมตช์
      const LBL: Record<string, string> = { '01': 'สมาชิกผู้ใช้น้ำ', '02': 'ยกเลิกการใช้น้ำและมีหนี้ค้างชำระ', '03': 'ยกเลิก' };
      for (const r of await distinct('usage_status')) { const v = String(r.v); rows.push({ code: v, name: LBL[v] || v }); }
    } else if (type === 'user_type') {
      for (const r of await distinct('rate_type')) rows.push({ code: null, name: String(r.v) });
    } else if (type === 'payment_channel') {
      [['01', 'เงินสด'], ['02', 'QR / โอน']].forEach(([c, n], i) => rows.push({ code: c, name: n, sortOrder: i }));
    } else if (type === 'discount') {
      rows.push({ code: '01', name: 'ผู้ใช้น้ำทั่วไป', value: 0 });
    }

    const toAdd = rows.filter((r) => !has.has((r.code || r.name).trim()));
    if (toAdd.length) {
      const entities = toAdd.map((r) => this.repo.create({
        organizationId: orgId, type: type as WaterMasterType, code: r.code,
        name: r.name, value: (r.value ?? null) as any, sortOrder: r.sortOrder ?? 0, active: true,
      } as any)) as unknown as WaterMaster[];
      await this.repo.save(entities);
    }
    return { added: toAdd.length, total: existing.length + toAdd.length };
  }
}
