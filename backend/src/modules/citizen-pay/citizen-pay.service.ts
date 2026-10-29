import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, FindOptionsWhere } from 'typeorm';
import { MarketStall } from '../../database/entities/market-stall.entity';
import { MarketBill } from '../../database/entities/market-bill.entity';
import { WasteBill } from '../../database/entities/waste-bill.entity';
import { Organization } from '../../database/entities/organization.entity';
import { StorageService } from '../storage/storage.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PayConfigService } from '../market/pay-config.service';

/** แปลงเลขไทยเป็นอารบิก แล้วตัดช่องว่างซ้ำ (ตรรกะเดียวกับ WasteService.search) */
const normalize = (s: string) => s.replace(/[๐-๙]/g, (d) => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d))).replace(/\s+/g, ' ').trim();

/** ชื่อแบบปกปิด: "สมชาย ใจบุญ" → "สมชาย ใ***" — หน้าสาธารณะไม่ควรโชว์ชื่อเต็มของคนอื่น */
export const maskName = (n: string | null) => {
  if (!n) return null;
  const [first, ...rest] = n.trim().split(/\s+/);
  return rest.length ? `${first} ${rest.join(' ').slice(0, 1)}***` : first;
};
const maskPhone = (p: string | null) => (p && p.length >= 9 ? `${p.slice(0, 3)}-xxx-${p.slice(-4)}` : null);

const NO_MATCH = 'ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจสอบชื่อและเลขล็อก/บ้านเลขที่ให้ตรงกับที่ลงทะเบียนไว้';
const TITLES = /^(นางสาว|น\.ส\.|นาย|นาง|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|คุณ)\s*/;
/** ตัดคำนำหน้า/ช่องว่าง/เลขไทย → ใช้เทียบชื่อ */
const nameKey = (n: string | null | undefined) => normalize(n || '').replace(TITLES, '').replace(/\s+/g, '').toLowerCase();
/** ชื่อที่กรอกต้องยาวพอ (กันเดาด้วยชื่อสั้น ๆ) */
const nameMatchReady = (n: string) => nameKey(n).length >= 4;
/** ตรงเมื่อชื่อเต็มเท่ากัน (ไม่สนคำนำหน้า) · ไม่รับการเดาบางส่วน */
const nameMatches = (stored: string | null, input: string) => !!stored && nameKey(stored) === nameKey(input);

const OPEN_STATUSES = ['unpaid', 'pending', 'mismatch'];
const publicMarketBill = (b: MarketBill) => ({
  id: b.id, stallCode: b.stallCode, payerName: maskName(b.payerName), kind: b.kind, period: b.period, amount: Number(b.amount),
  dueDate: b.dueDate, status: b.status, submittedMethod: b.submittedMethod, reviewNote: b.reviewNote,
});
const publicWasteBill = (b: WasteBill) => ({
  id: b.id, householdRef: b.householdRef, holderName: maskName(b.holderName), houseNo: b.houseNo, moo: b.moo, phone: maskPhone(b.phone),
  period: b.period, amount: Number(b.amount), dueDate: b.dueDate, status: b.status, submittedMethod: b.submittedMethod, reviewNote: b.reviewNote,
});

@Injectable()
export class CitizenPayService {
  constructor(
    @InjectRepository(MarketStall) private readonly stalls: Repository<MarketStall>,
    @InjectRepository(MarketBill) private readonly marketBills: Repository<MarketBill>,
    @InjectRepository(WasteBill) private readonly wasteBills: Repository<WasteBill>,
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    private readonly storage: StorageService,
    private readonly orgs: OrganizationsService,
    private readonly config: PayConfigService,
  ) {}

  /** org จากโดเมน (1 อบต. = 1 โดเมน) → รหัสที่ส่งมา → ถ้ามี อบต. เดียวใช้อันนั้น */
  async resolveOrg(host?: string, code?: string): Promise<string> {
    const byHost = await this.orgs.orgIdByHost(host);
    if (byHost) return byHost;
    if (code?.trim()) {
      const [r] = await this.orgRepo.query(`SELECT id FROM organizations WHERE UPPER(code) = UPPER($1) AND is_active = true LIMIT 1`, [code.trim()]);
      if (r) return r.id;
    }
    const rows = await this.orgRepo.query(`SELECT id FROM organizations WHERE is_active = true LIMIT 2`);
    if (rows.length === 1) return rows[0].id;
    throw new BadRequestException('ระบุหน่วยงานไม่ถูกต้อง');
  }

  async publicConfig(orgId: string) {
    const [org, cfg] = await Promise.all([this.orgRepo.findOne({ where: { id: orgId } }), this.config.get(orgId)]);
    return { orgName: org?.nameTh ?? '', ...cfg };
  }

  /** ค้นบิลค่าขยะบ้านที่ยังไม่จ่าย — ต้องกรอก "ชื่อ" คู่กับ (บ้านเลขที่+หมู่ หรือ เบอร์โทร) และต้องตรงกัน · ค้นด้วยชื่ออย่างเดียวไม่ได้ */
  async wasteBillsFor(orgId: string, qRaw: string, nameRaw: string) {
    const text = normalize(qRaw || '');
    if (!nameMatchReady(nameRaw)) throw new BadRequestException('กรุณากรอกชื่อ-นามสกุลของผู้รับบิล');
    const digits = text.replace(/[\s-]/g, '');
    const moo = text.match(/(?:หมู่(?:ที่)?|ม\.)\s*(\d+)/);
    const rest = (moo ? text.replace(moo[0], ' ') : text).trim();
    const house = rest.match(/^(?:บ้านเลขที่|เลขที่)?\s*(\d+(?:\/\d+)?)$/);
    const base: FindOptionsWhere<WasteBill> = { organizationId: orgId, status: In(OPEN_STATUSES) };
    let where: FindOptionsWhere<WasteBill>;
    if (/^0\d{8,9}$/.test(digits)) where = { ...base, phone: digits };
    else if (house && moo) where = { ...base, houseNo: house[1], moo: String(Number(moo[1])) };
    else throw new BadRequestException('กรุณากรอกบ้านเลขที่และหมู่ (เช่น 18 หมู่ 2) หรือเบอร์โทรที่ลงทะเบียนไว้');
    const rows = (await this.wasteBills.find({ where, order: { period: 'DESC', houseNo: 'ASC' }, take: 60 }))
      .filter((r) => nameMatches(r.holderName, nameRaw));
    if (!rows.length) throw new NotFoundException(NO_MATCH);
    return rows.map(publicWasteBill);
  }

  /** ผังแผงสาธารณะ: รหัส/โซน/สถานะ/ค่าเช่า เท่านั้น — ไม่มีชื่อผู้เช่า */
  async marketStalls(orgId: string) {
    const rows = await this.stalls.find({ where: { organizationId: orgId, active: true }, order: { zone: 'ASC', stallCode: 'ASC' } });
    return rows.map((s) => ({ stallCode: s.stallCode, zone: s.zone, status: s.status, monthlyRate: Number(s.monthlyRate) }));
  }

  /** บิลค่าแผง: ต้องกรอกเลขล็อก + ชื่อผู้เช่าให้ตรงกัน — ไม่ตรงตอบข้อความเดียวกันหมด (ไม่บอกว่าผิดที่ล็อกหรือชื่อ) */
  async marketBillsFor(orgId: string, stallCode: string, nameRaw: string) {
    const code = (stallCode || '').trim().toUpperCase();
    if (!code) throw new BadRequestException('กรุณากรอกเลขล็อก');
    if (!nameMatchReady(nameRaw)) throw new BadRequestException('กรุณากรอกชื่อ-นามสกุลผู้เช่า');
    const stall = await this.stalls.findOne({ where: { organizationId: orgId, stallCode: code, active: true } });
    if (!stall || !nameMatches(stall.tenantName, nameRaw)) throw new NotFoundException(NO_MATCH);
    const rows = await this.marketBills.find({ where: { organizationId: orgId, stallCode: code, status: In(OPEN_STATUSES) }, order: { period: 'DESC', kind: 'ASC' }, take: 60 });
    return {
      stall: { stallCode: stall.stallCode, zone: stall.zone, status: stall.status, monthlyRate: Number(stall.monthlyRate) },
      bills: rows.map(publicMarketBill),
    };
  }

  /**
   * ประชาชนแจ้งชำระ: transfer = แนบสลิป (บังคับ) · cash = แจ้งว่าจะไปจ่ายเงินสดที่ อบต. (ไม่มีสลิป)
   * สถานะเป็น pending รอเจ้าหน้าที่ยืนยันเสมอ — ประชาชนทำให้เป็น paid เองไม่ได้
   */
  async submit(orgId: string, type: 'market' | 'waste', id: string, method: string, name: string, file?: Express.Multer.File) {
    if (method !== 'transfer' && method !== 'cash') throw new BadRequestException('วิธีชำระไม่ถูกต้อง');
    if (method === 'transfer' && !file) throw new BadRequestException('กรุณาแนบรูปสลิปโอนเงิน');
    const repo = (type === 'market' ? this.marketBills : this.wasteBills) as Repository<MarketBill | WasteBill>;
    const bill = await repo.findOne({ where: { id, organizationId: orgId } as FindOptionsWhere<MarketBill | WasteBill> });
    const owner = type === 'market' ? (bill as MarketBill | null)?.payerName : (bill as WasteBill | null)?.holderName;
    if (!bill || !nameMatches(owner ?? null, name)) throw new NotFoundException(NO_MATCH);
    if (bill.status === 'paid') throw new ConflictException('บิลนี้ชำระแล้ว');
    bill.slipUrl = file ? await this.storage.storeCitizenAttachment(file.buffer, file.mimetype, file.originalname, 'pay-slips') : null;
    bill.submittedMethod = method;
    bill.submittedAt = new Date();
    bill.reviewNote = null;
    bill.status = 'pending';
    await repo.save(bill);
    return { ok: true, status: bill.status };
  }

  /** จองแผงว่างจากหน้าประชาชน → สถานะ "จอง" รอเจ้าหน้าที่ยืนยัน (กันแย่งกันจองด้วยอัปเดตแบบมีเงื่อนไข status='available') */
  async reserve(orgId: string, stallCode: string, name: string, phone: string) {
    const n = (name || '').trim();
    const p = (phone || '').replace(/[\s-]/g, '');
    if (n.length < 2 || n.length > 200) throw new BadRequestException('กรุณากรอกชื่อ-นามสกุล');
    if (!/^0\d{8,9}$/.test(p)) throw new BadRequestException('เบอร์โทรไม่ถูกต้อง');
    const r = await this.stalls.update(
      { organizationId: orgId, stallCode: (stallCode || '').trim().toUpperCase(), status: 'available', active: true },
      { status: 'reserved', tenantName: n, contactPhone: p, reservedAt: new Date() },
    );
    if (!r.affected) throw new ConflictException('แผงนี้ไม่ว่างแล้ว กรุณาเลือกแผงอื่น');
    return { ok: true };
  }
}
