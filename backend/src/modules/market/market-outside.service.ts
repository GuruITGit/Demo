import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { MarketOutsideCollection, MarketOutsideLocation } from '../../database/entities/market-outside.entity';
import { OutsideCollectionDto, OutsideLocationDto } from './dto/market.dto';
import { nextReceiptNo } from './receipt';

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
    private readonly ds: DataSource,
  ) {}

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
