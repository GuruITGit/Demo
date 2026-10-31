import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { MarketOutsideCollection, MarketOutsideLocation } from '../../database/entities/market-outside.entity';
import { MarketOutsideApplication } from '../../database/entities/market-outside-application.entity';
import { MarketBill } from '../../database/entities/market-bill.entity';
import { OutsideCollectionDto, OutsideLocationDto, RejectBillDto } from './dto/market.dto';
import { currentPeriod, nextReceiptNo, periodEndDate } from './receipt';
import { StorageService } from '../storage/storage.service';

/** วันนี้ (ค.ศ. YYYY-MM-DD) ตามเวลาเครื่องเซิร์ฟเวอร์ */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** แผงลอย: จุดเก็บค่าที่นอกผังประจำ — เปิด/ปิดได้ ตั้งค่าเช่ารายวัน/รายเดือน และบันทึกการเก็บเงินหน้างาน */
@Injectable()
export class MarketOutsideService {
  constructor(
    @InjectRepository(MarketOutsideLocation) private readonly locs: Repository<MarketOutsideLocation>,
    @InjectRepository(MarketOutsideCollection) private readonly cols: Repository<MarketOutsideCollection>,
    @InjectRepository(MarketOutsideApplication) private readonly apps: Repository<MarketOutsideApplication>,
    private readonly ds: DataSource,
    private readonly storage: StorageService,
  ) {}

  /** ใบสมัครแผงลอยจากประชาชน (กรองตามสถานะได้: pending / approved / rejected) */
  async listApplications(orgId: string, status?: string) {
    const rows = await this.apps.find({ where: { organizationId: orgId, ...(status ? { status } : {}) }, relations: ['location'], order: { createdAt: 'DESC' }, take: 200 });
    // ยอดค้างของผู้เช่าแต่ละราย (รหัสผู้เช่าคือรหัสบิล) — ลบผู้เช่าได้ก็ต่อเมื่อไม่ค้าง
    const dues: { code: string; count: number; total: number }[] = rows.length ? await this.ds.query(
      `SELECT stall_code AS "code", COUNT(*)::int AS count, COALESCE(SUM(amount),0)::float AS total FROM market_bills
         WHERE organization_id = $1 AND stall_code = ANY($2) AND status IN ('unpaid','pending','mismatch') GROUP BY stall_code`,
      [orgId, rows.map((a) => a.appCode)]) : [];
    const byCode = new Map(dues.map((d) => [d.code, { count: d.count, total: d.total }]));
    return rows.map((a) => ({ ...a, idCardUrl: this.storage.signUrlIfPrivate(a.idCardUrl), openDues: byCode.get(a.appCode) ?? { count: 0, total: 0 } })); // รูปบัตรอยู่ใน private bucket
  }

  /** ลบผู้เช่าแผงลอย (เช่น ยกเลิกการเช่า) — ต้องชำระยอดค้างให้ครบก่อน · เก็บประวัติไว้ (สถานะ cancelled) */
  async cancelApplication(orgId: string, id: string) {
    const app = await this.apps.findOne({ where: { id, organizationId: orgId } });
    if (!app) throw new NotFoundException('ไม่พบผู้เช่ารายนี้');
    if (app.status !== 'approved') throw new BadRequestException('ลบได้เฉพาะผู้เช่าที่อนุมัติแล้ว');
    const [open] = await this.ds.query(
      `SELECT COUNT(*)::int AS count FROM market_bills WHERE organization_id = $1 AND stall_code = $2 AND status IN ('unpaid','pending','mismatch')`,
      [orgId, app.appCode]);
    if (open.count > 0) throw new BadRequestException(`ยังมียอดค้างชำระ ${open.count} รายการ ต้องชำระให้ครบก่อนจึงลบผู้เช่าได้`);
    app.status = 'cancelled';
    await this.apps.save(app);
    return { ok: true };
  }

  /** อนุมัติใบสมัคร → ออกบิลค่าเช่า: รายวัน = ค่าเช่า × จำนวนวัน · รายเดือน = ค่าเช่าต่อเดือน · งวดตามวันเริ่มเช่า */
  async approveApplication(orgId: string, id: string) {
    const app = await this.apps.findOne({ where: { id, organizationId: orgId }, relations: ['location'] });
    if (!app) throw new NotFoundException('ไม่พบใบสมัครนี้');
    if (app.status !== 'pending') throw new BadRequestException('ใบสมัครนี้ดำเนินการไปแล้ว');
    const rate = Number(app.location.rentRate);
    const amount = app.location.rentPeriod === 'monthly' ? rate : rate * app.days;
    // วันเริ่มเช่า (ค.ศ.) → งวดพุทธศักราช YYYY-MM
    const period = app.startDate ? `${Number(app.startDate.slice(0, 4)) + 543}-${app.startDate.slice(5, 7)}` : currentPeriod();
    return this.ds.transaction(async (em) => {
      const bill = await em.save(em.create(MarketBill, {
        organizationId: orgId, stallId: null, stallCode: app.appCode, payerName: app.applicantName, kind: 'rent', period,
        amount: amount.toFixed(2), dueDate: periodEndDate(period), status: 'unpaid',
      }));
      app.status = 'approved'; app.billId = bill.id; app.reviewNote = null;
      await em.save(app);
      return { ok: true, billId: bill.id, appCode: app.appCode, amount };
    });
  }

  async rejectApplication(orgId: string, id: string, note?: string) {
    const app = await this.apps.findOne({ where: { id, organizationId: orgId } });
    if (!app) throw new NotFoundException('ไม่พบใบสมัครนี้');
    if (app.status !== 'pending') throw new BadRequestException('ใบสมัครนี้ดำเนินการไปแล้ว');
    app.status = 'rejected';
    app.reviewNote = note?.trim() || null;
    await this.apps.save(app);
    return { ok: true };
  }

  list(orgId: string) {
    return this.locs.find({ where: { organizationId: orgId, active: true }, order: { createdAt: 'ASC' } });
  }

  create(orgId: string, dto: OutsideLocationDto) {
    if (!dto.name?.trim()) throw new BadRequestException('กรุณาระบุชื่อจุดแผงลอย');
    return this.locs.save(this.locs.create({
      organizationId: orgId, name: dto.name.trim(), rentRate: String(dto.rentRate ?? 0),
      rentPeriod: dto.rentPeriod ?? 'daily', enabled: dto.enabled ?? true, active: true,
    }));
  }

  async update(orgId: string, id: string, dto: OutsideLocationDto) {
    const loc = await this.locs.findOne({ where: { id, organizationId: orgId, active: true } });
    if (!loc) throw new NotFoundException('ไม่พบจุดแผงลอยนี้');
    if (dto.name !== undefined) {
      if (!dto.name.trim()) throw new BadRequestException('ชื่อต้องไม่ว่าง');
      loc.name = dto.name.trim();
    }
    if (dto.rentRate !== undefined) loc.rentRate = String(dto.rentRate);
    if (dto.rentPeriod !== undefined) loc.rentPeriod = dto.rentPeriod;
    if (dto.enabled !== undefined) loc.enabled = dto.enabled;
    return this.locs.save(loc);
  }

  /** ลบจุด (ซ่อน) — เก็บประวัติรายการเก็บเงินไว้ */
  async remove(orgId: string, id: string) {
    const loc = await this.locs.findOne({ where: { id, organizationId: orgId, active: true } });
    if (!loc) throw new NotFoundException('ไม่พบจุดแผงลอยนี้');
    loc.active = false;
    loc.enabled = false;
    await this.locs.save(loc);
    return { ok: true };
  }

  /** รายการเก็บเงิน กรองตามจุด/ช่วงวันที่ (ค่าเริ่มต้น 30 วันล่าสุด) พร้อมยอดรวม */
  async collections(orgId: string, locationId?: string, from?: string, to?: string) {
    const end = to || today();
    const start = from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const rows = await this.cols.find({
      where: { organizationId: orgId, ...(locationId ? { locationId } : {}), collectedOn: Between(start, end) },
      order: { collectedOn: 'DESC', createdAt: 'DESC' }, take: 500,
    });
    return { from: start, to: end, total: rows.reduce((s, r) => s + Number(r.amount), 0), rows };
  }

  /** บันทึกการเก็บเงินหน้างาน (ออกเลขใบเสร็จ MK) — จุดที่ปิดอยู่เก็บไม่ได้ */
  async collect(orgId: string, dto: OutsideCollectionDto) {
    const loc = await this.locs.findOne({ where: { id: dto.locationId, organizationId: orgId, active: true } });
    if (!loc) throw new NotFoundException('ไม่พบจุดแผงลอยนี้');
    if (!loc.enabled) throw new BadRequestException('จุดนี้ปิดอยู่ — เปิดจุดก่อนจึงจะเก็บเงินได้');
    const name = dto.vendorName.trim();
    if (!name) throw new BadRequestException('กรุณาระบุชื่อผู้ค้า');
    return this.ds.transaction(async (em) => {
      const receiptNo = await nextReceiptNo(em, orgId, 'MK');
      return em.save(em.create(MarketOutsideCollection, {
        organizationId: orgId, locationId: loc.id, vendorName: name, collectedOn: dto.collectedOn || today(),
        amount: String(dto.amount ?? loc.rentRate), receiptNo,
      }));
    });
  }

  async removeCollection(orgId: string, id: string) {
    const r = await this.cols.delete({ id, organizationId: orgId });
    if (!r.affected) throw new NotFoundException('ไม่พบรายการนี้');
    return { ok: true };
  }
}
