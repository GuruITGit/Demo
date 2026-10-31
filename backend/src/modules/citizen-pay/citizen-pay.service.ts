import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Repository, FindOptionsWhere, DataSource } from 'typeorm';
import { MarketStall } from '../../database/entities/market-stall.entity';
import { MarketBill } from '../../database/entities/market-bill.entity';
import { WasteBill } from '../../database/entities/waste-bill.entity';
import { Organization } from '../../database/entities/organization.entity';
import { MarketOutsideLocation } from '../../database/entities/market-outside.entity';
import { MarketOutsideApplication } from '../../database/entities/market-outside-application.entity';
import { StorageService } from '../storage/storage.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PayConfigService } from '../market/pay-config.service';
import { nextReceiptNo, currentPeriod, periodEndDate } from '../market/receipt';
import { checkSlip } from '../market/slip-check';
import { NotificationsService } from '../notifications/notifications.service';
import { notifyUsersWithPermission } from '../../common/notify-permission';

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
/** อยู่ในช่วงเปิดให้เช่าวันนี้หรือไม่ (ว่าง = ไม่จำกัด) */
const inWindow = (from: string | null | undefined, until: string | null | undefined) => {
  const d = new Date(); const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return (!from || t >= String(from)) && (!until || t <= String(until));
};
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
    @InjectRepository(MarketOutsideLocation) private readonly outsideLocs: Repository<MarketOutsideLocation>,
    @InjectRepository(MarketOutsideApplication) private readonly outsideApps: Repository<MarketOutsideApplication>,
    private readonly storage: StorageService,
    private readonly orgs: OrganizationsService,
    private readonly config: PayConfigService,
    private readonly ds: DataSource,
    private readonly notifications: NotificationsService,
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
    // ไม่ส่งโทเคนตรวจสลิปออกไปหน้าประชาชน
    const { slipToken, slipProvider, ...pub } = cfg;
    return { orgName: org?.nameTh ?? '', ...pub };
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
  /** จุดแผงลอยที่เปิดให้เช่าอยู่ (เฉพาะที่เจ้าหน้าที่เปิดไว้และยังไม่ถูกลบ) */
  async outsideLocations(orgId: string) {
    const rows = await this.outsideLocs.find({ where: { organizationId: orgId, active: true, enabled: true }, order: { createdAt: 'ASC' } });
    return Promise.all(rows.map(async (l) => {
      const taken = await this.outsideApps.count({ where: { organizationId: orgId, locationId: l.id, status: In(['pending', 'approved']) } });
      return { id: l.id, name: l.name, rentRate: Number(l.rentRate), rentPeriod: l.rentPeriod === 'monthly' ? 'monthly' : 'daily', openFrom: l.openFrom, openUntil: l.openUntil, openNow: inWindow(l.openFrom, l.openUntil), capacity: l.capacity ?? null, full: !!l.capacity && taken >= l.capacity };
    }));
  }

  async marketStalls(orgId: string) {
    const rows = await this.stalls.find({ where: { organizationId: orgId, active: true }, order: { zone: 'ASC', stallCode: 'ASC' } });
    return rows.map((s) => ({ stallCode: s.stallCode, zone: s.zone, status: s.status, monthlyRate: Number(s.monthlyRate) }));
  }

  /** แผงลอย: ค้นด้วยชื่ออย่างเดียว — ถ้าชื่อตรงผู้เช่าแผงลอยมากกว่าหนึ่งราย ให้พิมพ์รหัสผู้เช่าด้วย */
  async outsideBillsByName(orgId: string, nameRaw: string) {
    const rows = await this.marketBills.find({ where: { organizationId: orgId, status: In(OPEN_STATUSES), stallCode: Like('OUT-%') }, order: { period: 'DESC', kind: 'ASC' }, take: 500 });
    const hits = rows.filter((b) => nameMatches(b.payerName, nameRaw));
    const codes = [...new Set(hits.map((b) => b.stallCode))];
    if (!codes.length) throw new NotFoundException(NO_MATCH);
    if (codes.length > 1) throw new BadRequestException('ชื่อนี้มีผู้เช่าแผงลอยมากกว่าหนึ่งราย กรุณาพิมพ์รหัสผู้เช่า (OUT-xxxx) ต่อท้ายชื่อ');
    return { stall: { stallCode: codes[0], zone: 'แผงลอย', status: 'occupied', monthlyRate: 0 }, bills: hits.slice(0, 60).map(publicMarketBill) };
  }

  /** บิลค่าแผง: ต้องกรอกเลขล็อก + ชื่อผู้เช่าให้ตรงกัน — ไม่ตรงตอบข้อความเดียวกันหมด (ไม่บอกว่าผิดที่ล็อกหรือชื่อ) */
  async marketBillsFor(orgId: string, stallCode: string, nameRaw: string) {
    const code = (stallCode || '').trim().toUpperCase();
    if (!nameMatchReady(nameRaw)) throw new BadRequestException('กรุณากรอกชื่อ-นามสกุลผู้เช่า');
    if (!code) return this.outsideBillsByName(orgId, nameRaw); // แผงลอยไม่มีรหัสแผง พิมพ์ชื่ออย่างเดียวได้
    if (code.startsWith('OUT-')) return this.outsideBillsFor(orgId, code, nameRaw);
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
  /**
   * ประชาชนแจ้งชำระหลายบิลในครั้งเดียว (ชื่อผู้รับบิลต้องตรงทุกใบ)
   * - โอน: ตรวจสลิปอัตโนมัติ (ถ้าเจ้าหน้าที่เปิดไว้) ยอดตรง + บัญชีผู้รับเป็นของ อบต. + เลขอ้างอิงไม่ซ้ำ → ชำระให้ทันที
   *   ไม่ผ่านเงื่อนไขใด → เข้าคิวรอเจ้าหน้าที่ตรวจพร้อมเหตุผล
   * - เงินสด: เข้าคิวรอรับเงินที่ อบต. (ไม่มีสลิป)
   */
  async submitBills(orgId: string, type: 'market' | 'waste', ids: string[], method: string, name: string, file?: Express.Multer.File) {
    if (method !== 'transfer' && method !== 'cash') throw new BadRequestException('วิธีชำระไม่ถูกต้อง');
    if (!ids.length) throw new BadRequestException('ไม่พบบิลที่เลือก');
    if (ids.length > 24) throw new BadRequestException('แจ้งชำระได้ครั้งละไม่เกิน 24 บิล');
    if (method === 'transfer' && !file) throw new BadRequestException('กรุณาแนบรูปสลิปโอนเงิน');
    const repo = (type === 'market' ? this.marketBills : this.wasteBills) as Repository<MarketBill | WasteBill>;
    const bills = (await repo.find({ where: ids.map((id) => ({ id, organizationId: orgId })) as FindOptionsWhere<MarketBill | WasteBill>[] })) as (MarketBill | WasteBill)[];
    if (bills.length !== new Set(ids).size) throw new NotFoundException(NO_MATCH);
    const ownerOf = (b: MarketBill | WasteBill) => (type === 'market' ? (b as MarketBill).payerName : (b as WasteBill).holderName);
    if (bills.some((b) => !nameMatches(ownerOf(b), name))) throw new NotFoundException(NO_MATCH);
    if (bills.some((b) => b.status === 'paid')) throw new ConflictException('มีบิลที่ชำระแล้วในรายการ');
    const total = bills.reduce((s, b) => s + Number(b.amount), 0);
    const slipUrl = file ? await this.storage.storeCitizenAttachment(file.buffer, file.mimetype, file.originalname, 'pay-slips') : null;
    const now = new Date();

    if (method === 'transfer') {
      const cfg = await this.config.get(orgId);
      const check = await checkSlip(cfg, (file as Express.Multer.File).buffer, (file as Express.Multer.File).mimetype, total);
      if (check.ok) {
        try {
          await this.ds.transaction(async (em) => {
            for (const b of bills) {
              b.status = 'paid'; b.paidMethod = 'transfer'; b.paidAt = now; b.reviewNote = null;
              b.slipUrl = slipUrl; b.submittedMethod = 'transfer'; b.submittedAt = now;
              b.receiptNo = await nextReceiptNo(em, orgId, type === 'market' ? 'MK' : 'WS');
            }
            // เลขอ้างอิงสลิปเก็บที่บิลแรกใบเดียว (unique index กันสลิปเดิมถูกใช้ซ้ำ)
            bills[0].slipTransRef = check.transRef;
            await em.save(bills);
          });
          await this.notifyPayment(bills, 'paid', null);
          return { ok: true, status: 'paid' as const, count: bills.length };
        } catch (e: any) {
          if (String(e?.code) !== '23505') throw e;
          return this.holdForReview(repo, bills, method, slipUrl, now, 'สลิปนี้ถูกใช้ชำระไปแล้ว');
        }
      }
      return this.holdForReview(repo, bills, method, slipUrl, now, check.reason);
    }
    return this.holdForReview(repo, bills, method, null, now, null);
  }

  /** เข้าคิวให้เจ้าหน้าที่ตรวจ (สลิปโอนที่ตรวจไม่ผ่าน หรือแจ้งเงินสด) */
  private async holdForReview(repo: Repository<MarketBill | WasteBill>, bills: (MarketBill | WasteBill)[], method: string, slipUrl: string | null, now: Date, reason: string | null) {
    for (const b of bills) {
      b.status = 'pending'; b.submittedMethod = method; b.submittedAt = now; b.slipUrl = slipUrl;
      b.reviewNote = reason ? reason.slice(0, 300) : null;
    }
    await repo.save(bills);
    await this.notifyPayment(bills, 'pending', reason);
    return { ok: true, status: 'pending' as const, count: bills.length, reason };
  }

  /** จองแผงว่างจากหน้าประชาชน → สถานะ "จอง" รอเจ้าหน้าที่ยืนยัน (อัปเดตแบบมีเงื่อนไข กันแย่งกันจอง) + แจ้งเจ้าหน้าที่ */
  async reserve(orgId: string, stallCode: string, name: string, phone: string, card?: Express.Multer.File, rentalStartDate?: string, rentalDays?: number) {
    const n = (name || '').trim();
    const p = (phone || '').replace(/[\s-]/g, '');
    if (n.length < 2 || n.length > 200) throw new BadRequestException('กรุณากรอกชื่อ-นามสกุล');
    if (!/^0\d{8,9}$/.test(p)) throw new BadRequestException('เบอร์โทรไม่ถูกต้อง');
    const code = (stallCode || '').trim().toUpperCase();
    const stall = await this.stalls.findOne({ where: { organizationId: orgId, stallCode: code, active: true } });
    if (!stall) throw new NotFoundException('ไม่พบแผงนี้');
    if (stall.status !== 'available') throw new ConflictException('แผงนี้ไม่ว่างแล้ว กรุณาเลือกแผงอื่น');
    const sd = rentalStartDate && /^\d{4}-\d{2}-\d{2}$/.test(rentalStartDate) ? rentalStartDate : null;
    const rd = sd ? Math.min(Math.max(Number(rentalDays) || 1, 1), 365) : null;
    const cardUrl = card ? await this.storage.storeCitizenAttachment(card.buffer, card.mimetype, card.originalname, 'stall-cards') : null;
    const r = await this.stalls.update(
      { organizationId: orgId, stallCode: code, status: 'available', active: true },
      { status: 'reserved', tenantName: n, contactPhone: p, reservedAt: new Date(), reserveCardUrl: cardUrl, reserveStartDate: sd, reserveDays: rd },
    );
    if (!r.affected) throw new ConflictException('แผงนี้ไม่ว่างแล้ว กรุณาเลือกแผงอื่น');
    await notifyUsersWithPermission(this.ds, this.notifications, orgId, { module: 'market', action: 'manage', subject: 'MarketStall' }, {
      type: 'market:reserved', title: 'มีการจองแผงใหม่', body: `แผง ${code} · ${n} · โทร ${p}${sd ? ` · เริ่ม ${sd} ${rd} วัน` : ''} — รอยืนยัน`,
      actionUrl: '/market?tab=reserve', refType: 'market_stall', refId: stall.id,
    });
    return { ok: true, stallCode: code };
  }

  /** รหัสใบสมัครแผงลอยถัดไปของ อบต. เช่น OUT-0007 */
  private async nextAppCode(orgId: string): Promise<string> {
    const [r] = await this.ds.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(app_code FROM 5) AS INT)), 0) + 1 AS n FROM market_outside_applications WHERE organization_id = $1`, [orgId]);
    return `OUT-${String(r.n).padStart(4, '0')}`;
  }

  /** สมัครแผงลอยจากหน้าประชาชน (ต้องแนบรูปบัตร) → รอเจ้าหน้าที่อนุมัติ แล้วจึงออกบิลค่าเช่า */
  async applyOutside(orgId: string, locId: string, name: string, phone: string, card?: Express.Multer.File, startDate?: string, days?: number, tenancy: 'regular' | 'temporary' = 'regular') {
    const n = (name || '').trim();
    const p = (phone || '').replace(/[\s-]/g, '');
    if (n.length < 2 || n.length > 200) throw new BadRequestException('กรุณากรอกชื่อ-นามสกุล');
    if (!/^0\d{8,9}$/.test(p)) throw new BadRequestException('เบอร์โทรไม่ถูกต้อง');
    if (!card) throw new BadRequestException('กรุณาแนบรูปบัตรประชาชน');
    const loc = await this.outsideLocs.findOne({ where: { id: locId, organizationId: orgId, active: true, enabled: true } });
    if (!loc) throw new NotFoundException('ไม่พบจุดแผงลอยนี้หรือปิดให้เช่าแล้ว');
    if (loc.capacity) {
      const taken = await this.outsideApps.count({ where: { organizationId: orgId, locationId: loc.id, status: In(['pending', 'approved']) } });
      if (taken >= loc.capacity) throw new BadRequestException('จุดนี้จองเต็มแล้ว');
    }
    if (!inWindow(loc.openFrom, loc.openUntil)) throw new BadRequestException(`จุดนี้เปิดให้เช่าเฉพาะช่วง ${loc.openFrom ?? '…'} ถึง ${loc.openUntil ?? '…'}`);
    const d = Math.min(Math.max(Number(days) || 1, 1), 365);
    const sd = startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null;
    const cardUrl = await this.storage.storeCitizenAttachment(card.buffer, card.mimetype, card.originalname, 'outside-cards');
    const code = await this.nextAppCode(orgId);
    const row = await this.outsideApps.save(this.outsideApps.create({
      organizationId: orgId, locationId: loc.id, appCode: code, applicantName: n, phone: p, idCardUrl: cardUrl, startDate: sd, days: d, status: 'pending', tenancyType: tenancy,
    }));
    await notifyUsersWithPermission(this.ds, this.notifications, orgId, { module: 'market', action: 'manage', subject: 'MarketStall' }, {
      type: 'market:outside_applied', title: 'มีใบสมัครแผงลอยใหม่', body: `${code} · ${loc.name} · ${n} · โทร ${p}`,
      actionUrl: '/market', refType: 'market_outside_application', refId: row.id,
    });
    return { ok: true, appCode: code };
  }

  /** ค้นบิลแผงลอยด้วยรหัสใบสมัคร (OUT-xxxx) — ใบต้องอนุมัติแล้ว และชื่อผู้สมัครต้องตรงกัน */
  private async outsideBillsFor(orgId: string, code: string, nameRaw: string) {
    const app = await this.outsideApps.findOne({ where: { organizationId: orgId, appCode: code, status: 'approved' }, relations: ['location'] });
    if (!app || !nameMatches(app.applicantName, nameRaw)) throw new NotFoundException(NO_MATCH);
    const rows = await this.marketBills.find({ where: { organizationId: orgId, stallCode: code, status: In(OPEN_STATUSES) }, order: { period: 'DESC', kind: 'ASC' }, take: 60 });
    return {
      stall: { stallCode: code, zone: `แผงลอย · ${app.location?.name ?? ''}`, status: 'outside', monthlyRate: Number(app.location?.rentRate ?? 0) },
      bills: rows.map(publicMarketBill),
    };
  }

  /** แจ้งเจ้าหน้าที่ที่มีสิทธิ์ตรวจ เมื่อประชาชนแจ้งชำระ (ชำระแล้วอัตโนมัติ หรือรอตรวจ) */
  private async notifyPayment(bills: (MarketBill | WasteBill)[], status: 'paid' | 'pending', reason: string | null) {
    if (!bills.length) return;
    const first = bills[0];
    const isMarket = 'stallCode' in first;
    const who = isMarket ? `แผง ${(first as MarketBill).stallCode}` : `บ้านเลขที่ ${(first as WasteBill).houseNo} หมู่ ${Number((first as WasteBill).moo)}`;
    const total = bills.reduce((s, b) => s + Number(b.amount), 0);
    const perm = isMarket ? { module: 'market', action: 'manage', subject: 'MarketBill' } : { module: 'waste', action: 'manage', subject: 'WasteBill' };
    const notice = status === 'paid'
      ? { type: isMarket ? 'market:paid' : 'waste:paid', title: 'ตรวจสลิปผ่านและชำระแล้ว', body: `${who} · ${bills.length} รายการ · ${total} บาท` }
      : { type: isMarket ? 'market:pending' : 'waste:pending', title: 'มีการแจ้งชำระรอตรวจ', body: `${who} · ${bills.length} รายการ · ${total} บาท${reason ? ' — ' + reason : ''}` };
    await notifyUsersWithPermission(this.ds, this.notifications, first.organizationId, perm, {
      ...notice, actionUrl: isMarket ? '/market' : '/waste', refType: isMarket ? 'market_bill' : 'waste_bill', refId: first.id,
    });
  }
}
