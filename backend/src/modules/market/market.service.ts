import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { MarketStall } from '../../database/entities/market-stall.entity';
import { MarketBill } from '../../database/entities/market-bill.entity';
import { MarketBillQueryDto, UpdateStallDto } from './dto/market.dto';

/** เลขใบเสร็จแบบอ่านง่าย เช่น MK-2569-10-K3J9Q (ไม่ซ้ำในทางปฏิบัติ — ยังไม่ใช่เลขรันเอกสารทางการ) */
export const receiptNo = (prefix: string, period: string) =>
  `${prefix}-${period}-${Date.now().toString(36).toUpperCase()}`;

@Injectable()
export class MarketService {
  constructor(
    @InjectRepository(MarketStall) private readonly stalls: Repository<MarketStall>,
    @InjectRepository(MarketBill) private readonly bills: Repository<MarketBill>,
  ) {}

  listStalls(orgId: string) {
    return this.stalls.find({ where: { organizationId: orgId, active: true }, order: { zone: 'ASC', stallCode: 'ASC' } });
  }

  /** แก้ไขแผง: ถ้าเป็นว่างจะล้างชื่อผู้เช่า/ผู้จองให้เอง */
  async updateStall(orgId: string, id: string, dto: UpdateStallDto) {
    const stall = await this.stalls.findOne({ where: { id, organizationId: orgId } });
    if (!stall) throw new NotFoundException('ไม่พบแผงนี้');
    if (dto.status !== undefined) stall.status = dto.status;
    if (dto.tenantName !== undefined) stall.tenantName = dto.tenantName || null;
    if (dto.monthlyRate !== undefined) stall.monthlyRate = String(dto.monthlyRate);
    if (stall.status === 'available') stall.tenantName = null;
    return this.stalls.save(stall);
  }

  listBills(orgId: string, q: MarketBillQueryDto) {
    const where: FindOptionsWhere<MarketBill> = { organizationId: orgId };
    if (q.status) where.status = q.status;
    if (q.period) where.period = q.period;
    if (q.stallCode) where.stallCode = q.stallCode;
    return this.bills.find({ where, order: { period: 'DESC', stallCode: 'ASC', kind: 'ASC' }, take: 500 });
  }

  /** รับชำระบิลค่าแผง — บันทึกวิธีรับและสร้างเลขใบเสร็จ · บิลที่จ่ายแล้วซ้ำไม่ได้ */
  async pay(orgId: string, id: string, method: string) {
    const bill = await this.bills.findOne({ where: { id, organizationId: orgId } });
    if (!bill) throw new NotFoundException('ไม่พบบิลค่าแผงนี้');
    if (bill.status === 'paid') throw new BadRequestException('บิลนี้ชำระแล้ว');
    bill.status = 'paid';
    bill.paidMethod = method;
    bill.paidAt = new Date();
    bill.receiptNo = receiptNo('MK', bill.period);
    return this.bills.save(bill);
  }
}
