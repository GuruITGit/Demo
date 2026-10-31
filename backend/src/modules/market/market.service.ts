import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository, FindOptionsWhere } from 'typeorm';
import { MarketStall } from '../../database/entities/market-stall.entity';
import { MarketBill } from '../../database/entities/market-bill.entity';
import { MarketBillQueryDto, UpdateStallDto, CreateStallDto, BulkStallsDto, CreateMarketBillDto } from './dto/market.dto';
import { PayConfigService } from './pay-config.service';
import { currentPeriod, nextReceiptNo, periodEndDate } from './receipt';
import { NotificationsService } from '../notifications/notifications.service';
import { notifyUsersWithPermission } from '../../common/notify-permission';
import { StorageService } from '../storage/storage.service';
import { verifyPendingSlips } from './slip-check';

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(MarketStall) private readonly stalls: Repository<MarketStall>,
    @InjectRepository(MarketBill) private readonly bills: Repository<MarketBill>,
    private readonly ds: DataSource,
    private readonly config: PayConfigService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}

  /** ตรวจสลิปโอนที่รอตรวจทั้งหมดในคลิกเดียว (ต้องผูกโทเคนตรวจสลิปไว้) */
  async verifySlips(orgId: string) {
    return verifyPendingSlips(this.ds, this.storage, await this.config.get(orgId), orgId, MarketBill, 'MK', (b: MarketBill) => `แผง ${b.stallCode}`);
  }

  /** แผงที่ประชาชนจองไว้ รอเจ้าหน้าที่ยืนยัน — พร้อมชื่อ เบอร์ วันเริ่มเช่า และรูปบัตร */
  async listReservations(orgId: string) {
    const rows = await this.stalls.find({ where: { organizationId: orgId, active: true, status: 'reserved' }, order: { reservedAt: 'ASC' } });
    return rows.map((s) => ({
      id: s.id, stallCode: s.stallCode, zone: s.zone, tenantName: s.tenantName, contactPhone: s.contactPhone,
      reservedAt: s.reservedAt, reserveStartDate: s.reserveStartDate, reserveDays: s.reserveDays, reserveCardUrl: this.storage.signUrlIfPrivate(s.reserveCardUrl),
    }));
  }

  /** แจ้งเตือนผู้ที่มีสิทธิ์จัดการตลาดให้ไปยืนยันการจองที่ค้างอยู่ */
  async notifyReservations(orgId: string) {
    const rows = await this.listReservations(orgId);
    if (!rows.length) throw new BadRequestException('ไม่มีการจองที่รอยืนยัน');
    const codes = rows.slice(0, 8).map((r) => r.stallCode).join(', ') + (rows.length > 8 ? ' ...' : '');
    await notifyUsersWithPermission(this.ds, this.notifications, orgId, { module: 'market', action: 'manage', subject: 'MarketStall' }, {
      type: 'market:reserved_pending', title: `มีการจองรอยืนยัน ${rows.length} แผง`, body: `แผง ${codes}`,
      actionUrl: '/market?tab=reserve',
    });
    return { ok: true, count: rows.length };
  }

  /** รูปบัตรของผู้จองอยู่ใน private bucket → ออกลิงก์มีลายเซ็นอายุสั้นให้เจ้าหน้าที่เปิดดูได้ */
  async listStalls(orgId: string) {
    const rows = await this.stalls.find({ where: { organizationId: orgId, active: true }, order: { zone: 'ASC', stallCode: 'ASC' } });
    return rows.map((s) => ({ ...s, reserveCardUrl: this.storage.signUrlIfPrivate(s.reserveCardUrl) }));
  }

  /** แก้ไขแผง: ถ้าเป็นว่างจะล้างชื่อผู้เช่า/ผู้จองให้เอง */
  async updateStall(orgId: string, id: string, dto: UpdateStallDto) {
    const stall = await this.stalls.findOne({ where: { id, organizationId: orgId } });
    if (!stall) throw new NotFoundException('ไม่พบแผงนี้');
    if (dto.status === 'available' && stall.status !== 'available') {
      const open = await this.bills.count({ where: { organizationId: orgId, stallCode: stall.stallCode, status: In(['unpaid', 'pending', 'mismatch']) } });
      if (open > 0) throw new BadRequestException(`ยังมียอดค้างชำระ ${open} รายการ ต้องชำระให้ครบก่อนจึงยกเลิกผู้เช่าได้`);
    }
    if (dto.status !== undefined) stall.status = dto.status;
    if (dto.tenantName !== undefined) stall.tenantName = dto.tenantName || null;
    if (dto.monthlyRate !== undefined) stall.monthlyRate = String(dto.monthlyRate);
    if (stall.status === 'available') { stall.tenantName = null; stall.contactPhone = null; stall.reservedAt = null; }
    return this.stalls.save(stall);
  }

  async listBills(orgId: string, q: MarketBillQueryDto) {
    const where: FindOptionsWhere<MarketBill> = { organizationId: orgId };
    if (q.status) where.status = q.status;
    if (q.period) where.period = q.period;
    if (q.stallCode) where.stallCode = q.stallCode;
    const rows = await this.bills.find({ where, order: { period: 'DESC', stallCode: 'ASC', kind: 'ASC' }, take: 500 });
    return rows.map((b) => ({ ...b, slipUrl: this.storage.signUrlIfPrivate(b.slipUrl) })); // สลิปอยู่ใน private bucket
  }

  /** รับชำระ/ยืนยันสลิป — บันทึกวิธีรับและออกเลขใบเสร็จ (atomic) · บิลที่จ่ายแล้วซ้ำไม่ได้ */
  async pay(orgId: string, id: string, method: string) {
    return this.ds.transaction(async (em) => {
      const bill = await em.findOne(MarketBill, { where: { id, organizationId: orgId }, lock: { mode: 'pessimistic_write' } });
      if (!bill) throw new NotFoundException('ไม่พบบิลค่าแผงนี้');
      if (bill.status === 'paid') throw new BadRequestException('บิลนี้ชำระแล้ว');
      bill.status = 'paid';
      bill.paidMethod = method;
      bill.paidAt = new Date();
      bill.reviewNote = null;
      bill.receiptNo = await nextReceiptNo(em, orgId, 'MK');
      return em.save(bill);
    });
  }

  /** ไม่รับสลิป/ยอดไม่ตรง — ส่งกลับเป็นยังไม่ชำระพร้อมเหตุผลให้ประชาชนเห็นแล้วแจ้งใหม่ได้ */
  async reject(orgId: string, id: string, note: string) {
    const bill = await this.bills.findOne({ where: { id, organizationId: orgId } });
    if (!bill) throw new NotFoundException('ไม่พบบิลค่าแผงนี้');
    if (bill.status === 'paid') throw new BadRequestException('บิลนี้ชำระแล้ว ไม่สามารถปฏิเสธได้');
    bill.status = 'mismatch';
    bill.reviewNote = note.trim().slice(0, 300) || 'เจ้าหน้าที่ตรวจแล้วไม่ตรง กรุณาแจ้งชำระใหม่';
    return this.bills.save(bill);
  }

  /**
   * ออกบิลประจำงวดให้แผงที่มีผู้เช่า (occupied): ค่าเช่า (ตามค่าเช่าของแผง) + ค่าขยะแผง (ตามตั้งค่า อบต.)
   * ซ้ำได้ปลอดภัย — บิลที่มีอยู่แล้ว (แผง+ชนิด+งวด) ข้ามให้ · ค่าเช่า/ค่าขยะ 0 บาทไม่ออก
   */
  async generate(orgId: string, period?: string) {
    const p = period || currentPeriod();
    const cfg = await this.config.get(orgId);
    const occupied = await this.stalls.find({ where: { organizationId: orgId, active: true, status: 'occupied' } });
    const due = periodEndDate(p);
    const existing = new Set(
      (await this.bills.find({ where: { organizationId: orgId, period: p }, select: { stallCode: true, kind: true } }))
        .map((b) => `${b.stallCode}|${b.kind}`),
    );
    const rows: MarketBill[] = [];
    for (const s of occupied) {
      const payer = s.tenantName || s.stallCode;
      const add = (kind: 'rent' | 'waste', amount: number) => {
        if (amount <= 0 || existing.has(`${s.stallCode}|${kind}`)) return;
        rows.push(this.bills.create({ organizationId: orgId, stallId: s.id, stallCode: s.stallCode, payerName: payer, kind, period: p, amount: String(amount), dueDate: due, status: 'unpaid' }));
      };
      add('rent', Number(s.monthlyRate));
      add('waste', cfg.wasteStallFee);
    }
    if (rows.length) await this.bills.save(rows);
    return { period: p, created: rows.length, skipped: occupied.length * 2 - rows.length };
  }

  /** สรุปหน้าหลัก/รายงาน: ยอดตามสถานะ + ค้างรายแผง (ใช้ทำรายงานค้างชำระ) */
  async summary(orgId: string, period?: string) {
    const params: unknown[] = [orgId];
    const cond = period ? 'AND period = $2' : '';
    if (period) params.push(period);
    const byStatus = await this.bills.query(
      `SELECT status, COUNT(*)::int AS count, COALESCE(SUM(amount),0)::float AS total FROM market_bills WHERE organization_id = $1 ${cond} GROUP BY status`, params);
    const arrears = await this.bills.query(
      `SELECT stall_code AS "stallCode", MAX(payer_name) AS "payerName", COUNT(DISTINCT period)::int AS months, MIN(period) AS oldest, SUM(amount)::float AS total
         FROM market_bills WHERE organization_id = $1 AND status <> 'paid' ${cond} GROUP BY stall_code ORDER BY total DESC, stall_code LIMIT 200`, params);
    const stallCounts = await this.stalls.query(
      `SELECT status, COUNT(*)::int AS count FROM market_stalls WHERE organization_id = $1 AND active = true GROUP BY status`, [orgId]);
    return { period: period || null, byStatus, arrears, stallCounts };
  }

  // ─────────────────────────── จัดการแผง
  /** เพิ่มแผง — ถ้ารหัสนี้เคยถูกลบ (ปิดใช้งาน) จะเปิดกลับมาแทนการสร้างซ้ำ (รหัสแผงซ้ำในหนึ่ง อบต. ไม่ได้) */
  async createStall(orgId: string, dto: CreateStallDto) {
    const code = dto.stallCode.trim().toUpperCase();
    const zone = (dto.zone?.trim() || code.replace(/[0-9]+$/, '') || code.slice(0, 1)).toUpperCase().slice(0, 10);
    const existing = await this.stalls.findOne({ where: { organizationId: orgId, stallCode: code } });
    if (existing?.active) throw new BadRequestException(`มีแผง ${code} อยู่แล้ว`);
    if (existing) {
      Object.assign(existing, { active: true, zone, status: 'available', tenantName: null, contactPhone: null, reservedAt: null, monthlyRate: String(dto.monthlyRate) });
      return this.stalls.save(existing);
    }
    return this.stalls.save(this.stalls.create({ organizationId: orgId, stallCode: code, zone, status: 'available', monthlyRate: String(dto.monthlyRate), active: true }));
  }

  /** เพิ่มแผงเป็นช่วงในโซนเดียว (สูงสุด 200 ล็อก/ครั้ง) — ข้ามรหัสที่มีอยู่ */
  async bulkCreateStalls(orgId: string, dto: BulkStallsDto) {
    if (dto.to < dto.from) throw new BadRequestException('เลขล็อกสุดท้ายต้องไม่น้อยกว่าล็อกแรก');
    if (dto.to - dto.from + 1 > 200) throw new BadRequestException('เพิ่มได้ครั้งละไม่เกิน 200 ล็อก');
    const zone = dto.zone.trim().toUpperCase();
    const all = await this.stalls.find({ where: { organizationId: orgId }, select: { stallCode: true, active: true, id: true } });
    const byCode = new Map(all.map((s) => [s.stallCode, s]));
    let created = 0, reopened = 0, skipped = 0;
    for (let i = dto.from; i <= dto.to; i++) {
      const code = `${zone}${String(i).padStart(2, '0')}`;
      if (code.length > 10) throw new BadRequestException(`รหัส ${code} ยาวเกินไป`);
      const ex = byCode.get(code);
      if (ex?.active) { skipped++; continue; }
      if (ex) {
        await this.stalls.update(ex.id, { active: true, zone, status: 'available', tenantName: null, contactPhone: null, reservedAt: null, monthlyRate: String(dto.monthlyRate) });
        reopened++;
      } else {
        await this.stalls.save(this.stalls.create({ organizationId: orgId, stallCode: code, zone, status: 'available', monthlyRate: String(dto.monthlyRate), active: true }));
        created++;
      }
    }
    return { created, reopened, skipped };
  }

  /** ลบแผง (ปิดใช้งาน) — มีบิลค้างอยู่ห้ามลบ ต้องเก็บ/ยกเลิกบิลก่อน · บิลที่ชำระแล้วคงไว้เป็นประวัติ */
  async removeStall(orgId: string, id: string) {
    const stall = await this.stalls.findOne({ where: { id, organizationId: orgId } });
    if (!stall) throw new NotFoundException('ไม่พบแผงนี้');
    const open = await this.bills.count({ where: { organizationId: orgId, stallCode: stall.stallCode, status: In(['unpaid', 'pending', 'mismatch']) } });
    if (open) throw new BadRequestException(`แผง ${stall.stallCode} ยังมีบิลค้าง ${open} รายการ — เก็บเงินหรือยกเลิกบิลก่อนลบแผง`);
    stall.active = false;
    stall.status = 'available';
    stall.tenantName = null; stall.contactPhone = null; stall.reservedAt = null;
    await this.stalls.save(stall);
    return { ok: true };
  }

  /** ตั้งค่าเช่าทั้งโซน (มีผลกับบิลที่ออกต่อจากนี้ ไม่แก้บิลที่ออกไปแล้ว) */
  async setZoneRate(orgId: string, zone: string, rate: number) {
    const r = await this.stalls.update({ organizationId: orgId, zone: zone.trim().toUpperCase(), active: true }, { monthlyRate: String(rate) });
    if (!r.affected) throw new NotFoundException('ไม่พบโซนนี้');
    return { zone: zone.trim().toUpperCase(), updated: r.affected };
  }

  // ─────────────────────────── จัดการบิล
  /** เพิ่มบิลเอง (ย้อนหลัง/รายการพิเศษ) — แผงต้องมีอยู่ · ซ้ำ (แผง+ชนิด+งวด) ไม่ได้ */
  async createBill(orgId: string, dto: CreateMarketBillDto) {
    const code = dto.stallCode.trim().toUpperCase();
    const stall = await this.stalls.findOne({ where: { organizationId: orgId, stallCode: code, active: true } });
    if (!stall) throw new NotFoundException(`ไม่พบแผง ${code}`);
    const dup = await this.bills.findOne({ where: { organizationId: orgId, stallCode: code, kind: dto.kind, period: dto.period } });
    if (dup) throw new BadRequestException('มีบิลชนิดและงวดนี้ของแผงนี้อยู่แล้ว');
    return this.bills.save(this.bills.create({
      organizationId: orgId, stallId: stall.id, stallCode: code, payerName: stall.tenantName || code, kind: dto.kind,
      period: dto.period, amount: String(dto.amount), dueDate: periodEndDate(dto.period), status: 'unpaid',
    }));
  }

  /** ยกเลิกบิลที่ยังไม่ชำระ (ออกผิด/เลิกเช่า) — บิลที่ชำระแล้วลบไม่ได้ (มีใบเสร็จแล้ว) */
  async removeBill(orgId: string, id: string) {
    const bill = await this.bills.findOne({ where: { id, organizationId: orgId } });
    if (!bill) throw new NotFoundException('ไม่พบบิลค่าแผงนี้');
    if (bill.status === 'paid') throw new BadRequestException('บิลนี้ชำระแล้ว ลบไม่ได้');
    await this.bills.delete(bill.id);
    return { ok: true };
  }

  /** ใบเสร็จ (ข้อมูลสำหรับพิมพ์) — เฉพาะบิลที่จ่ายแล้ว */
  async receipt(orgId: string, id: string) {
    const bill = await this.bills.findOne({ where: { id, organizationId: orgId } });
    if (!bill) throw new NotFoundException('ไม่พบบิลค่าแผงนี้');
    if (bill.status !== 'paid') throw new BadRequestException('บิลนี้ยังไม่ชำระ');
    return bill;
  }
}
