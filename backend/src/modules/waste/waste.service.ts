import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, ILike, FindOptionsWhere } from 'typeorm';
import { WasteBill } from '../../database/entities/waste-bill.entity';
import { WasteHousehold } from '../../database/entities/waste-household.entity';
import { CreateWasteBillDto, HouseholdDto, WasteBillQueryDto } from './dto/waste.dto';
import { nextReceiptNo, currentPeriod, periodEndDate } from '../market/receipt';
import { PayConfigService } from '../market/pay-config.service';

/** แปลงเลขไทยเป็นอารบิก แล้วตัดช่องว่างซ้ำ */
const normalize = (s: string) => s.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/\s+/g, ' ').trim();
const OPEN = ['unpaid', 'pending', 'mismatch'];

@Injectable()
export class WasteService {
  constructor(
    @InjectRepository(WasteBill) private readonly bills: Repository<WasteBill>,
    @InjectRepository(WasteHousehold) private readonly households: Repository<WasteHousehold>,
    private readonly ds: DataSource,
    private readonly config: PayConfigService,
  ) {}

  /**
   * ค้นหาบิลค่าขยะบ้าน — เบอร์ (ตรงทั้งเบอร์) · บ้านเลขที่ (+หมู่) ตรงตัว · ชื่อ/รหัสครัวเรือนมีคำที่พิมพ์
   * ไม่ใส่คำค้น = บิลล่าสุดตามตัวกรองสถานะ/งวด (ใช้ในคิวรอตรวจสลิป)
   */
  async search(orgId: string, q: WasteBillQueryDto) {
    const where: FindOptionsWhere<WasteBill>[] = [];
    const base: FindOptionsWhere<WasteBill> = { organizationId: orgId };
    if (q.status) base.status = q.status;
    if (q.period) base.period = q.period;

    const text = normalize(q.q || '');
    if (text) {
      const digits = text.replace(/[\s-]/g, '');
      const moo = text.match(/(?:หมู่(?:ที่)?|ม\.)\s*(\d+)/);
      const rest = (moo ? text.replace(moo[0], ' ') : text).trim();
      const house = rest.match(/^(?:บ้านเลขที่|เลขที่)?\s*(\d+(?:\/\d+)?)$/);
      if (/^0\d{8,9}$/.test(digits)) {
        where.push({ ...base, phone: digits });
      } else if (house || moo) {
        if (house) where.push({ ...base, houseNo: house[1], ...(moo ? { moo: String(Number(moo[1])) } : {}) });
      } else {
        where.push({ ...base, holderName: ILike(`%${text}%`) }, { ...base, householdRef: ILike(`%${text}%`) });
      }
    } else {
      where.push(base);
    }
    if (where.length === 0) return [];
    return this.bills.find({ where, order: { period: 'DESC', houseNo: 'ASC' }, take: 200 });
  }

  /** สรุปยอดตามสถานะ + ค้างรายครัวเรือน (หน้าภาพรวม/รายงาน) */
  async summary(orgId: string, period?: string) {
    const params: unknown[] = [orgId];
    if (period) params.push(period);
    const cond = period ? 'AND period = $2' : '';
    const byStatus = await this.bills.query(
      `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::float AS total FROM waste_bills WHERE organization_id = $1 ${cond} GROUP BY status`, params);
    const [hh] = await this.households.query(
      `SELECT COUNT(*)::int AS count FROM waste_households WHERE organization_id = $1 AND active = true`, [orgId]);
    const unpaid = byStatus.filter((r: { status: string }) => r.status !== 'paid');
    return {
      period: period || null,
      householdCount: hh?.count ?? 0,
      byStatus,
      unpaidCount: unpaid.reduce((s: number, r: { count: number }) => s + r.count, 0),
      unpaidTotal: unpaid.reduce((s: number, r: { total: number }) => s + r.total, 0),
    };
  }

  async pay(orgId: string, id: string, method: string) {
    return this.ds.transaction(async (em) => {
      const bill = await em.findOne(WasteBill, { where: { id, organizationId: orgId }, lock: { mode: 'pessimistic_write' } });
      if (!bill) throw new NotFoundException('ไม่พบบิลค่าขยะนี้');
      if (bill.status === 'paid') throw new BadRequestException('บิลนี้ชำระแล้ว');
      bill.status = 'paid';
      bill.paidMethod = method;
      bill.paidAt = new Date();
      bill.reviewNote = null;
      bill.receiptNo = await nextReceiptNo(em, orgId, 'WS');
      return em.save(bill);
    });
  }

  async reject(orgId: string, id: string, note: string) {
    const bill = await this.bills.findOne({ where: { id, organizationId: orgId } });
    if (!bill) throw new NotFoundException('ไม่พบบิลค่าขยะนี้');
    if (bill.status === 'paid') throw new BadRequestException('บิลนี้ชำระแล้ว ไม่สามารถปฏิเสธได้');
    bill.status = 'mismatch';
    bill.reviewNote = note.trim().slice(0, 300) || 'เจ้าหน้าที่ตรวจแล้วไม่ตรง กรุณาแจ้งชำระใหม่';
    return this.bills.save(bill);
  }

  /** เพิ่มบิลเอง (ย้อนหลัง/พิเศษ) — ครัวเรือนต้องอยู่ในทะเบียน · ซ้ำ (ครัวเรือน+งวด) ไม่ได้ */
  async createBill(orgId: string, dto: CreateWasteBillDto) {
    const hh = await this.households.findOne({ where: { organizationId: orgId, householdRef: dto.householdRef.trim().toUpperCase(), active: true } });
    if (!hh) throw new NotFoundException('ไม่พบครัวเรือนนี้ในทะเบียน');
    const dup = await this.bills.findOne({ where: { organizationId: orgId, householdRef: hh.householdRef, period: dto.period } });
    if (dup) throw new BadRequestException('ครัวเรือนนี้มีบิลงวดนี้อยู่แล้ว');
    return this.bills.save(this.bills.create({
      organizationId: orgId, householdRef: hh.householdRef, holderName: hh.holderName, houseNo: hh.houseNo, moo: hh.moo, phone: hh.phone,
      period: dto.period, amount: String(dto.amount), dueDate: periodEndDate(dto.period), status: 'unpaid',
    }));
  }

  /** ยกเลิกบิลที่ยังไม่ชำระ — บิลที่ชำระแล้วลบไม่ได้ (มีใบเสร็จแล้ว) */
  async removeBill(orgId: string, id: string) {
    const bill = await this.bills.findOne({ where: { id, organizationId: orgId } });
    if (!bill) throw new NotFoundException('ไม่พบบิลค่าขยะนี้');
    if (bill.status === 'paid') throw new BadRequestException('บิลนี้ชำระแล้ว ลบไม่ได้');
    await this.bills.delete(bill.id);
    return { ok: true };
  }

  /**
   * ออกบิลประจำงวดให้ทุกครัวเรือนที่ใช้งานอยู่ในทะเบียน — ราคา = ราคาเฉพาะครัวเรือน (ถ้ามี) ไม่งั้นราคากลางที่ อบต. ตั้งไว้
   * รันซ้ำได้ — ครัวเรือนที่มีบิลงวดนั้นแล้วข้าม
   */
  async generate(orgId: string, period?: string) {
    const p = period || currentPeriod();
    const cfg = await this.config.get(orgId);
    const hhs = await this.households.find({ where: { organizationId: orgId, active: true } });
    if (!hhs.length) throw new BadRequestException('ยังไม่มีครัวเรือนในทะเบียน — เพิ่มหรือนำเข้าครัวเรือนก่อน');
    const have = new Set((await this.bills.find({ where: { organizationId: orgId, period: p }, select: { householdRef: true } })).map((b) => b.householdRef));
    const rows: WasteBill[] = [];
    let noFee = 0;
    for (const h of hhs) {
      if (have.has(h.householdRef)) continue;
      const fee = h.monthlyFee != null ? Number(h.monthlyFee) : cfg.householdFee;
      if (fee <= 0) { noFee++; continue; }
      rows.push(this.bills.create({
        organizationId: orgId, householdRef: h.householdRef, holderName: h.holderName, houseNo: h.houseNo, moo: h.moo, phone: h.phone,
        period: p, amount: String(fee), dueDate: periodEndDate(p), status: 'unpaid',
      }));
    }
    if (!rows.length && noFee === hhs.length) throw new BadRequestException('ยังไม่ได้ตั้งค่าเก็บขยะบ้านต่อเดือน (ที่แท็บตั้งค่า)');
    if (rows.length) await this.bills.save(rows);
    return { period: p, created: rows.length, skipped: hhs.length - rows.length - noFee, noFee };
  }

  /** รายงานค้างชำระรายครัวเรือน */
  async arrears(orgId: string, period?: string) {
    const params: unknown[] = [orgId];
    if (period) params.push(period);
    return this.bills.query(
      `SELECT household_ref AS "householdRef", MAX(holder_name) AS "holderName", MAX(house_no) AS "houseNo", MAX(moo) AS moo,
              MAX(phone) AS phone, COUNT(*)::int AS months, SUM(amount)::float AS total
         FROM waste_bills WHERE organization_id = $1 AND status <> 'paid' ${period ? 'AND period = $2' : ''}
         GROUP BY household_ref ORDER BY total DESC, household_ref LIMIT 500`, params);
  }

  // ─────────────────────────── ทะเบียนครัวเรือน
  /** ค้นครัวเรือน (บ้านเลขที่+หมู่ / ชื่อ / เบอร์ / รหัส) พร้อมยอดค้าง */
  async listHouseholds(orgId: string, qRaw?: string) {
    const text = normalize(qRaw || '');
    const rows: WasteHousehold[] = [];
    const base: FindOptionsWhere<WasteHousehold> = { organizationId: orgId, active: true };
    const order = { moo: 'ASC', houseNo: 'ASC' } as const;
    if (!text) rows.push(...(await this.households.find({ where: base, order, take: 500 })));
    else {
      const digits = text.replace(/[\s-]/g, '');
      const moo = text.match(/(?:หมู่(?:ที่)?|ม\.)\s*(\d+)/);
      const rest = (moo ? text.replace(moo[0], ' ') : text).trim();
      const house = rest.match(/^(?:บ้านเลขที่|เลขที่)?\s*(\d+(?:\/\d+)?)$/);
      if (/^0\d{8,9}$/.test(digits)) rows.push(...(await this.households.find({ where: { ...base, phone: digits }, order, take: 100 })));
      else if (moo && !house) rows.push(...(await this.households.find({ where: { ...base, moo: String(Number(moo[1])) }, order, take: 500 })));
      else if (house) rows.push(...(await this.households.find({ where: { ...base, houseNo: house[1], ...(moo ? { moo: String(Number(moo[1])) } : {}) }, order, take: 100 })));
      else rows.push(...(await this.households.find({ where: [{ ...base, holderName: ILike(`%${text}%`) }, { ...base, householdRef: ILike(`%${text}%`) }], order, take: 200 })));
    }
    if (!rows.length) return [];
    const owed: { household_ref: string; months: number; total: number }[] = await this.bills.query(
      `SELECT household_ref, COUNT(*)::int AS months, SUM(amount)::float AS total FROM waste_bills
        WHERE organization_id = $1 AND status <> 'paid' AND household_ref = ANY($2) GROUP BY household_ref`, [orgId, rows.map((r) => r.householdRef)]);
    const byRef = new Map(owed.map((o) => [o.household_ref, o]));
    return rows.map((r) => ({ ...r, owedMonths: byRef.get(r.householdRef)?.months ?? 0, owedTotal: byRef.get(r.householdRef)?.total ?? 0 }));
  }

  private async nextRef(orgId: string): Promise<string> {
    const [r] = await this.households.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(household_ref, '\\D', '', 'g'), '')::int), 0) AS n FROM waste_households WHERE organization_id = $1 AND household_ref ~ '^HH-[0-9]+$'`, [orgId]);
    return `HH-${String((r?.n ?? 0) + 1).padStart(3, '0')}`;
  }

  /** บ้านเลขที่+หมู่ ซ้ำในทะเบียนไม่ได้ (QR หน้าบ้านและการค้นหาอ้างอิงคู่นี้) */
  private async assertHouseFree(orgId: string, houseNo: string, moo: string, exceptId?: string) {
    const dup = await this.households.findOne({ where: { organizationId: orgId, houseNo, moo, active: true } });
    if (dup && dup.id !== exceptId) throw new BadRequestException(`บ้านเลขที่ ${houseNo} หมู่ ${moo} มีในทะเบียนแล้ว (${dup.householdRef})`);
  }

  async createHousehold(orgId: string, dto: HouseholdDto) {
    const name = dto.holderName?.trim();
    if (!name || !dto.houseNo || !dto.moo) throw new BadRequestException('กรุณากรอกชื่อ บ้านเลขที่ และหมู่');
    const moo = String(Number(dto.moo));
    await this.assertHouseFree(orgId, dto.houseNo, moo);
    return this.households.save(this.households.create({
      organizationId: orgId, householdRef: await this.nextRef(orgId), holderName: name, houseNo: dto.houseNo, moo,
      phone: dto.phone || null, monthlyFee: dto.monthlyFee != null ? String(dto.monthlyFee) : null, active: true,
    }));
  }

  async updateHousehold(orgId: string, id: string, dto: HouseholdDto) {
    const h = await this.households.findOne({ where: { id, organizationId: orgId, active: true } });
    if (!h) throw new NotFoundException('ไม่พบครัวเรือนนี้');
    if (dto.holderName !== undefined) { if (!dto.holderName.trim()) throw new BadRequestException('ชื่อต้องไม่ว่าง'); h.holderName = dto.holderName.trim(); }
    const houseNo = dto.houseNo ?? h.houseNo;
    const moo = dto.moo !== undefined ? String(Number(dto.moo)) : h.moo;
    if (houseNo !== h.houseNo || moo !== h.moo) await this.assertHouseFree(orgId, houseNo, moo, h.id);
    h.houseNo = houseNo; h.moo = moo;
    if (dto.phone !== undefined) h.phone = dto.phone || null;
    if (dto.monthlyFee !== undefined) h.monthlyFee = dto.monthlyFee != null ? String(dto.monthlyFee) : null;
    return this.households.save(h);
  }

  /** ลบครัวเรือนออกจากทะเบียน (ซ่อน) — มีบิลค้างอยู่ห้ามลบ · บิลที่ชำระแล้วคงไว้เป็นประวัติ */
  async removeHousehold(orgId: string, id: string) {
    const h = await this.households.findOne({ where: { id, organizationId: orgId, active: true } });
    if (!h) throw new NotFoundException('ไม่พบครัวเรือนนี้');
    const open = await this.bills.count({ where: { organizationId: orgId, householdRef: h.householdRef, status: In(OPEN) } });
    if (open) throw new BadRequestException(`ครัวเรือน ${h.householdRef} ยังมีบิลค้าง ${open} รายการ — เก็บเงินหรือยกเลิกบิลก่อนลบ`);
    h.active = false;
    await this.households.save(h);
    return { ok: true };
  }

  /** นำเข้าครัวเรือนเป็นชุด: บ้านเลขที่+หมู่ ที่มีอยู่แล้วให้อัปเดตชื่อ/เบอร์ · ที่ไม่มีให้เพิ่ม · แถวไม่ครบบอกเหตุผลรายแถว */
  async importHouseholds(orgId: string, rows: HouseholdDto[]) {
    const existing = await this.households.find({ where: { organizationId: orgId, active: true } });
    const key = (h: string, m: string) => `${h}|${m}`;
    const byHouse = new Map(existing.map((h) => [key(h.houseNo, h.moo), h]));
    let created = 0, updated = 0;
    const errors: { row: number; message: string }[] = [];
    let nextNo = Number((await this.nextRef(orgId)).slice(3));
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const name = r.holderName?.trim();
      if (!name || !r.houseNo || !r.moo) { errors.push({ row: i + 1, message: 'ต้องมีชื่อ บ้านเลขที่ และหมู่' }); continue; }
      const moo = String(Number(r.moo));
      const ex = byHouse.get(key(r.houseNo, moo));
      if (ex) {
        ex.holderName = name;
        if (r.phone) ex.phone = r.phone;
        if (r.monthlyFee != null) ex.monthlyFee = String(r.monthlyFee);
        await this.households.save(ex);
        updated++;
      } else {
        const h = await this.households.save(this.households.create({
          organizationId: orgId, householdRef: `HH-${String(nextNo++).padStart(3, '0')}`, holderName: name, houseNo: r.houseNo, moo,
          phone: r.phone || null, monthlyFee: r.monthlyFee != null ? String(r.monthlyFee) : null, active: true,
        }));
        byHouse.set(key(h.houseNo, h.moo), h);
        created++;
      }
    }
    return { created, updated, errors };
  }
}
