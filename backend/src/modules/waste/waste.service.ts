import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { WasteBill } from '../../database/entities/waste-bill.entity';
import { WasteBillQueryDto } from './dto/waste.dto';
import { receiptNo } from '../market/market.service';

/** แปลงเลขไทยเป็นอารบิก แล้วตัดช่องว่างซ้ำ */
const normalize = (s: string) => s.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/\s+/g, ' ').trim();

@Injectable()
export class WasteService {
  constructor(@InjectRepository(WasteBill) private readonly bills: Repository<WasteBill>) {}

  /**
   * ค้นหาบิลค่าขยะบ้าน — เบอร์ (ตรงทั้งเบอร์) · บ้านเลขที่ (+หมู่) ตรงตัว · ชื่อ/รหัสครัวเรือนมีคำที่พิมพ์
   * ทำให้ตรงกับตรรกะ householdMatches ในหน้าประชาชน (citizen-pay/waste/app.ts)
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

  /** สรุปยอดค้างค่าขยะบ้านของ อบต. (แสดงบนหน้าหลัก) */
  async summary(orgId: string) {
    const unpaid = await this.bills.find({ where: { organizationId: orgId, status: 'unpaid' }, select: { amount: true } });
    return {
      unpaidCount: unpaid.length,
      unpaidTotal: unpaid.reduce((sum, b) => sum + Number(b.amount), 0),
    };
  }

  async pay(orgId: string, id: string, method: string) {
    const bill = await this.bills.findOne({ where: { id, organizationId: orgId } });
    if (!bill) throw new NotFoundException('ไม่พบบิลค่าขยะนี้');
    if (bill.status === 'paid') throw new BadRequestException('บิลนี้ชำระแล้ว');
    bill.status = 'paid';
    bill.paidMethod = method;
    bill.paidAt = new Date();
    bill.receiptNo = receiptNo('WS', bill.period);
    return this.bills.save(bill);
  }
}
