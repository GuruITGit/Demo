import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { WaterCustomer } from '../../database/entities/water-customer.entity';
import { WaterBill } from '../../database/entities/water-bill.entity';
import { WaterRate } from '../../database/entities/water-rate.entity';
import { WaterRemittance } from '../../database/entities/water-remittance.entity';
import { Organization } from '../../database/entities/organization.entity';
import { loadOrgIdentity } from './org-identity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { PdfService } from '../pdf/pdf.service';
import { StorageService } from '../storage/storage.service';
import { buildBillDocHtml, BillDocKind } from './receipt-html';
import { buildBlueReceiptHtml, BlueReceipt, BLUE_PAGE } from './blue-receipt-html';
import { bahtText } from '../../common/utils/baht-text.util';
import { MONTH_TH } from './water.service';
import { buildSlipHtml } from './slip-html';
import { pngToEscposRaster } from './escpos-raster';
import { promptpayQrDataUrl } from './promptpay-qr';
import { billPaymentQrDataUrl } from './billpayment-qr';
import { verifySlip, verifySlipMulti } from './slip-verify';
import { PeriodQueryDto, SaveReadingDto, ReceivePaymentDto, CancelPaymentDto, UpdateRateDto } from './dto/water.dto';

/**
 * ระบบเก็บค่าน้ำ v2 (field app) — เลือกเล่ม/หมู่ → จดมิเตอร์ → คิดเงินอัตโนมัติ → รับชำระ
 * ทำเองแทน vendor: multi-tenant (orgId) DB เดียว, ข้อมูลไหลเข้า dashboard/หนังสือค้างตรงๆ
 */
type PaidFilter = { search?: string; receiptNo?: string; from?: string; to?: string };

@Injectable()
export class WaterBillingService {
  constructor(
    @InjectRepository(WaterCustomer) private customerRepo: Repository<WaterCustomer>,
    @InjectRepository(WaterBill) private billRepo: Repository<WaterBill>,
    @InjectRepository(WaterRate) private rateRepo: Repository<WaterRate>,
    @InjectRepository(WaterRemittance) private remitRepo: Repository<WaterRemittance>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
  ) {}

  // ─────────────────────────────── รอบบิล (งวดปัจจุบัน) + รอบส่งเงิน
  /** รอบบิลปัจจุบัน — งวดที่กำลังจด/เก็บ (ไม่ตั้ง = เดือนปฏิทินปัจจุบัน) */
  async getRound(orgId: string) {
    const rate = await this.getRate(orgId);
    const now = new Date();
    const py = rate.currentPeriodYear || now.getFullYear() + 543;
    const pm = rate.currentPeriodMonth || now.getMonth() + 1;
    // สรุปความคืบหน้าการจดของรอบ
    const [prog] = await this.billRepo.query(
      `SELECT COUNT(*) FILTER (WHERE read_at IS NOT NULL)::int AS "read",
              COUNT(*) FILTER (WHERE status='paid')::int AS "paid",
              (SELECT COUNT(*)::int FROM water_customers WHERE organization_id=$1 AND deleted_at IS NULL) AS "customers"
         FROM water_bills_v2 WHERE organization_id=$1 AND period_year=$2 AND period_month=$3`,
      [orgId, py, pm],
    );
    return { periodYear: py, periodMonth: pm, ...prog };
  }

  /** เปลี่ยนรอบบิล — เลื่อนไปเดือนถัดไป (หรือกำหนดเอง) */
  async setRound(orgId: string, year?: number, month?: number) {
    const rate = await this.getRate(orgId);
    if (year && month) { rate.currentPeriodYear = year; rate.currentPeriodMonth = month; }
    else {
      const cur = await this.getRound(orgId);
      let pm = cur.periodMonth + 1, py = cur.periodYear;
      if (pm > 12) { pm = 1; py += 1; }
      rate.currentPeriodYear = py; rate.currentPeriodMonth = pm;
    }
    await this.rateRepo.save(rate);
    return this.getRound(orgId);
  }

  async listRemittance(orgId: string) {
    return this.remitRepo.find({ where: { organizationId: orgId }, order: { remitDate: 'DESC' }, take: 90 });
  }

  /** ปิดรอบส่งเงินของวัน — snapshot ยอดเงินรับ (paid_at ในวันนั้น) */
  async closeRemittance(orgId: string, date: string, userId: string, note?: string) {
    if (!date) throw new BadRequestException('กรุณาระบุวันที่ส่งเงิน');
    const [sum] = await this.billRepo.query(
      `SELECT COUNT(*)::int AS n, COALESCE(SUM(COALESCE(paid_amount,total_amount)),0)::float AS total
         FROM water_bills_v2 WHERE organization_id=$1 AND status='paid'
          AND (paid_at AT TIME ZONE 'Asia/Bangkok')::date = $2::date`,
      [orgId, date],
    );
    const existing = await this.remitRepo.findOne({ where: { organizationId: orgId, remitDate: date } });
    const rec: WaterRemittance = existing || this.remitRepo.create({ organizationId: orgId, remitDate: date });
    rec.billCount = sum.n; rec.totalAmount = Number(sum.total).toFixed(2); rec.closedBy = userId;
    if (note !== undefined) rec.note = note;
    return this.remitRepo.save(rec);
  }

  /** ตรวจ year/month ก่อน query (กัน NaN → SQL 500 ตอนไม่ส่ง param) */
  private assertPeriod(year: number, month: number) {
    if (!Number.isInteger(year) || year < 2500 || year > 2700 || !Number.isInteger(month) || month < 1 || month > 12)
      throw new BadRequestException('กรุณาระบุปี (พ.ศ.) และเดือนให้ถูกต้อง');
  }

  /** ปีงบประมาณไทย (พ.ศ.) จากวันที่ — เริ่ม 1 ต.ค. (เดือน >= 10 นับเป็นปีงบถัดไป) */
  private fiscalYearBE(d = new Date()): number {
    const be = d.getFullYear() + 543;
    return d.getMonth() + 1 >= 10 ? be + 1 : be;
  }

  /** รหัสรอบบิลแบบราชการ = ปีงบ(2หลัก)-รอบในปีงบ(3หลัก) · ต.ค.=001 ... ก.ย.=012 (ตรงกับ vendor: ส.ค.=69-011, ก.ย.=69-012) */
  private billRoundCode(periodYear: number, periodMonth: number): string {
    const fy = periodMonth >= 10 ? periodYear + 1 : periodYear;
    const round = ((periodMonth + 2) % 12) + 1;
    return `${String(fy).slice(-2)}-${String(round).padStart(3, '0')}`;
  }

  /** เลขที่ใบเสร็จถัดไป (atomic) ต่อองค์กร×ปีงบ → รูปแบบ "69-00001" */
  private async nextReceiptNo(orgId: string, fy: number): Promise<string> {
    const [row] = await this.billRepo.query(
      `INSERT INTO water_receipt_sequences (organization_id, fiscal_year, last_no)
       VALUES ($1, $2, 1)
       ON CONFLICT (organization_id, fiscal_year)
       DO UPDATE SET last_no = water_receipt_sequences.last_no + 1
       RETURNING last_no`,
      [orgId, fy],
    );
    return `${String(fy).slice(-2)}-${String(row.last_no).padStart(5, '0')}`;
  }

  /** ดูเลขที่ใบเสร็จถัดไป (ไม่กิน sequence — แค่แสดงให้เจ้าหน้าที่กรอก) */
  async peekNextReceiptNo(orgId: string): Promise<{ receiptNo: string }> {
    const fy = this.fiscalYearBE();
    const [row] = await this.billRepo.query(
      `SELECT COALESCE(last_no, 0) + 1 AS next FROM water_receipt_sequences WHERE organization_id = $1 AND fiscal_year = $2`,
      [orgId, fy],
    );
    const next = row?.next || 1;
    return { receiptNo: `${String(fy).slice(-2)}-${String(next).padStart(5, '0')}` };
  }

  /** บันทึกประวัติกิจกรรม (ต้องมี orgId + module ไม่งั้น insert ไม่ผ่าน) */
  private async audit(orgId: string, userId: string, action: string, bill: WaterBill, extra?: Record<string, any>) {
    await this.auditRepo.save({
      organizationId: orgId, userId, action, module: 'water',
      resourceType: 'water_bill', resourceId: bill.id,
      resourceTitle: `${bill.customerCode} ${bill.fullName} · ${bill.periodMonth}/${bill.periodYear}`,
      newValues: extra ?? null,
    } as any);
  }

  /** ชื่อผู้ใช้ระบบ (title+ชื่อ) สำหรับพิมพ์บนเอกสาร */
  private async userName(id?: string): Promise<string | undefined> {
    if (!id) return undefined;
    // ชื่อคนจด/ผู้รับเงินอยู่ใน water_users (ระบบประปาแยก auth) — fallback users สำหรับบิลเก่าก่อนแยก
    const [w] = await this.billRepo.query(
      `SELECT full_name AS name FROM water_users WHERE id = $1 LIMIT 1`, [id]);
    if (w?.name?.trim()) return w.name.trim();
    const [u] = await this.billRepo.query(
      `SELECT COALESCE(title_th,'') || full_name_th AS name FROM users WHERE id = $1 LIMIT 1`, [id]);
    return u?.name?.trim() || undefined;
  }

  /** เอกสารบิลค่าน้ำ 58mm — kind 'invoice' (ใบแจ้งหนี้ ตอนจด) / 'receipt' (ใบเสร็จ หลังจ่าย) */
  async billDocPdf(id: string, orgId: string, kind: BillDocKind): Promise<{ buffer: Buffer; filename: string }> {
    const bill = await this.findBill(id, orgId);
    if (kind === 'receipt' && bill.status !== 'paid') {
      throw new BadRequestException('บิลนี้ยังไม่ได้รับชำระ ออกใบเสร็จไม่ได้');
    }
    const org = await loadOrgIdentity(this.orgRepo, orgId);
    const customer = await this.customerRepo.findOne({ where: { id: bill.customerId } });
    const rate = await this.getRate(orgId);
    const html = await buildBillDocHtml({
      kind,
      org,
      bill: { ...(bill as any), address: customer?.address ?? null, accessToken: customer?.accessToken ?? null,
        billNo: bill.billNo || `${this.billRoundCode(bill.periodYear, bill.periodMonth)}-${bill.customerCode}` },
      readerName: await this.userName(bill.readBy),
      collectorName: kind === 'receipt' ? await this.userName(bill.receivedBy) : undefined,
      docTitle: rate.docTitle || undefined,
      headerText: (kind === 'invoice' ? rate.invoiceHeader : rate.receiptHeader) || rate.receiptHeader || undefined,
      footerText: (kind === 'invoice' ? rate.invoiceFooter : rate.receiptFooter) || rate.receiptFooter || undefined,
      expiryDays: kind === 'invoice' ? (rate.billExpiryDays || 0) : 0,
    });
    // สูงพอดีเนื้อหา (เดิมล็อก 200mm → ตัวใหญ่ขึ้นแล้วท้ายใบโดนตัด)
    const buffer = await this.pdf.generateRollPdf(html, 58);
    const label = kind === 'receipt' ? 'ใบเสร็จค่าน้ำ' : 'ใบแจ้งหนี้ค่าน้ำ';
    return { buffer, filename: `${label}-${bill.customerCode}-${bill.periodMonth}-${bill.periodYear}.pdf` };
  }

  billInvoicePdf(id: string, orgId: string) { return this.billDocPdf(id, orgId, 'invoice'); }
  billReceiptPdf(id: string, orgId: string) { return this.billDocPdf(id, orgId, 'receipt'); }

  /**
   * ใบเสร็จ/ใบแจ้งหนี้ 58mm สำหรับ RawBT → PT-210 — เรนเดอร์ทั้งใบเป็นรูป (ครุฑ+ไทยครบ) แล้วแปลงเป็น ESC/POS raster
   * คืน base64 ของคำสั่ง ESC/POS พร้อมส่ง `rawbt:base64,<...>`
   */
  async billSlipEscpos(id: string, orgId: string, kind: BillDocKind, copies = 1): Promise<{ base64: string }> {
    const bill = await this.findBill(id, orgId);
    if (kind === 'receipt' && bill.status !== 'paid') throw new BadRequestException('บิลนี้ยังไม่ได้รับชำระ ออกใบเสร็จไม่ได้');
    const org = await loadOrgIdentity(this.orgRepo, orgId);
    const customer = await this.customerRepo.findOne({ where: { id: bill.customerId } });
    const rate = await this.getRate(orgId);
    // ค้างชำระเดือนเก่า = บิล unpaid อื่นของรายนี้ (ไม่รวมใบนี้)
    const [arr] = await this.billRepo.query(
      `SELECT COUNT(*)::int AS months, COALESCE(SUM(total_amount),0)::float AS amount
         FROM water_bills_v2 WHERE organization_id=$1 AND customer_id=$2 AND status='unpaid' AND id <> $3`,
      [orgId, bill.customerId, bill.id],
    );
    const signerName = kind === 'receipt' ? await this.userName(bill.receivedBy) : await this.userName(bill.readBy);
    const html = await buildSlipHtml({
      kind,
      org,
      docTitle: rate.docTitle || undefined,
      headerText: (kind === 'invoice' ? rate.invoiceHeader : rate.receiptHeader) || rate.receiptHeader || undefined,
      footerText: (kind === 'invoice' ? rate.invoiceFooter : rate.receiptFooter) || rate.receiptFooter || undefined,
      expiryDays: kind === 'invoice' ? (rate.billExpiryDays || 0) : 0,
      bill: { ...(bill as any), address: customer?.address ?? null, accessToken: customer?.accessToken ?? null,
        billNo: bill.billNo || `${this.billRoundCode(bill.periodYear, bill.periodMonth)}-${bill.customerCode}` },
      arrearsMonths: arr?.months || 0, arrearsAmount: arr?.amount || 0,
      signerName,
    });
    const png = await this.pdf.generateThermalPng(html, 384, '.slip');
    const escpos = pngToEscposRaster(png, copies);
    return { base64: escpos.toString('base64') };
  }

  /** ใบทดสอบพิมพ์ — สลิปตัวอย่าง (ใช้ข้อมูลหน่วยงานจริง + บิลสมมติ) ให้เช็คว่าต่อเครื่องพิมพ์ติด */
  async printTestEscpos(orgId: string): Promise<{ base64: string }> {
    const org = await loadOrgIdentity(this.orgRepo, orgId);
    const rate = await this.getRate(orgId);
    const now = new Date();
    const html = await buildSlipHtml({
      kind: 'receipt', org,
      docTitle: 'ใบทดสอบพิมพ์',
      headerText: rate.receiptHeader || undefined,
      footerText: 'ทดสอบการเชื่อมต่อเครื่องพิมพ์ — ถ้าพิมพ์ออกครบ แสดงว่าใช้งานได้',
      bill: {
        customerCode: '00000', fullName: 'ทดสอบ ระบบพิมพ์', villageNo: 0, address: '-',
        periodYear: now.getFullYear() + 543, periodMonth: now.getMonth() + 1,
        billNo: 'TEST-0000', prevReading: 100, currReading: 110, units: 10,
        waterAmount: 40, serviceFee: 5, totalAmount: 45, readAt: now, paidAt: now,
      },
      arrearsMonths: 0, arrearsAmount: 0, signerName: 'เจ้าหน้าที่ทดสอบ',
    });
    const png = await this.pdf.generateThermalPng(html, 384, '.slip');
    return { base64: pngToEscposRaster(png).toString('base64') };
  }

  /** QR ของบิล (ยอดตรงบิล) — ถ้าตั้ง KTB Biller ID จะเป็น QR Bill Payment (มี Ref1/Ref2 → กระทบยอดอัตโนมัติ) ไม่งั้นใช้พร้อมเพย์ */
  async billQr(id: string, orgId: string) {
    const bill = await this.findBill(id, orgId);
    const rate = await this.getRate(orgId);
    const amt = Math.max(0, +Number(bill.totalAmount).toFixed(2));
    if (rate.ktbBillerId) {
      const ref2 = `${bill.periodYear}${String(bill.periodMonth).padStart(2, '0')}`; // งวด YYYYMM
      const qr = await billPaymentQrDataUrl(rate.ktbBillerId, bill.customerCode, ref2, amt);
      return { qr, amount: amt, payeeName: rate.payeeName || null, method: 'ktb' as const,
        billerId: rate.ktbBillerId, ref1: bill.customerCode, ref2, hasPromptpay: !!qr };
    }
    return this.qrForAmount(orgId, amt);
  }

  /** QR สำหรับยอดใดๆ (ใช้ตอนรับชำระหลายบิลรวมกันหน้า cashier — ยอดรวมไม่ผูกบิลเดียว จึงใช้พร้อมเพย์) */
  async qrForAmount(orgId: string, amount: number) {
    const rate = await this.getRate(orgId);
    const amt = Math.max(0, +Number(amount).toFixed(2));
    const qr = await promptpayQrDataUrl(rate.promptpayId || undefined, amt, rate.promptpayType || undefined);
    return { qr, amount: amt, payeeName: rate.payeeName || null, method: 'promptpay' as const, promptpayId: rate.promptpayId || null, hasPromptpay: !!qr };
  }

  // ─────────────────────────────── เรตค่าน้ำ (ตั้งค่าได้ต่อ อบต.)
  /** ดึงเรต — ถ้ายังไม่มีให้สร้างค่าเริ่มต้น (4 บาท/หน่วย + ค่าบริการ 5) */
  async getRate(orgId: string): Promise<WaterRate> {
    let rate = await this.rateRepo.findOne({ where: { organizationId: orgId } });
    if (!rate) rate = await this.rateRepo.save(this.rateRepo.create({ organizationId: orgId }));
    return rate;
  }

  /**
   * คิดเงินค่าน้ำครบสูตร — ใช้ค่า "ระดับเรต" (org rate) เท่านั้น
   * (ยืนยันจากบิลจริง 32,725 ใบ: ระบบเก่าคิด flat/เรตเดียวทุกราย ไม่เอา M-field รายคน (M11/M15/M25) มาคิด
   *  ถึง import เก็บไว้ใน entity ก็ไม่นำมาบวก มิฉะนั้นจะเพี้ยนจากของจริง)
   * ลำนางรอง: flat 4฿ + บริการ 5฿, ที่เหลือ 0 → ผลลัพธ์เท่าเดิมทุกบาท
   */
  computeCharges(rate: WaterRate, units: number, unitPriceOverride?: number | null) {
    // ราคาต่อหน่วยเฉพาะราย (ถ้ามี) ทับเรตกลาง — ใช้แบบ flat ที่ราคานั้น (override ชนะ tiered)
    const hasOverride = unitPriceOverride != null && Number.isFinite(unitPriceOverride) && unitPriceOverride >= 0;
    const effUnitPrice = hasOverride ? Number(unitPriceOverride) : Number(rate.unitPrice);
    // ค่าน้ำ: tiered (ตามขั้น) หรือ flat (ราคาต่อหน่วยเดียว)
    let waterAmount: number;
    const tiers = (rate as any).tiers as { from: number; to: number; price: number }[] | null;
    if (!hasOverride && rate.rateMode === 'tiered' && Array.isArray(tiers) && tiers.length) {
      waterAmount = 0;
      // ขั้นสุดท้ายไม่มีเพดาน — หน่วยที่เกิน "ถึง" ของขั้นสุดท้ายคิดราคาขั้นนั้นต่อ (เดิมหน่วยส่วนเกินไม่ถูกคิดเงิน)
      const sorted = [...tiers].sort((a, b) => Number(a.from) - Number(b.from));
      sorted.forEach((t, i) => {
        const to = i === sorted.length - 1 ? Infinity : Number(t.to);
        if (units >= t.from) waterAmount += (Math.min(units, to) - t.from + 1) * Number(t.price);
      });
    } else {
      waterAmount = units * effUnitPrice;
    }
    // ขั้นต่ำ (ถ้าตั้ง minCharge)
    if (Number(rate.minCharge) > 0 && units <= Number(rate.minUnits)) waterAmount = Number(rate.minCharge);
    waterAmount = +waterAmount.toFixed(2);

    const unitPrice = effUnitPrice;
    const serviceFee = Number(rate.serviceFee);
    const garbageFee = Number(rate.garbageFee);
    const wastewaterFee = Number(rate.wastewaterFee);
    const taxable = waterAmount + serviceFee + garbageFee + wastewaterFee;
    const tax = +(taxable * Number(rate.taxRate) / 100).toFixed(2);
    const total = +(taxable + tax).toFixed(2);
    return { unitPrice, waterAmount, serviceFee, garbageFee, wastewaterFee, tax, total };
  }

  async updateRate(orgId: string, dto: UpdateRateDto) {
    const rate = await this.getRate(orgId);
    rate.unitPrice = dto.unitPrice.toFixed(2);
    rate.serviceFee = dto.serviceFee.toFixed(2);
    if (dto.promptpayId !== undefined) rate.promptpayId = dto.promptpayId?.trim() || null;
    if (dto.promptpayType !== undefined) rate.promptpayType = dto.promptpayType || 'mobile';
    if (dto.payeeName !== undefined) rate.payeeName = dto.payeeName?.trim() || null;
    if (dto.ktbBillerId !== undefined) rate.ktbBillerId = dto.ktbBillerId?.replace(/\D/g, '') || null;
    if (dto.slipReceiverName !== undefined) rate.slipReceiverName = dto.slipReceiverName?.trim() || null;
    if (dto.slipVerifyProvider !== undefined) rate.slipVerifyProvider = dto.slipVerifyProvider?.trim() || null;
    // token: ส่งมาเฉพาะตอนเปลี่ยน (undefined/'' = ไม่แตะของเดิม กัน mask ทับ secret จริง)
    if (dto.slipVerifyToken) rate.slipVerifyToken = dto.slipVerifyToken.trim();
    if (dto.slipVerifyClear) rate.slipVerifyToken = null;
    // ผู้ให้บริการตรวจสลิปหลายเจ้า — token ว่างในรายการ = คงของเดิมของเจ้านั้น (frontend ไม่มี secret จริง)
    if (dto.slipVerifyProviders !== undefined) {
      const old = Array.isArray(rate.slipVerifyProviders) ? rate.slipVerifyProviders : [];
      const merged = (dto.slipVerifyProviders || [])
        .map((p) => {
          const provider = String(p?.provider || '').trim();
          const token = (p?.token || '').trim() || (old.find((o) => o.provider === provider)?.token || '');
          return { provider, token };
        })
        .filter((p) => p.provider && p.token);
      rate.slipVerifyProviders = merged.length ? merged : null;
      // sync ค่าเจ้าเดี่ยวเดิมให้สอดคล้อง (เจ้าแรกในลิสต์)
      rate.slipVerifyProvider = merged[0]?.provider || null;
      rate.slipVerifyToken = merged[0]?.token || null;
    }
    if (dto.garbageFee !== undefined) rate.garbageFee = dto.garbageFee.toFixed(2);
    if (dto.wastewaterFee !== undefined) rate.wastewaterFee = dto.wastewaterFee.toFixed(2);
    if (dto.taxRate !== undefined) rate.taxRate = dto.taxRate.toFixed(3);
    if (dto.receiptHeader !== undefined) rate.receiptHeader = dto.receiptHeader?.trim() || null;
    if (dto.receiptFooter !== undefined) rate.receiptFooter = dto.receiptFooter?.trim() || null;
    if (dto.docTitle !== undefined) rate.docTitle = dto.docTitle?.trim() || null;
    if (dto.invoiceHeader !== undefined) rate.invoiceHeader = dto.invoiceHeader?.trim() || null;
    if (dto.invoiceFooter !== undefined) rate.invoiceFooter = dto.invoiceFooter?.trim() || null;
    if (dto.billExpiryDays !== undefined) rate.billExpiryDays = dto.billExpiryDays;
    if (dto.reportSignatureUrl !== undefined) rate.reportSignatureUrl = dto.reportSignatureUrl || null;
    if (dto.warningSignatureUrl !== undefined) rate.warningSignatureUrl = dto.warningSignatureUrl || null;
    if (dto.receiptSealUrl !== undefined) rate.receiptSealUrl = dto.receiptSealUrl || null;
    if (dto.receiptSignatureUrl !== undefined) rate.receiptSignatureUrl = dto.receiptSignatureUrl || null;
    if (dto.receiptOffsetX !== undefined) rate.receiptOffsetX = dto.receiptOffsetX.toFixed(1);
    if (dto.receiptOffsetY !== undefined) rate.receiptOffsetY = dto.receiptOffsetY.toFixed(1);
    if (dto.rateMode !== undefined) rate.rateMode = dto.rateMode === 'tiered' ? 'tiered' : 'flat';
    if (dto.tiers !== undefined) rate.tiers = Array.isArray(dto.tiers)
      ? dto.tiers.map((t) => ({ from: Number(t.from), to: Number(t.to), price: Number(t.price) })).filter((t) => t.to >= t.from)
      : null;
    if (dto.minUnits !== undefined) rate.minUnits = dto.minUnits;
    if (dto.minCharge !== undefined) rate.minCharge = dto.minCharge.toFixed(2);
    if (dto.orgName !== undefined) rate.orgName = dto.orgName?.trim() || null;
    if (dto.orgAddress !== undefined) rate.orgAddress = dto.orgAddress?.trim() || null;
    if (dto.orgPhone !== undefined) rate.orgPhone = dto.orgPhone?.trim() || null;
    if (dto.orgLogoUrl !== undefined) rate.orgLogoUrl = dto.orgLogoUrl || null;
    if (dto.noticeDocPrefix !== undefined) rate.noticeDocPrefix = dto.noticeDocPrefix?.trim() || null;
    if (dto.noticeAddressLine !== undefined) rate.noticeAddressLine = dto.noticeAddressLine?.trim() || null;
    if (dto.noticeDivision !== undefined) rate.noticeDivision = dto.noticeDivision?.trim() || null;
    if (dto.noticePhone !== undefined) rate.noticePhone = dto.noticePhone?.trim() || null;
    if (dto.noticeSignerName !== undefined) rate.noticeSignerName = dto.noticeSignerName?.trim() || null;
    if (dto.noticeSignerTitle !== undefined) rate.noticeSignerTitle = dto.noticeSignerTitle?.trim() || null;
    if (dto.noticeDueDays !== undefined) rate.noticeDueDays = dto.noticeDueDays;
    return this.rateRepo.save(rate);
  }

  // ─────────────────────────────── เล่ม/เส้นทาง (หมู่) + ความคืบหน้า
  /** รายหมู่พร้อมสถานะจด: จำนวนผู้ใช้ / จดแล้ว / รับเงินแล้ว / ยอดเก็บได้ ของงวดนั้น */
  async routes(orgId: string, year: number, month: number) {
    this.assertPeriod(year, month);
    return this.billRepo.query(
      `SELECT c.village_no AS "villageNo",
              COUNT(DISTINCT c.id)::int AS "customers",
              COUNT(b.id) FILTER (WHERE b.read_at IS NOT NULL)::int AS "read",
              COUNT(b.id) FILTER (WHERE b.status = 'paid')::int AS "paid",
              COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'paid'), 0)::float AS "collected"
         FROM water_customers c
         LEFT JOIN water_bills_v2 b
           ON b.customer_id = c.id AND b.period_year = $2 AND b.period_month = $3
        WHERE c.organization_id = $1 AND c.deleted_at IS NULL AND c.village_no IS NOT NULL
        GROUP BY c.village_no ORDER BY c.village_no`,
      [orgId, year, month],
    );
  }

  /**
   * รายชื่อผู้ใช้น้ำในหมู่ พร้อมบิลของงวด (ถ้าจดแล้ว) + เลขมิเตอร์ครั้งก่อน + ยอดค้างสะสม
   * ใช้ในหน้าจดมิเตอร์ — คนที่ยังไม่จดจะไม่มี bill (status = null)
   * ไม่เลือกหมู่แต่มีคำค้น = ค้นทุกหมู่ (ชื่อ / รหัส / บ้านเลขที่ / เบอร์) ไม่เกิน 50 ราย
   */
  async routeMembers(orgId: string, dto: PeriodQueryDto) {
    // ชื่อจากระบบเดิมมีเว้นวรรคซ้อน ("นางวีรยา  ดีแล้ว") → ยุบช่องว่างทั้งคำค้นและชื่อก่อนเทียบ
    const term = (dto.search || '').trim().replace(/\s+/g, ' ');
    if (!dto.villageNo && term.length < (/^[0-9/-]+$/.test(term) ? 1 : 2)) throw new BadRequestException('กรุณาเลือกหมู่/เส้นทาง หรือพิมพ์คำค้นอย่างน้อย 2 ตัวอักษร');
    const params: any[] = [orgId, dto.year, dto.month];
    const where: string[] = [];
    if (dto.villageNo) { params.push(dto.villageNo); where.push(`c.village_no = $${params.length}`); }
    // บ้านเลขที่ = คำแรกของที่อยู่ ("219 ม.1" → "219")
    const house = `split_part(regexp_replace(trim(coalesce(c.address, '')), '[[:space:]]+', ' ', 'g'), ' ', 1)`;
    let rank = '';
    if (term && /^[0-9/-]+$/.test(term)) {
      // ตัวเลข → ตรงตัว: บ้านเลขที่ (8 ไม่ดึง 18/108 · 8/1 นับเป็นบ้าน 8) / รหัส (ไม่สนเลข 0 นำหน้า) / เบอร์ 4 หลักขึ้นไป
      params.push(term);
      const p = `$${params.length}`;
      where.push(`(${house} = ${p} OR ${house} LIKE ${p} || '/%'
                   OR (ltrim(${p}, '0') <> '' AND ltrim(c.customer_code, '0') = ltrim(${p}, '0'))
                   OR (length(${p}) >= 4 AND regexp_replace(coalesce(c.phone, ''), '[^0-9]', '', 'g') LIKE '%' || ${p} || '%'))`);
      rank = `(${house} = ${p}) DESC, (${house} LIKE ${p} || '/%') DESC, `;
    } else if (term) {
      // ตัวอักษร → ชื่อ/รหัสที่มีคำนั้น (ยุบช่องว่างซ้อนในชื่อก่อนเทียบ)
      params.push(`%${term}%`);
      const p = `$${params.length}`;
      where.push(`(c.customer_code ILIKE ${p} OR regexp_replace(c.full_name, '[[:space:]]+', ' ', 'g') ILIKE ${p})`);
    }
    return this.billRepo.query(
      `SELECT c.id AS "customerId", c.customer_code AS "customerCode", c.full_name AS "fullName",
              c.village_no AS "villageNo", c.address, c.phone, c.gps, c.usage_status AS "usageStatus",
              b.id AS "billId", b.curr_reading AS "currReading", b.units, b.total_amount::float AS "totalAmount",
              b.status, b.read_at AS "readAt", b.slip_status AS "slipStatus", b.meter_photo_url AS "meterPhotoUrl",
              c.walk_order AS "walkOrder",
              COALESCE(b.prev_reading, prev.curr_reading,
                CASE WHEN NOT EXISTS (SELECT 1 FROM water_bills_v2 x WHERE x.customer_id = c.id) THEN c.meter_last_reading END,
                0) AS "prevReading",
              prev.units AS "prevUnits",
              arr.cnt::int AS "unpaidCount", arr.amt::float AS "unpaidTotal"
         FROM water_customers c
         LEFT JOIN water_bills_v2 b
           ON b.customer_id = c.id AND b.period_year = $2 AND b.period_month = $3
         LEFT JOIN LATERAL (
           SELECT curr_reading, units FROM water_bills_v2 p
            WHERE p.customer_id = c.id
              AND (p.period_year < $2 OR (p.period_year = $2 AND p.period_month < $3))
            ORDER BY p.period_year DESC, p.period_month DESC LIMIT 1
         ) prev ON true
         LEFT JOIN LATERAL (
           SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS amt
             FROM water_bills_v2 u WHERE u.customer_id = c.id AND u.status = 'unpaid'
         ) arr ON true
        WHERE c.organization_id = $1 AND c.deleted_at IS NULL AND ${where.join(' AND ')}
        ORDER BY ${rank}COALESCE(c.walk_order, 2147483647), c.customer_code
        ${dto.villageNo ? '' : 'LIMIT 50'}`,
      params,
    );
  }

  /**
   * เลขมิเตอร์ครั้งก่อนของผู้ใช้น้ำ (ใช้ตอนเปิดหน้าจด)
   * ยังไม่เคยมีบิลเลย (ลูกบ้านใหม่) → ใช้เลขมิเตอร์เริ่มต้นที่กรอกไว้ในทะเบียน แทน 0
   */
  private async prevReading(orgId: string, customerId: string, year: number, month: number, startReading?: number | null): Promise<number> {
    const [row] = await this.billRepo.query(
      `SELECT curr_reading FROM water_bills_v2
        WHERE organization_id = $1 AND customer_id = $2
          AND (period_year < $3 OR (period_year = $3 AND period_month < $4))
        ORDER BY period_year DESC, period_month DESC LIMIT 1`,
      [orgId, customerId, year, month],
    );
    if (row) return row.curr_reading;
    const [any] = await this.billRepo.query(
      `SELECT 1 FROM water_bills_v2 WHERE organization_id = $1 AND customer_id = $2 LIMIT 1`, [orgId, customerId]);
    return any ? 0 : Number(startReading) || 0;
  }

  // ─────────────────────────────── จดมิเตอร์ → ออกบิล
  async saveReading(dto: SaveReadingDto, orgId: string, userId: string) {
    const customer = await this.customerRepo.findOne({ where: { id: dto.customerId, organizationId: orgId } });
    if (!customer) throw new NotFoundException('ไม่พบผู้ใช้น้ำรายนี้');

    // กรอกเบอร์/ปักพิกัดตอนจด → บันทึกกลับทะเบียน (เบอร์ให้ล็อกอินพอร์ทัล · GPS สะสมทำแผนที่มาตรน้ำภายหลัง)
    const phone = dto.phone?.trim();
    const gps = dto.gps?.trim();
    let dirty = false;
    if (phone && phone !== customer.phone) { customer.phone = phone; dirty = true; }
    if (gps && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(gps) && gps !== customer.gps) { customer.gps = gps; dirty = true; }
    // อัปเดตเลขมิเตอร์ล่าสุดในทะเบียน (ให้ตรงกับที่จดล่าสุด — ตามระบบเก่า) · เก็บเลขเดิมไว้เป็นเลขเริ่มต้นของลูกบ้านใหม่
    const startReading = customer.meterLastReading;
    if (customer.meterLastReading !== dto.currReading) { customer.meterLastReading = dto.currReading; dirty = true; }
    if (dirty) await this.customerRepo.save(customer);

    const existing = await this.billRepo.findOne({
      where: { organizationId: orgId, customerId: dto.customerId, periodYear: dto.periodYear, periodMonth: dto.periodMonth },
    });
    if (existing && existing.status === 'paid') {
      throw new ConflictException('บิลงวดนี้รับชำระแล้ว แก้เลขมิเตอร์ไม่ได้');
    }

    const prev = existing ? existing.prevReading : await this.prevReading(orgId, dto.customerId, dto.periodYear, dto.periodMonth, startReading);
    // มิเตอร์เดินขึ้น — ถ้าเลขใหม่ < เดิม ถือว่ามาตรวนกลับ(overflow) → ใช้จำนวนหลักหน้ามาตร(meterDigits)คำนวณ
    // มาตรวน "จริง" เกิดเฉพาะตอน prev ใกล้เต็ม (เช่น 9990→0010) — ถ้า prev ห่างจากเต็มมาก แล้ว curr<prev = จดผิด ไม่ใช่วน
    const ROLLOVER_MAX_UNITS = 1000; // เพดานหน่วย/งวดสมเหตุสมผล — rollover เกินนี้ = จดผิด → fallback
    let units: number;
    if (dto.currReading >= prev) {
      units = dto.currReading - prev;
    } else {
      const digits = customer.meterDigits && customer.meterDigits > 0 ? customer.meterDigits : 0;
      const cap = digits > 0 ? Math.pow(10, digits) : 0;
      const rollover = cap > prev ? (cap - prev) + dto.currReading : NaN;
      // ยอมรับ rollover เฉพาะที่หน่วยสมเหตุสมผล (≤1000) — ไม่งั้นถือว่าจดผิด ใช้เลขใหม่เป็นหน่วย (หน้าจดจะเตือน "ผิดปกติ" อยู่แล้ว)
      units = Number.isFinite(rollover) && rollover >= 0 && rollover <= ROLLOVER_MAX_UNITS ? rollover : dto.currReading;
    }

    const rate = await this.getRate(orgId);
    const c = this.computeCharges(rate, units, customer.unitPrice != null ? Number(customer.unitPrice) : null);

    const roundCode = this.billRoundCode(dto.periodYear, dto.periodMonth);
    const data: Partial<WaterBill> = {
      organizationId: orgId, customerId: customer.id,
      customerCode: customer.customerCode, fullName: customer.fullName, villageNo: customer.villageNo ?? null,
      periodYear: dto.periodYear, periodMonth: dto.periodMonth,
      periodRound: roundCode, billNo: `${roundCode}-${customer.customerCode}`, // เลขที่ใบแจ้งหนี้ = ปีงบ-รอบ-รหัสลูกค้า (เช่น 69-011-00003)
      prevReading: prev, currReading: dto.currReading, units,
      readAt: new Date(), readBy: userId,
      issueType: (dto.issueType as any) || 'normal', note: dto.note ?? null,
      unitPrice: c.unitPrice.toFixed(2), waterAmount: c.waterAmount.toFixed(2),
      serviceFee: c.serviceFee.toFixed(2),
      garbageFee: c.garbageFee.toFixed(2), wastewaterFee: c.wastewaterFee.toFixed(2),
      tax: c.tax.toFixed(2),
      totalAmount: c.total.toFixed(2),
      status: 'unpaid',
      gps: gps || customer.gps || null,
    };

    // ประวัติการแก้เลขมิเตอร์ — บันทึกเมื่อแก้บิลเดิมแล้วเลขจดเปลี่ยน (สตง.ตรวจได้ว่าใครแก้)
    if (existing && Number(existing.currReading) !== dto.currReading) {
      const hist = Array.isArray(existing.editHistory) ? existing.editHistory : [];
      hist.push({ by: await this.userName(userId), at: new Date().toISOString(),
        prevReading: Number(existing.currReading), currReading: dto.currReading });
      (data as any).editHistory = hist;
    }

    let bill: WaterBill;
    try {
      bill = existing
        ? await this.billRepo.save(Object.assign(existing, data))
        : await this.billRepo.save(this.billRepo.create(data));
    } catch (e: any) {
      // race: เจ้าหน้าที่อีกคนเพิ่งสร้างบิลงวดนี้พร้อมกัน (ชน unique constraint) → แจ้งให้รีเฟรช
      if (e?.code === '23505') throw new ConflictException('รายนี้เพิ่งถูกบันทึกโดยเจ้าหน้าที่อีกคน กรุณารีเฟรชแล้วลองใหม่');
      throw e;
    }
    await this.audit(orgId, userId, existing ? 'water_reading_update' : 'water_reading', bill,
      { prev, curr: dto.currReading, units, issue: data.issueType });
    return bill;
  }

  async findBill(id: string, orgId: string) {
    const b = await this.billRepo.findOne({ where: { id, organizationId: orgId } });
    if (!b) throw new NotFoundException('ไม่พบบิล');
    return b;
  }

  // ─────────────────────────────── รับชำระ
  async receivePayment(id: string, dto: ReceivePaymentDto, orgId: string, userId: string) {
    const bill = await this.findBill(id, orgId);
    if (bill.status === 'paid') throw new ConflictException('บิลนี้รับชำระไปแล้ว');
    if (!bill.readAt) throw new BadRequestException('ยังไม่ได้จดมิเตอร์ ออกบิลไม่ได้');

    const now = new Date();
    const amount = (dto.paidAmount ?? Number(bill.totalAmount)).toFixed(2);
    const method = dto.payMethod || 'cash';
    // ปิดช่องโกง: รับชำระแบบ QR ต้องมีผลตรวจสลิปที่ผ่านแล้ว (ยอดตรง + ยังไม่ถูกใช้)
    if (method === 'qr' && await this.slipVerifyEnabled(orgId)) {
      await this.assertSlipVerify(orgId, dto.slipVerifyId, +Number(amount).toFixed(2));
      await this.billRepo.query(
        `UPDATE water_slip_verify SET consumed_at = now(), bill_ids = ARRAY[$3::uuid]
          WHERE id = $1 AND organization_id = $2 AND consumed_at IS NULL`, [dto.slipVerifyId, orgId, id]);
    }
    // atomic: เปลี่ยนเป็น paid เฉพาะถ้ายังเป็น unpaid — กัน 2 คนรับเงินบิลเดียวกันพร้อมกัน (เก็บเงินซ้ำ)
    const flip = await this.billRepo.createQueryBuilder()
      .update(WaterBill)
      .set({ status: 'paid', paidAt: now, paidAmount: amount, receivedBy: userId, payMethod: method })
      .where('id = :id AND organization_id = :orgId AND status = :st', { id, orgId, st: 'unpaid' })
      .execute();
    if (!flip.affected) throw new ConflictException('บิลนี้เพิ่งถูกรับชำระโดยเจ้าหน้าที่อีกคน');
    // ผู้ชนะเท่านั้นที่ได้เลขใบเสร็จ (กรอกเองได้ ถ้าเว้นว่าง → รันอัตโนมัติต่อปีงบ)
    const receiptNo = dto.receiptNo?.trim() || await this.nextReceiptNo(orgId, this.fiscalYearBE(now));
    await this.billRepo.query(`UPDATE water_bills_v2 SET receipt_no=$2 WHERE id=$1`, [id, receiptNo]);
    const saved = await this.findBill(id, orgId);
    await this.audit(orgId, userId, 'water_payment', saved, { amount, method, receiptNo });
    return saved;
  }

  /**
   * รับชำระหลายบิลพร้อมกัน (cashier สำนักงาน — ลูกค้าจ่ายหลายเดือนค้างทีเดียว) → เลขใบเสร็จเดียวทั้งชุด
   */
  async payBills(customerId: string, billIds: string[], dto: ReceivePaymentDto, orgId: string, userId: string) {
    if (!billIds?.length) throw new BadRequestException('กรุณาเลือกบิลที่จะรับชำระ');
    const customer = await this.customerRepo.findOne({ where: { id: customerId, organizationId: orgId } });
    if (!customer) throw new NotFoundException('ไม่พบผู้ใช้น้ำรายนี้');
    const now = new Date();
    const method = dto.payMethod || 'cash';
    // เช็คก่อนว่ามีบิลค้างจริงในชุดที่เลือก — กันสร้างเลขใบเสร็จทิ้ง (กิน sequence) ตอนกดจ่ายบิลที่จ่ายไปแล้ว
    const [{ cnt }] = await this.billRepo.query(
      `SELECT COUNT(*)::int AS cnt FROM water_bills_v2
        WHERE id = ANY($1) AND organization_id = $2 AND customer_id = $3 AND status = 'unpaid'`,
      [billIds, orgId, customerId],
    );
    if (!cnt) throw new ConflictException('บิลที่เลือกถูกรับชำระไปแล้ว หรือไม่พบ');
    // ปิดช่องโกง: รับชำระแบบ QR ต้องมีผลตรวจสลิปที่ผ่านแล้ว (ยอดตรง + ยังไม่ถูกใช้)
    if (method === 'qr' && await this.slipVerifyEnabled(orgId)) {
      const [sum] = await this.billRepo.query(
        `SELECT COALESCE(SUM(total_amount),0)::float AS total FROM water_bills_v2
          WHERE id = ANY($1) AND organization_id = $2 AND status = 'unpaid'`, [billIds, orgId]);
      await this.assertSlipVerify(orgId, dto.slipVerifyId, +Number(sum.total).toFixed(2));
    }
    const receiptNo = dto.receiptNo?.trim() || await this.nextReceiptNo(orgId, this.fiscalYearBE(now));
    const paid: WaterBill[] = [];
    for (const id of billIds) {
      const flip = await this.billRepo.createQueryBuilder()
        .update(WaterBill)
        .set({ status: 'paid', paidAt: now, receivedBy: userId, payMethod: method, receiptNo })
        .where('id = :id AND organization_id = :orgId AND customer_id = :cid AND status = :st', { id, orgId, cid: customerId, st: 'unpaid' })
        .execute();
      if (flip.affected) {
        await this.billRepo.query(`UPDATE water_bills_v2 SET paid_amount = total_amount WHERE id = $1`, [id]);
        const b = await this.findBill(id, orgId);
        paid.push(b);
        await this.audit(orgId, userId, 'water_payment', b, { method, receiptNo, batch: true });
      }
    }
    if (!paid.length) throw new ConflictException('บิลที่เลือกถูกรับชำระไปแล้ว หรือไม่พบ');
    // ตัดผลตรวจสลิปเป็น "ใช้แล้ว" — กันเอา verifyId เดิมไปกดซ้ำอีกรอบ
    if (dto.slipVerifyId) {
      await this.billRepo.query(
        `UPDATE water_slip_verify SET consumed_at = now(), bill_ids = $3
          WHERE id = $1 AND organization_id = $2 AND consumed_at IS NULL`,
        [dto.slipVerifyId, orgId, paid.map((b) => b.id)]);
    }
    const total = paid.reduce((s, b) => s + Number(b.totalAmount), 0);
    return { receiptNo, count: paid.length, total, bills: paid };
  }

  /** ยกเลิกการรับชำระ (กรณีรับผิด) — ต้องระบุเหตุผล + บันทึก audit (กันทุจริต) → กลับเป็นค้างชำระ */
// ═══════════════════ กระทบยอดอัตโนมัติจากไฟล์ธนาคาร (KTB Bill Payment) ═══════════════════
  /**
   * รับรายการชำระที่ธนาคารส่งมา (parse จากไฟล์ Excel/CSV ที่ฝั่งหน้าเว็บ map คอลัมน์แล้ว)
   * แล้วจับคู่กับบิลค้างชำระด้วย Ref1(=รหัสผู้ใช้น้ำ) + Ref2(=งวด YYYYMM ถ้ามี) + ยอดเงิน
   * เจอ & ยอดตรง → ตัดชำระ + ออกเลขใบเสร็จ (payMethod='ktb') · บิลที่จ่ายแล้วถูกข้าม (กันซ้ำ)
   * dryRun=true → พรีวิวผลจับคู่ ไม่ตัดชำระจริง
   */
  async reconcile(
    orgId: string, userId: string,
    rows: { ref1: string; ref2?: string; amount: number; paidAt?: string; txnRef?: string }[],
    dryRun = true,
  ) {
    if (!Array.isArray(rows) || !rows.length) throw new BadRequestException('ไม่มีรายการชำระให้ประมวลผล');
    if (rows.length > 20000) throw new BadRequestException('ไฟล์ใหญ่เกินไป (เกิน 20,000 รายการ)');
    const norm = (v: any) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const settled: any[] = [];
    const alreadyPaid: any[] = [];
    const mismatch: any[] = [];
    const unmatched: any[] = [];
    let settledTotal = 0;

    for (const raw of rows) {
      const ref1 = norm(raw.ref1);
      const amount = +Number(raw.amount || 0).toFixed(2);
      if (!ref1 || !(amount > 0)) { unmatched.push({ ...raw, reason: 'ข้อมูลไม่ครบ (ไม่มีรหัส/ยอด)' }); continue; }
      const ref2 = norm(raw.ref2);
      const periodKey = ref2 && /^\d{6}$/.test(ref2) ? Number(ref2) : null;

      // หาบิลของรหัสนี้ (ยังไม่จ่าย) — ถ้ามีงวดใน Ref2 ให้ล็อกงวด ไม่งั้นเรียงเก่าสุดก่อน
      const cands: any[] = await this.billRepo.query(
        `SELECT id, total_amount::float AS "totalAmount", period_year AS "py", period_month AS "pm", status, full_name AS "fullName"
           FROM water_bills_v2
          WHERE organization_id = $1 AND UPPER(customer_code) = $2
            AND ($3::int IS NULL OR (period_year * 100 + period_month) = $3)
          ORDER BY (status = 'unpaid') DESC, period_year, period_month`,
        [orgId, ref1, periodKey],
      );
      if (!cands.length) { unmatched.push({ ref1, ref2, amount, reason: 'ไม่พบผู้ใช้น้ำ/งวดนี้' }); continue; }

      const unpaid = cands.filter((b) => b.status === 'unpaid');
      if (!unpaid.length) { alreadyPaid.push({ ref1, ref2, amount, fullName: cands[0].fullName }); continue; }

      // จับบิลที่ยอดตรง (±1 บาท) ก่อน ไม่งั้นตัวเก่าสุด
      const exact = unpaid.find((b) => Math.abs(b.totalAmount - amount) <= 1);
      const target = exact || unpaid[0];
      if (!exact && Math.abs(target.totalAmount - amount) > 1) {
        mismatch.push({ ref1, ref2, amount, billAmount: target.totalAmount, fullName: target.fullName, billId: target.id,
          reason: `ยอดไม่ตรง (บิล ${target.totalAmount} · จ่าย ${amount})` });
        continue;
      }

      if (dryRun) {
        settled.push({ ref1, ref2, amount, fullName: target.fullName, period: `${target.pm}/${target.py}`, billId: target.id });
        settledTotal += amount;
        continue;
      }

      const now = raw.paidAt ? new Date(raw.paidAt) : new Date();
      const receiptNo = await this.nextReceiptNo(orgId, this.fiscalYearBE(now));
      const flip = await this.billRepo.createQueryBuilder()
        .update(WaterBill)
        .set({ status: 'paid', paidAt: now, receivedBy: userId, payMethod: 'ktb', receiptNo })
        .where('id = :id AND organization_id = :orgId AND status = :st', { id: target.id, orgId, st: 'unpaid' })
        .execute();
      if (!flip.affected) { alreadyPaid.push({ ref1, ref2, amount, fullName: target.fullName }); continue; }
      await this.billRepo.query(`UPDATE water_bills_v2 SET paid_amount = $2 WHERE id = $1`, [target.id, amount]);
      const b = await this.findBill(target.id, orgId);
      await this.audit(orgId, userId, 'water_reconcile', b, { amount, receiptNo, ref1, ref2, txnRef: raw.txnRef });
      settled.push({ ref1, ref2, amount, fullName: target.fullName, period: `${target.pm}/${target.py}`, receiptNo, billId: target.id });
      settledTotal += amount;
    }

    return {
      dryRun,
      summary: {
        total: rows.length,
        settled: settled.length, alreadyPaid: alreadyPaid.length,
        mismatch: mismatch.length, unmatched: unmatched.length,
        settledTotal: +settledTotal.toFixed(2),
      },
      settled, alreadyPaid, mismatch, unmatched,
    };
  }


  // แปลงไฟล์ statement ธนาคาร (Excel/CSV) → หัวตาราง + แถวข้อมูล (ให้หน้าเว็บ map คอลัมน์เอง — ไม่ fix รูปแบบธนาคาร)
  async parseReconcileFile(buffer: Buffer, filename: string): Promise<{ headers: string[]; rows: string[][] }> {
    if (!buffer?.length) throw new BadRequestException('ไม่พบไฟล์');
    let table: string[][] = [];
    if (/\.(xlsx|xls)$/i.test(filename)) {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.worksheets[0];
      if (!ws) throw new BadRequestException('ไฟล์ Excel ไม่มีชีตข้อมูล');
      ws.eachRow((row: any) => {
        const vals = (row.values as any[]).slice(1).map((v) => {
          if (v == null) return '';
          if (typeof v === 'object') return String(v.text ?? v.result ?? v.hyperlink ?? '').trim();
          return String(v).trim();
        });
        table.push(vals);
      });
    } else {
      // CSV/TSV — เดา delimiter จากบรรทัดแรก
      const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
      const delim = (lines[0]?.match(/\t/) ? '\t' : (lines[0]?.match(/;/) && !lines[0]?.match(/,/) ? ';' : ','));
      const parseLine = (line: string): string[] => {
        const out: string[] = []; let cur = ''; let q = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
          else if (ch === '"') q = true;
          else if (ch === delim) { out.push(cur); cur = ''; }
          else cur += ch;
        }
        out.push(cur);
        return out.map((s) => s.trim());
      };
      table = lines.map(parseLine);
    }
    if (table.length > 20001) throw new BadRequestException('ไฟล์ใหญ่เกินไป (เกิน 20,000 แถว)');
    // ตัดแถวว่างท้ายไฟล์
    while (table.length && table[table.length - 1].every((c) => !c)) table.pop();
    if (!table.length) throw new BadRequestException('ไฟล์ว่าง');
    const headers = table[0];
    return { headers, rows: table.slice(1) };
  }


  /** ผู้ให้บริการตรวจสลิปของ อบต. (list ใหม่ก่อน ถ้าไม่มีใช้ค่าเดี่ยวเดิม) */
  private slipProviders(rate: WaterRate): { provider: string; token: string }[] {
    const list = Array.isArray(rate.slipVerifyProviders) ? rate.slipVerifyProviders : [];
    const clean = list.filter((p) => p?.provider && p?.token);
    if (clean.length) return clean;
    if (rate.slipVerifyProvider && rate.slipVerifyToken) return [{ provider: rate.slipVerifyProvider, token: rate.slipVerifyToken }];
    return [];
  }

  /** เปิดตรวจสลิปอัตโนมัติอยู่ไหม (มีผู้ให้บริการอย่างน้อย 1 เจ้า) */
  async slipVerifyEnabled(orgId: string): Promise<boolean> {
    return this.slipProviders(await this.getRate(orgId)).length > 0;
  }

  /**
   * บัญชีปลายทางในสลิป = ของ อบต. ไหม
   * เทียบ 2 ทาง (ผ่านทางใดทางหนึ่งก็พอ):
   *  1) ชื่อผู้รับ — เทียบกับ slipReceiverName (ถ้าตั้ง) หรือ payeeName · รองรับสลิปที่ตัดนามสกุล ("โชคชัย ก")
   *  2) เลขบัญชี/พร้อมเพย์ — เลขท้าย promptpayId โผล่ในเลขบัญชีปลายทาง (กรณีสลิปโชว์เบอร์ตรง)
   * ถ้ายังไม่ตั้งชื่อผู้รับและ payeeName ก็เทียบไม่ได้ → ไม่บล็อก (ยึด สลิปจริง+ยอดตรง+ไม่ซ้ำ เป็นหลัก)
   */
  private receiverMatches(rate: WaterRate, r: { receiverName?: string | null; receiverId?: string | null }): boolean {
    const norm = (s: any) => String(s || '').toLowerCase().replace(/[\s​().]/g, '');
    // 1) เทียบเลขบัญชี/พร้อมเพย์
    const ppId = (rate.promptpayId || '').replace(/\D/g, '');
    const recvDigits = (r.receiverId || '').replace(/\D/g, '');
    if (ppId.length >= 4 && recvDigits && recvDigits.includes(ppId.slice(-4))) return true;
    // 2) เทียบชื่อผู้รับ — เจ้าของบัญชีจริง (slipReceiverName) ก่อน ไม่งั้นชื่อที่แสดงคู่ QR (payeeName)
    const slipName = norm(r.receiverName);
    const expNames = [rate.slipReceiverName, rate.payeeName].map(norm).filter(Boolean);
    if (slipName) {
      for (const exp of expNames) {
        // สลิปมักตัดนามสกุล ("โชคชัย ก") → เทียบว่าฝั่งสั้นเป็นคำนำของฝั่งยาว (อย่างน้อย 3 ตัว/60%)
        const short = slipName.length <= exp.length ? slipName : exp;
        const long = slipName.length <= exp.length ? exp : slipName;
        const need = Math.max(3, Math.floor(short.length * 0.6));
        if (short.length >= 3 && long.startsWith(short.slice(0, need))) return true;
      }
    }
    // เทียบอะไรไม่ได้เลย (ไม่มีทั้งเลขและชื่อให้เทียบ) → ไม่บล็อก
    if (!recvDigits && !slipName) return true;
    if (expNames.length === 0 && ppId.length < 4) return true;
    return false;
  }

  /**
   * ตรวจสลิปหน้างาน สำหรับ "ชุดบิลที่เลือกจะจ่าย" — ใช้ตอนเจ้าหน้าที่รับเงินหน้าบ้าน/เคาน์เตอร์
   * ผ่านทุกเงื่อนไข → บันทึกลงทะเบียนสลิป (water_slip_verify) แล้วคืน verifyId ไปใช้ตอนกดรับชำระ
   * เงื่อนไข: สลิปจริง(ธนาคารยืนยัน) + ยอดตรงผลรวมบิลที่เลือก + บัญชีปลายทางตรง + ยังไม่เคยใช้
   */
  async verifySlipForBills(orgId: string, userId: string, billIds: string[], file: Express.Multer.File) {
    if (!file) throw new BadRequestException('กรุณาแนบรูปสลิป');
    if (!billIds?.length) throw new BadRequestException('กรุณาเลือกบิลที่จะชำระ');
    const bills = await this.billRepo.query(
      `SELECT id, total_amount::float AS "totalAmount", status, customer_id AS "customerId"
         FROM water_bills_v2 WHERE id = ANY($1) AND organization_id = $2`, [billIds, orgId]);
    if (bills.length !== billIds.length) throw new NotFoundException('ไม่พบบิลบางรายการ');
    if (bills.some((b: any) => b.status !== 'unpaid')) throw new ConflictException('มีบิลที่ชำระไปแล้วในรายการที่เลือก');
    const expected = +bills.reduce((s: number, b: any) => s + Number(b.totalAmount), 0).toFixed(2);

    const rate = await this.getRate(orgId);
    const providers = this.slipProviders(rate);
    if (!providers.length) throw new BadRequestException('ยังไม่ได้เปิดตรวจสลิปอัตโนมัติ (ตั้งค่าที่ ตั้งค่า → พร้อมเพย์)');

    const r = await verifySlipMulti(providers, file.buffer, file.mimetype);
    console.log(`[slip-verify:${r.usedProvider}] ok=${r.ok} amount=${r.amount} ref=${r.transRef} recv=${r.receiverId || '-'} recvName=${r.receiverName || '-'}${r.ok ? '' : ' err=' + r.error}`);
    if (!r.ok) return { ok: false, reason: r.error || 'ตรวจสลิปไม่ผ่าน', expected };
    if (r.amount == null || Math.abs(r.amount - expected) > 0.01) {
      return { ok: false, reason: `ยอดในสลิปไม่ตรง (สลิป ${r.amount ?? '—'} · ต้องชำระ ${expected.toFixed(2)})`, expected, slipAmount: r.amount };
    }
    // บัญชีปลายทางต้องเป็นของ อบต. — เทียบด้วยชื่อผู้รับ (หลัก) หรือเลขบัญชี/พร้อมเพย์ (รอง)
    if (!this.receiverMatches(rate, r)) {
      return { ok: false, reason: `บัญชีปลายทางไม่ใช่ของ อบต. (${r.receiverName || r.receiverId || '—'})`, expected };
    }
    // บันทึกทะเบียนสลิป — unique(org, trans_ref) กันสลิปใบเดิมถูกใช้ซ้ำ
    try {
      const [row] = await this.billRepo.query(
        `INSERT INTO water_slip_verify (organization_id, trans_ref, amount, provider, receiver_name, receiver_id, verified_by, bill_ids)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [orgId, r.transRef, expected, r.usedProvider || null, r.receiverName || null, r.receiverId || null, userId, billIds]);
      return { ok: true, verifyId: row.id, amount: expected, transRef: r.transRef, receiverName: r.receiverName, provider: r.usedProvider };
    } catch (e: any) {
      if (String(e?.code) === '23505') return { ok: false, reason: 'สลิปใบนี้ถูกใช้ชำระไปแล้ว (เลขอ้างอิงซ้ำ)', expected };
      throw e;
    }
  }

  /** ตรวจว่า verifyId ใช้ได้กับชุดบิล+ยอดนี้ และยังไม่ถูกใช้ (เรียกก่อนตัดชำระ) */
  private async assertSlipVerify(orgId: string, verifyId: string | undefined, expected: number) {
    if (!verifyId) throw new BadRequestException('ต้องตรวจสลิปให้ผ่านก่อนจึงจะรับชำระแบบ QR ได้');
    const [v] = await this.billRepo.query(
      `SELECT id, amount::float AS amount, consumed_at AS "consumedAt" FROM water_slip_verify
        WHERE id = $1 AND organization_id = $2`, [verifyId, orgId]);
    if (!v) throw new BadRequestException('ไม่พบผลตรวจสลิป กรุณาตรวจสลิปใหม่');
    if (v.consumedAt) throw new ConflictException('ผลตรวจสลิปนี้ถูกใช้ตัดชำระไปแล้ว');
    if (Math.abs(Number(v.amount) - expected) > 0.01)
      throw new BadRequestException(`ยอดที่ตรวจไว้ (${v.amount}) ไม่ตรงกับยอดที่จะรับชำระ (${expected.toFixed(2)})`);
    return v;
  }


    async cancelPayment(id: string, dto: CancelPaymentDto, orgId: string, userId: string) {
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('กรุณาระบุเหตุผลการยกเลิกการรับชำระ');
    const bill = await this.findBill(id, orgId);
    if (bill.status !== 'paid') throw new BadRequestException('บิลนี้ยังไม่ได้รับชำระ');
    const prevReceipt = bill.receiptNo;
    bill.status = 'unpaid';
    bill.paidAt = null; bill.paidAmount = null; bill.receivedBy = null; bill.receiptNo = null; bill.payMethod = null;
    bill.note = [bill.note, `ยกเลิกรับชำระ (${new Date().toLocaleDateString('th-TH')}): ${reason}`].filter(Boolean).join('\n');
    const saved = await this.billRepo.save(bill);
    await this.audit(orgId, userId, 'water_cancel_payment', saved, { reason, cancelledReceiptNo: prevReceipt });
    return saved;
  }

  /** ตรวจสอบ/ค้นประวัติการชำระเงิน — ค้นด้วยชื่อ/รหัส/เลขใบเสร็จ + ช่วงวันจ่าย (แทน check/payment_check) */
  /** เงื่อนไขค้นบิลที่ชำระแล้ว (ใช้ร่วม: หน้าตรวจสอบการชำระ + พิมพ์ใบเสร็จสีฟ้าทั้งชุด) */
  private paidFilter(orgId: string, opts: PaidFilter) {
    const params: any[] = [orgId];
    const conds = [`b.organization_id = $1`, `b.status = 'paid'`];
    if (opts.search?.trim()) { params.push(`%${opts.search.trim()}%`); const p = `$${params.length}`; conds.push(`(b.customer_code ILIKE ${p} OR b.full_name ILIKE ${p})`); }
    if (opts.receiptNo?.trim()) { params.push(`%${opts.receiptNo.trim()}%`); conds.push(`b.receipt_no ILIKE $${params.length}`); }
    // ช่วงวันที่ = วันตามเวลาไทย (DB เป็น UTC)
    if (opts.from) { params.push(opts.from); conds.push(`(b.paid_at AT TIME ZONE 'Asia/Bangkok')::date >= $${params.length}::date`); }
    if (opts.to) { params.push(opts.to); conds.push(`(b.paid_at AT TIME ZONE 'Asia/Bangkok')::date <= $${params.length}::date`); }
    return { params, conds };
  }

  async paymentHistory(orgId: string, opts: PaidFilter & { limit?: number }) {
    const { params, conds } = this.paidFilter(orgId, opts);
    const limit = Math.min(opts.limit || 100, 500);
    const rows = await this.billRepo.query(
      `SELECT b.id, b.customer_code AS "customerCode", b.full_name AS "fullName", b.village_no AS "villageNo",
              b.period_year AS "periodYear", b.period_month AS "periodMonth",
              b.total_amount::float AS "totalAmount", COALESCE(b.paid_amount, b.total_amount)::float AS "paidAmount",
              b.paid_at AS "paidAt", b.receipt_no AS "receiptNo", b.pay_method AS "payMethod",
              COALESCE(NULLIF(TRIM(wu.full_name), ''), NULLIF(TRIM(COALESCE(u.title_th,'') || u.full_name_th), ''), '') AS "collector"
         FROM water_bills_v2 b
         LEFT JOIN water_users wu ON wu.id = b.received_by
         LEFT JOIN users u ON u.id = b.received_by
        WHERE ${conds.join(' AND ')}
        ORDER BY b.paid_at DESC NULLS LAST LIMIT ${limit}`,
      params,
    );
    const total = rows.reduce((s: number, r: any) => s + Number(r.paidAmount), 0);
    return { count: rows.length, total, rows };
  }

  // ─────────────────────── ใบเสร็จสีฟ้า (กระดาษต่อเนื่อง ฟอร์มพิมพ์สำเร็จ)
  static readonly BLUE_MAX = 600;

  /** ใบเสร็จสีฟ้า 1 ใบ (บิลที่ชำระแล้ว) */
  async blueReceiptPdf(id: string, orgId: string) {
    const bill = await this.findBill(id, orgId);
    if (bill.status !== 'paid') throw new BadRequestException('บิลนี้ยังไม่ได้รับชำระ ออกใบเสร็จไม่ได้');
    const buffer = await this.renderBlue(orgId, await this.blueRows(orgId, [`b.organization_id = $1`, `b.id = $2`], [orgId, id]));
    return { buffer, filename: `ใบเสร็จสีฟ้า-${bill.customerCode}-${bill.periodMonth}-${bill.periodYear}.pdf` };
  }

  /** ใบเสร็จสีฟ้าทั้งชุดตามเงื่อนไขค้นหน้า "ตรวจสอบการชำระ" — เรียงรหัสผู้ใช้น้ำ หน้าละ 3 ใบ */
  async blueReceiptsPdf(orgId: string, opts: PaidFilter) {
    if (!opts.search?.trim() && !opts.receiptNo?.trim() && !opts.from && !opts.to)
      throw new BadRequestException('กรุณาระบุเงื่อนไข เช่น ช่วงวันที่รับเงิน');
    const { params, conds } = this.paidFilter(orgId, opts);
    const rows = await this.blueRows(orgId, conds, params);
    if (!rows.length) throw new NotFoundException('ไม่พบรายการชำระตามเงื่อนไข');
    if (rows.length > WaterBillingService.BLUE_MAX)
      throw new BadRequestException(`พิมพ์ได้ครั้งละไม่เกิน ${WaterBillingService.BLUE_MAX} ใบ — แบ่งช่วงวันที่ให้สั้นลง`);
    const tag = opts.from && opts.to && opts.from !== opts.to ? `${opts.from}_${opts.to}` : (opts.from || opts.to || 'ค้นหา');
    return { buffer: await this.renderBlue(orgId, rows), filename: `ใบเสร็จสีฟ้า-${tag}.pdf` };
  }

  /** ใบทดสอบตำแหน่ง — ข้อมูลสมมติ 3 ใบ ไว้ลองพิมพ์บนกระดาษจริงแล้วปรับค่าเลื่อน */
  async blueReceiptTestPdf(orgId: string) {
    const now = new Date();
    const y = now.getFullYear() + 543, m = now.getMonth() + 1;
    const sample = (i: number): BlueReceipt => ({
      customerCode: `0000${i}`, fullName: 'ทดสอบ ตำแหน่งพิมพ์', address: 'บ้านเลขที่ 1 ม.1', meterSerial: null,
      periodYear: y, periodMonth: m, prevReading: 1000, currReading: 1012, units: 12,
      waterAmount: 48, serviceFee: 5, tax: 0, garbageFee: 0, wastewaterFee: 0, total: 53, amountText: bahtText(53),
      prevReadAt: new Date(now.getTime() - 30 * 86400000), currReadAt: now, paidAt: now,
    });
    return { buffer: await this.renderBlue(orgId, [sample(1), sample(2), sample(3)]), filename: 'ทดสอบใบเสร็จสีฟ้า.pdf' };
  }

  private async blueRows(orgId: string, conds: string[], params: any[]): Promise<BlueReceipt[]> {
    const area = this.orgArea(await loadOrgIdentity(this.orgRepo, orgId));
    const rows = await this.billRepo.query(
      `SELECT b.customer_code AS "customerCode", COALESCE(NULLIF(TRIM(c.full_name), ''), b.full_name) AS "fullName",
              c.address, b.village_no AS "villageNo", c.meter_serial AS "meterSerial",
              b.period_year AS "periodYear", b.period_month AS "periodMonth",
              b.prev_reading AS "prevReading", b.curr_reading AS "currReading", b.units,
              b.water_amount::float AS "waterAmount", b.service_fee::float AS "serviceFee", b.tax::float AS tax,
              b.garbage_fee::float AS "garbageFee", b.wastewater_fee::float AS "wastewaterFee",
              COALESCE(b.paid_amount, b.total_amount)::float AS total,
              b.prev_read_at AS "prevReadAt", COALESCE(b.curr_read_at, b.read_at) AS "currReadAt", b.paid_at AS "paidAt"
         FROM water_bills_v2 b
         LEFT JOIN water_customers c ON c.id = b.customer_id
        WHERE ${conds.join(' AND ')}
        ORDER BY b.customer_code, b.period_year, b.period_month
        LIMIT ${WaterBillingService.BLUE_MAX + 1}`,
      params,
    );
    return rows.map((r: any) => {
      const house = r.address?.trim() || (r.villageNo ? `ม.${r.villageNo}` : '');
      return {
        ...r,
        address: /ต\.|ตำบล/.test(house) ? house : [house, area].filter(Boolean).join(' '),
        amountText: bahtText(r.total),
      };
    });
  }

  /** "ต.… อ.… จ.…" จากทะเบียนหน่วยงาน (ที่อยู่ที่ตั้งเองในประปา = สำรอง) */
  private orgArea(o: { subDistrict?: string; district?: string; province?: string; address?: string }, sep = ' ') {
    return [o.subDistrict && `ต.${o.subDistrict}`, o.district && `อ.${o.district}`, o.province && `จ.${o.province}`]
      .filter(Boolean).join(sep) || o.address?.trim() || '';
  }

  private async renderBlue(orgId: string, receipts: BlueReceipt[]): Promise<Buffer> {
    const org = await loadOrgIdentity(this.orgRepo, orgId);
    const rate = await this.getRate(orgId);
    const html = buildBlueReceiptHtml({
      orgName: org.nameTh || '',
      orgAddress: this.orgArea(org, '  '),
      receipts,
      sealImage: rate.receiptSealUrl || null,
      signatureImage: rate.receiptSignatureUrl || null,
      offsetX: Number(rate.receiptOffsetX) || 0,
      offsetY: Number(rate.receiptOffsetY) || 0,
    });
    return this.pdf.generateFromHtml(html, {
      format: undefined, ...BLUE_PAGE, printBackground: true, preferCSSPageSize: true, // ใช้ขนาด @page ตรง ๆ — ไม่งั้น Chromium ปัดขนาดหน้าแล้วข้อความเลื่อน ~0.3 มม.
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
  }

  /** รายงานเงินรับรายวัน แยกวัน×ผู้เก็บ (แบบ ป.32 รายรับประจำวัน) — นับตามวันที่รับเงินจริง (เวลาไทย) ในเดือนนั้น */
  async dailyCollection(orgId: string, year: number, month: number) {
    this.assertPeriod(year, month);
    const rows = await this.billRepo.query(
      `SELECT to_char(b.paid_at AT TIME ZONE 'Asia/Bangkok', 'YYYY-MM-DD') AS "date",
              COALESCE(NULLIF(TRIM(wu.full_name), ''), NULLIF(TRIM(COALESCE(u.title_th,'') || u.full_name_th), ''), 'ไม่ระบุ') AS "collector",
              COUNT(*)::int AS "count", SUM(COALESCE(b.paid_amount, b.total_amount))::float AS "total"
         FROM water_bills_v2 b
         LEFT JOIN water_users wu ON wu.id = b.received_by
         LEFT JOIN users u ON u.id = b.received_by
        WHERE b.organization_id = $1 AND b.status = 'paid'
          AND (b.paid_at AT TIME ZONE 'Asia/Bangkok') >= make_date($2::int - 543, $3::int, 1)
          AND (b.paid_at AT TIME ZONE 'Asia/Bangkok') < make_date($2::int - 543, $3::int, 1) + interval '1 month'
        GROUP BY 1, 2 ORDER BY 1, 2`,
      [orgId, year, month],
    );
    const totalCount = rows.reduce((s: number, r: any) => s + r.count, 0);
    const totalAmount = rows.reduce((s: number, r: any) => s + Number(r.total), 0);
    return { period: { periodYear: year, periodMonth: month }, rows, totalCount, totalAmount };
  }

  // ─────────────────────────────── แจ้งเตือนหน้างาน (มิเตอร์เสีย / ท่อรั่ว)
  /** งวดที่กำหนด: รายที่จดแล้วใช้ 0 หน่วย (มิเตอร์เสีย/บ้านร้าง) + ใช้เกินเกณฑ์ (ท่อรั่ว) */
  async billingAlerts(orgId: string, year: number, month: number, threshold = 50) {
    this.assertPeriod(year, month);
    const zero = await this.billRepo.query(
      `SELECT customer_code AS "customerCode", full_name AS "fullName", village_no AS "villageNo", units
         FROM water_bills_v2
        WHERE organization_id = $1 AND period_year = $2 AND period_month = $3
          AND read_at IS NOT NULL AND units = 0
        ORDER BY village_no, customer_code`,
      [orgId, year, month],
    );
    const high = await this.billRepo.query(
      `SELECT customer_code AS "customerCode", full_name AS "fullName", village_no AS "villageNo", units
         FROM water_bills_v2
        WHERE organization_id = $1 AND period_year = $2 AND period_month = $3
          AND read_at IS NOT NULL AND units > $4
        ORDER BY units DESC`,
      [orgId, year, month, threshold],
    );
    return {
      period: { periodYear: year, periodMonth: month },
      threshold,
      zeroUnits: { count: zero.length, rows: zero },
      highUsage: { count: high.length, rows: high },
    };
  }

  /**
   * ตรวจสอบการจดมิเตอร์ก่อนปิดรอบ (parity /check + APK SearchValidate)
   * 3 แบบ: high=ค่าน้ำสูงผิดปกติ(>threshold) · zero=มิเตอร์คงที่(0 หน่วย) · deviation=เบี่ยงเบน ≥30% เทียบเดือนก่อน
   */
  async verifyReadings(orgId: string, year: number, month: number, threshold = 60, devPct = 30) {
    this.assertPeriod(year, month);
    const rows: any[] = await this.billRepo.query(
      `SELECT b.customer_code AS "customerCode", b.full_name AS "fullName", b.village_no AS "villageNo",
              b.prev_reading AS "prevReading", b.curr_reading AS "currReading", b.units,
              b.total_amount::float AS "totalAmount", b.issue_type AS "issueType",
              b.read_at AS "currReadAt", prevb.units AS "prevUnits", prevb.read_at AS "prevReadAt"
         FROM water_bills_v2 b
         LEFT JOIN LATERAL (
           SELECT units, read_at FROM water_bills_v2 p
            WHERE p.customer_id = b.customer_id
              AND (p.period_year < $2 OR (p.period_year = $2 AND p.period_month < $3))
            ORDER BY p.period_year DESC, p.period_month DESC LIMIT 1
         ) prevb ON true
        WHERE b.organization_id = $1 AND b.period_year = $2 AND b.period_month = $3 AND b.read_at IS NOT NULL
        ORDER BY b.village_no, b.customer_code`,
      [orgId, year, month],
    );
    const high: any[] = [], zero: any[] = [], deviation: any[] = [];
    for (const r of rows) {
      if (r.units > threshold) high.push(r);
      if (r.units === 0) zero.push(r);
      const pu = Number(r.prevUnits);
      if (pu > 0) {
        const pct = (Math.abs(r.units - pu) / pu) * 100;
        if (pct >= devPct) deviation.push({ ...r, deviationPct: Math.round(pct) });
      }
    }
    return {
      period: { periodYear: year, periodMonth: month }, threshold, devPct, totalRead: rows.length,
      high: { count: high.length, rows: high },
      zero: { count: zero.length, rows: zero },
      deviation: { count: deviation.length, rows: deviation },
    };
  }

  /** Export Excel ผลตรวจก่อนปิดรอบ — 3 ชีต (ค่าน้ำสูง / มิเตอร์คงที่ / เบี่ยงเบน) */
  async verifyExcel(orgId: string, year: number, month: number, threshold = 100, devPct = 30): Promise<Buffer> {
    const d = await this.verifyReadings(orgId, year, month, threshold, devPct);
    const wb = new ExcelJS.Workbook();
    const dth = (s: any) => (s ? new Date(s).toLocaleDateString('th-TH') : '');
    const sheet = (name: string, rows: any[], dev = false) => {
      const s = wb.addWorksheet(name);
      s.addRow([`${name} · ${MONTH_TH[month]} ${year}`]);
      s.addRow([]);
      s.addRow(['รหัส', 'ชื่อ-สกุล', 'หมู่', 'จดก่อน', 'จดใหม่', 'หน่วยก่อน', 'หน่วยนี้', ...(dev ? ['เบี่ยงเบน %'] : []), 'ค่าน้ำ', 'วันจดใหม่']);
      s.getRow(3).font = { bold: true };
      for (const r of rows) s.addRow([
        r.customerCode, r.fullName, r.villageNo ?? '', r.prevReading, r.currReading, r.prevUnits ?? '', r.units,
        ...(dev ? [r.deviationPct] : []), Number(r.totalAmount || 0), dth(r.currReadAt),
      ]);
      s.columns = [{ width: 10 }, { width: 28 }, { width: 6 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 9 }, ...(dev ? [{ width: 11 }] : []), { width: 11 }, { width: 13 }];
    };
    sheet('ค่าน้ำสูงผิดปกติ', d.high.rows);
    sheet('มิเตอร์คงที่ (0 หน่วย)', d.zero.rows);
    sheet('เบี่ยงเบน', d.deviation.rows, true);
    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  /**
   * รายการมาตรวัดน้ำที่แจ้งปัญหา (issue_type != normal) — ตรงหน้า "รายชื่อสมาชิกที่มีปัญหา" ของแอพ
   * ไม่ระบุงวด = รวมล่าสุดต่อรายที่ยังมีปัญหา · ระบุงวด = เฉพาะงวดนั้น
   */
  async meterIssues(orgId: string, year?: number, month?: number, villageNo?: number) {
    const params: any[] = [orgId];
    const conds = [`b.organization_id = $1`, `b.issue_type IS NOT NULL`, `b.issue_type <> 'normal'`];
    if (year && month) { params.push(year, month); conds.push(`b.period_year = $2 AND b.period_month = $3`); }
    if (villageNo) { params.push(villageNo); conds.push(`b.village_no = $${params.length}`); }
    const rows = await this.billRepo.query(
      `SELECT b.id, b.customer_id AS "customerId", b.customer_code AS "customerCode", b.full_name AS "fullName",
              b.village_no AS "villageNo", b.period_year AS "periodYear", b.period_month AS "periodMonth",
              b.units, b.issue_type AS "issueType", b.note, b.read_at AS "readAt", b.gps
         FROM water_bills_v2 b
        WHERE ${conds.join(' AND ')}
        ORDER BY b.period_year DESC, b.period_month DESC, b.village_no, b.customer_code
        LIMIT 500`,
      params,
    );
    // สรุปตามประเภทปัญหา
    const byType: Record<string, number> = {};
    for (const r of rows) byType[r.issueType] = (byType[r.issueType] || 0) + 1;
    return { count: rows.length, byType, rows };
  }

  // ═══════════════════════════════ พอร์ทัลสมาชิก (public — ล็อกอินด้วยเบอร์โทร)
  // ทุก endpoint ต้องส่ง phone มาคู่ customerId เสมอ เพื่อยืนยันเจ้าของ (กันไล่สุ่ม id ดูข้อมูลชาวบ้าน)
  private normPhone(p: string): string {
    const d = (p || '').replace(/\D/g, '');
    if (!d) throw new BadRequestException('กรุณากรอกเบอร์โทร');
    return d;
  }

  /** หา org: ถ้าส่ง code มาใช้ code, ถ้าไม่ส่งและมี อบต. เดียวใช้อันนั้น, มากกว่านั้นต้องระบุ */
  private async resolveOrg(code?: string): Promise<string> {
    if (code?.trim()) {
      const [o] = await this.orgRepo.query(
        `SELECT id FROM organizations WHERE UPPER(code) = UPPER($1) AND is_active = true LIMIT 1`, [code.trim()]);
      if (!o) throw new NotFoundException('ไม่พบองค์กรตามรหัสที่ระบุ');
      return o.id;
    }
    const rows = await this.orgRepo.query(`SELECT id FROM organizations WHERE is_active = true LIMIT 2`);
    if (rows.length === 1) return rows[0].id;
    throw new BadRequestException('กรุณาระบุรหัสองค์กร');
  }

  /** normalize บ้านเลขที่สำหรับเทียบ (ตัดช่องว่าง) */
  private normHouse(h?: string): string { return String(h || '').replace(/\s+/g, '').trim(); }

  /**
   * ตรวจว่าผู้เรียกเป็นเจ้าของ customerId จริง — ผ่านถ้า "เบอร์ตรง" หรือ "บ้านเลขที่ตรง" (อย่างใดอย่างหนึ่ง)
   * บ้านเลขที่ใช้เป็น factor 2 สำหรับรายที่ไม่มีเบอร์ (มีเบอร์แค่ ~47% ของทะเบียน)
   */
  private async assertOwner(customerId: string, cred: { phone?: string; house?: string; token?: string }, orgId: string) {
    const norm = cred.phone ? this.normPhone(cred.phone) : '';
    const house = this.normHouse(cred.house);
    const token = (cred.token || '').trim().toUpperCase();
    const [c] = await this.customerRepo.query(
      `SELECT id, customer_code AS "customerCode", full_name AS "fullName", village_no AS "villageNo", address
         FROM water_customers
        WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL
          AND (
            ($3 <> '' AND regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g') = $3)
            OR ($4 <> '' AND regexp_replace(COALESCE(address,''), '[[:space:]]', '', 'g') ILIKE $4 || '%')
            OR ($5 <> '' AND UPPER(access_token) = $5)
          )`,
      [customerId, orgId, norm, house, token]);
    if (!c) throw new NotFoundException('ข้อมูลยืนยันตัวตนไม่ตรงกับผู้ใช้น้ำรายนี้');
    return c;
  }

  /** ล็อกอินด้วยรหัสเข้าถึงจากใบแจ้งหนี้ (สแกน QR หรือพิมพ์เอง) — ปัจจัยเดียวพอ เพราะเป็นรหัสสุ่มที่อยู่ในมือเจ้าของบ้านจริงเท่านั้น */
  async memberLookupByToken(token: string, org?: string) {
    const orgId = await this.resolveOrg(org);
    const t = (token || '').trim().toUpperCase();
    if (!t) throw new BadRequestException('กรุณากรอกรหัสจากใบแจ้งหนี้');
    const accounts = await this.customerRepo.query(
      `SELECT id AS "customerId", customer_code AS "customerCode", full_name AS "fullName",
              village_no AS "villageNo", address
         FROM water_customers
        WHERE organization_id = $1 AND deleted_at IS NULL AND UPPER(access_token) = $2`,
      [orgId, t]);
    if (!accounts.length) throw new NotFoundException('ไม่พบรหัสนี้ในระบบ กรุณาตรวจสอบรหัสบนใบแจ้งหนี้อีกครั้ง');
    return { org, accounts };
  }

  /** ล็อกอิน: กรอกเบอร์ → คืนบ้าน/มิเตอร์ทุกหลังที่ผูกเบอร์นั้น */
  async memberLookup(phone: string, org?: string, cc?: string, house?: string, name?: string, nationalId?: string, token?: string) {
    const orgId = await this.resolveOrg(org);
    // ล็อกอิน 4 ทาง: (ก) รหัสจากใบแจ้งหนี้ (ข) เบอร์โทร (ค) รหัสผู้ใช้น้ำ + บ้านเลขที่ (ง) ชื่อ-สกุล + (บ้านเลขที่ หรือ เลขบัตรประชาชน)
    // (ง) ไว้สำหรับกรณีเบอร์เปลี่ยน/จำรหัสผู้ใช้น้ำไม่ได้ — บังคับคู่กับปัจจัยที่ 2 เสมอ กัน enumerate ชื่อคนอื่นดูข้อมูล
    if (token?.trim()) {
      return this.memberLookupByToken(token, org);
    }
    if (name?.trim()) {
      const h = this.normHouse(house);
      const nid = (nationalId || '').replace(/\D/g, '');
      if (!h && !nid) throw new BadRequestException('กรุณากรอกบ้านเลขที่หรือเลขบัตรประชาชน');
      const params: any[] = [orgId, name.trim()];
      const orParts: string[] = [];
      if (h) { params.push(h); orParts.push(`regexp_replace(COALESCE(address,''), '[[:space:]]', '', 'g') ILIKE $${params.length} || '%'`); }
      if (nid) { params.push(nid); orParts.push(`regexp_replace(COALESCE(national_id,''), '[^0-9]', '', 'g') = $${params.length}`); }
      const accounts = await this.customerRepo.query(
        `SELECT id AS "customerId", customer_code AS "customerCode", full_name AS "fullName",
                village_no AS "villageNo", address
           FROM water_customers
          WHERE organization_id = $1 AND deleted_at IS NULL
            AND full_name ILIKE '%' || $2 || '%'
            AND (${orParts.join(' OR ')})
          ORDER BY customer_code`,
        params);
      if (!accounts.length) throw new NotFoundException('ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจสอบชื่อ-สกุลและบ้านเลขที่/เลขบัตรประชาชน');
      return { org, accounts };
    }
    if (cc?.trim()) {
      const h = this.normHouse(house);
      if (!h) throw new BadRequestException('กรุณากรอกบ้านเลขที่');
      const accounts = await this.customerRepo.query(
        `SELECT id AS "customerId", customer_code AS "customerCode", full_name AS "fullName",
                village_no AS "villageNo", address
           FROM water_customers
          WHERE organization_id = $1 AND deleted_at IS NULL
            AND UPPER(customer_code) = UPPER($2)
            AND regexp_replace(COALESCE(address,''), '[[:space:]]', '', 'g') ILIKE $3 || '%'
          ORDER BY customer_code`,
        [orgId, cc.trim(), h]);
      if (!accounts.length) throw new NotFoundException('รหัสผู้ใช้น้ำกับบ้านเลขที่ไม่ตรงกัน กรุณาตรวจสอบ');
      return { org, accounts };
    }
    // (ข) "จำรหัสไม่ได้" — เบอร์โทร + บ้านเลขที่ ต้องตรงทั้งคู่ในบ้านเดียวกัน
    // เบอร์อย่างเดียวไม่พอ: เบอร์ไม่ใช่ความลับ (รู้เบอร์เพื่อนบ้าน = เห็นชื่อ/ที่อยู่/ยอดค้างบ้านนั้น) และหลายบ้านใช้เบอร์เดียวกัน
    const norm = this.normPhone(phone);
    const h = this.normHouse(house);
    if (!h) throw new BadRequestException('กรุณากรอกบ้านเลขที่');
    const accounts = await this.customerRepo.query(
      `SELECT id AS "customerId", customer_code AS "customerCode", full_name AS "fullName",
              village_no AS "villageNo", address
         FROM water_customers
        WHERE organization_id = $1 AND deleted_at IS NULL
          AND regexp_replace(COALESCE(phone,''), '[^0-9]', '', 'g') = $2
          AND regexp_replace(COALESCE(address,''), '[[:space:]]', '', 'g') ~* $3
        ORDER BY customer_code`,
      [orgId, norm, this.houseNoPattern(h)]);
    // ข้อความเดียวกันทั้ง "ไม่มีเบอร์นี้" และ "บ้านเลขที่ไม่ตรง" — ไม่บอกใบ้ว่าเบอร์มีในระบบหรือไม่
    if (!accounts.length) throw new NotFoundException('เบอร์โทรกับบ้านเลขที่ไม่ตรงกับข้อมูลในระบบ — ดูรหัสบนใบแจ้งหนี้/ใบเสร็จ หรือติดต่อ อบต.');
    return { org, accounts };
  }

  /**
   * บ้านเลขที่ที่พิมพ์ (ตัดช่องว่างแล้ว) → regex เทียบต้นที่อยู่แบบ "จบเลข" กัน "18" ไปตรง "180 ม.2"
   * ที่อยู่ในทะเบียนเป็นแบบ "18 ม.1" / "12/3 หมู่ 4" — พิมพ์แค่ "18" หรือพิมพ์ครบ "18 ม.1" ก็ได้
   */
  private houseNoPattern(h: string): string {
    return '^' + h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^0-9/]|$)';
  }

  /**
   * หา "บ้านอื่น" ของคนที่จ่ายหลายบ้าน (ชื่อเดียวกัน) — ใช้ได้เฉพาะหลัง verify เจ้าของบ้านใดบ้านหนึ่งสำเร็จแล้วเท่านั้น
   * (เรียก assertOwner ก่อนเสมอ กันคนที่ยังไม่ผ่าน 2-factor มา enumerate หาบ้านคนอื่นจากชื่อ)
   */
  async memberFindLinked(customerId: string, cred: { phone?: string; house?: string; token?: string }, org?: string) {
    const orgId = await this.resolveOrg(org);
    const owner = await this.assertOwner(customerId, cred, orgId);
    const accounts = await this.customerRepo.query(
      `SELECT id AS "customerId", customer_code AS "customerCode", full_name AS "fullName",
              village_no AS "villageNo", address
         FROM water_customers
        WHERE organization_id = $1 AND deleted_at IS NULL
          AND full_name = $2 AND id <> $3
        ORDER BY customer_code`,
      [orgId, owner.fullName, customerId]);
    return { org, accounts };
  }

  /** ค้างชำระของบ้านหนึ่ง + QR พร้อมเพย์ (รวมยอด และรายบิล) */
  /** QR พร้อมเพย์ตามยอดที่ประชาชนเลือกจ่าย (ยืนยันเจ้าของบ้านก่อน) */
  async memberQr(customerId: string, cred: { phone?: string; house?: string; token?: string }, org: string | undefined, amount: number) {
    const orgId = await this.resolveOrg(org);
    await this.assertOwner(customerId, cred, orgId);
    const amt = Math.max(0, +Number(amount || 0).toFixed(2));
    if (!(amt > 0)) throw new BadRequestException('ยอดชำระไม่ถูกต้อง');
    const rate = await this.getRate(orgId);
    const qr = await promptpayQrDataUrl(rate.promptpayId, amt, rate.promptpayType);
    return { qr, amount: amt, payeeName: rate.payeeName || null, hasPromptpay: !!qr };
  }

  async memberOutstanding(customerId: string, phone: string, org?: string, house?: string, token?: string) {
    const orgId = await this.resolveOrg(org);
    const cust = await this.assertOwner(customerId, { phone, house, token }, orgId);
    const bills = await this.billRepo.query(
      `SELECT id AS "billId", period_year AS "periodYear", period_month AS "periodMonth",
              prev_reading AS "prevReading", curr_reading AS "currReading", units,
              total_amount::float AS "totalAmount", read_at AS "readAt",
              slip_status AS "slipStatus", slip_note AS "slipNote"
         FROM water_bills_v2
        WHERE organization_id = $1 AND customer_id = $2 AND status = 'unpaid' AND read_at IS NOT NULL
        ORDER BY period_year, period_month`,
      [orgId, customerId]);
    const total = bills.reduce((s: number, b: any) => s + Number(b.totalAmount), 0);
    const rate = await this.getRate(orgId);
    // QR รวมยอดค้างทั้งหมด (จ่ายทีเดียว) — ฝั่งเว็บใช้แค่ก้อนนี้ ไม่ต้องออก QR รายบิลให้เปลือง
    const totalQr = await promptpayQrDataUrl(rate.promptpayId, total, rate.promptpayType);
    return { customer: cust, count: bills.length, total, payeeName: rate.payeeName, totalQr, bills };
  }

  /** ประวัติการชำระ (บิลที่จ่ายแล้ว) */
  async memberPayments(customerId: string, phone: string, org?: string, house?: string, token?: string) {
    const orgId = await this.resolveOrg(org);
    const cust = await this.assertOwner(customerId, { phone, house, token }, orgId);
    const bills = await this.billRepo.query(
      `SELECT id AS "billId", period_year AS "periodYear", period_month AS "periodMonth",
              total_amount::float AS "totalAmount", paid_at AS "paidAt", receipt_no AS "receiptNo", pay_method AS "payMethod"
         FROM water_bills_v2
        WHERE organization_id = $1 AND customer_id = $2 AND status = 'paid'
        ORDER BY paid_at DESC`,
      [orgId, customerId]);
    return { customer: cust, count: bills.length, total: bills.reduce((s: number, b: any) => s + Number(b.totalAmount), 0), bills };
  }

  /** ประวัติการใช้น้ำ (จดก่อน/จดหลัง/ใช้ไป รายเดือน) */
  async memberUsage(customerId: string, phone: string, org?: string, house?: string, token?: string) {
    const orgId = await this.resolveOrg(org);
    const cust = await this.assertOwner(customerId, { phone, house, token }, orgId);
    const rows = await this.billRepo.query(
      `SELECT id AS "billId", period_year AS "periodYear", period_month AS "periodMonth",
              prev_reading AS "prevReading", curr_reading AS "currReading", units
         FROM water_bills_v2
        WHERE organization_id = $1 AND customer_id = $2 AND read_at IS NOT NULL
        ORDER BY period_year DESC, period_month DESC`,
      [orgId, customerId]);
    return { customer: cust, count: rows.length, totalUnits: rows.reduce((s: number, r: any) => s + Number(r.units), 0), rows };
  }

  /** เอกสารบิล (ใบแจ้งหนี้/ใบเสร็จ) ฝั่งสมาชิก — ยืนยันเจ้าของก่อนออก PDF */
  async memberBillDoc(customerId: string, billId: string, phone: string, kind: BillDocKind, org?: string, house?: string, token?: string) {
    const orgId = await this.resolveOrg(org);
    await this.assertOwner(customerId, { phone, house, token }, orgId);
    const bill = await this.findBill(billId, orgId);
    if (bill.customerId !== customerId) throw new NotFoundException('ไม่พบบิลของผู้ใช้น้ำรายนี้');
    return this.billDocPdf(billId, orgId, kind);
  }

  // ═══════════════════ สลิปโอนเงิน (อบต.อยากรับ QR แต่ vendor ไม่เปิด — เราเติมให้) ═══════════════════
  /** ประชาชนอัปโหลดสลิปของบิลที่ค้าง → เก็บรูป + ตั้งสถานะรอตรวจ */
  /** #4 บันทึกรูปมาตรวัดน้ำ (หลักฐานการจด) — เจ้าหน้าที่ถ่ายตอนจด */
  async saveMeterPhoto(billId: string, orgId: string, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('กรุณาแนบรูปมาตร');
    const bill = await this.findBill(billId, orgId);
    bill.meterPhotoUrl = await this.storage.storeCitizenAttachment(file.buffer, file.mimetype, file.originalname, 'water-meters');
    await this.billRepo.save(bill);
    return { ok: true, meterPhotoUrl: this.storage.signUrlIfPrivate(bill.meterPhotoUrl) };
  }

  /** billIds หลายใบ = จ่ายรวมกันด้วย QR เดียว + สลิปใบเดียว (เขียนสถานะลงทุกบิล แต่ slip_trans_ref จริงลงแค่บิล anchor กัน unique index ชน) */
  async memberUploadSlip(customerId: string, billIds: string[], phone: string, file: Express.Multer.File, org?: string, house?: string, token?: string) {
    if (!file) throw new BadRequestException('กรุณาแนบรูปสลิป');
    if (!billIds?.length) throw new BadRequestException('ไม่พบบิลที่เลือก');
    const orgId = await this.resolveOrg(org);
    await this.assertOwner(customerId, { phone, house, token }, orgId);
    const bills = await Promise.all(billIds.map((id) => this.findBill(id, orgId)));
    if (bills.some((b) => b.customerId !== customerId)) throw new NotFoundException('ไม่พบบิลของผู้ใช้น้ำรายนี้');
    if (bills.some((b) => b.status === 'paid')) throw new ConflictException('มีบิลที่ชำระแล้วอยู่ในรายการ');

    const slipUrl = await this.storage.storeCitizenAttachment(file.buffer, file.mimetype, file.originalname, 'water-slips');
    const now = new Date();
    const groupIds = bills.map((b) => b.id).sort();
    const anchorId = groupIds[0];
    // ตรวจสลิปกับธนาคารทันที (ถ้า อบต. ตั้งผู้ให้บริการไว้) — ผ่าน = 'verified', ไม่ผ่าน = 'pending' + เหตุผล
    const v = await this.runSlipVerify(bills, orgId, file.buffer, file.mimetype);
    for (const b of bills) {
      b.slipUrl = slipUrl;
      b.slipUploadedAt = now;
      b.slipStatus = v.status; b.slipNote = v.note || null;
      b.slipAmount = v.amount != null ? v.amount.toFixed(2) : null;
      b.slipVerifiedAt = v.status === 'verified' ? now : null;
      // slip_trans_ref เขียนแค่บิล anchor ใบเดียว — UQ_water_bill_slip_ref เป็น partial index (WHERE NOT NULL)
      // เขียนซ้ำหลายแถวจะชน แต่ NULL หลายแถวไม่ถือว่าชนกัน
      b.slipTransRef = b.id === anchorId ? (v.transRef || null) : null;
      b.slipGroupBillIds = groupIds.length > 1 ? groupIds : null;
    }
    try {
      await this.billRepo.save(bills);
    } catch (e: any) {
      // ชนกับ unique index กันสลิปซ้ำ = สลิปใบนี้ถูกใช้ตัดชำระบิลอื่นแล้ว
      if (String(e?.code) === '23505') {
        for (const b of bills) {
          b.slipStatus = 'pending'; b.slipTransRef = null; b.slipAmount = null; b.slipVerifiedAt = null;
          b.slipNote = 'สลิปนี้ถูกใช้ชำระบิลอื่นไปแล้ว (เลขอ้างอิงซ้ำ)';
        }
        await this.billRepo.save(bills);
      } else throw e;
    }
    return { ok: true, status: bills[0].slipStatus, note: bills[0].slipNote, count: bills.length };
  }

  /**
   * ตรวจสลิปกับผู้ให้บริการ + เทียบกับยอดรวมของบิลทั้งกลุ่ม (บิลเดียวก็ผ่าน path เดียวกัน ส่ง array 1 ใบ) → ตัดสินสถานะ
   * ผ่านทุกเงื่อนไข (สลิปจริง + ยอดตรง + บัญชีปลายทางตรง + ไม่ซ้ำ) = 'verified'
   * ไม่ตั้ง provider = 'pending' (ยืนยันมือแบบเดิม) · ตรวจไม่ผ่าน = 'pending' + เหตุผลให้เจ้าหน้าที่ดู
   */
  private async runSlipVerify(
    bills: WaterBill[], orgId: string, buffer: Buffer, mime: string,
  ): Promise<{ status: string; note?: string; transRef?: string | null; amount?: number | null }> {
    const rate = await this.getRate(orgId);
    const providers = this.slipProviders(rate);
    if (!providers.length) {
      return { status: 'pending', note: 'รอเจ้าหน้าที่ตรวจสอบ (ยังไม่ได้เปิดตรวจสลิปอัตโนมัติ)' };
    }
    const r = await verifySlipMulti(providers, buffer, mime);
    // log ไว้ debug ตอนต่อ key จริง (ไม่ log token) — ถ้า field mapping เพี้ยนจะเห็น raw ที่นี่
    console.log(`[slip-verify:${r.usedProvider}] ok=${r.ok} amount=${r.amount} ref=${r.transRef} recv=${r.receiverId || r.receiverName || '-'}${r.ok ? '' : ' err=' + r.error}`,
      r.ok ? '' : JSON.stringify(r.raw || {}).slice(0, 800));
    if (!r.ok) return { status: 'pending', note: 'ตรวจสลิปอัตโนมัติไม่ผ่าน: ' + (r.error || 'อ่านสลิปไม่ได้') + ' — ให้เจ้าหน้าที่ตรวจเอง' };

    const billAmt = bills.reduce((s, b) => s + Number(b.totalAmount), 0);
    if (r.amount == null || Math.abs(r.amount - billAmt) > 0.01) {
      return { status: 'pending', transRef: r.transRef, amount: r.amount,
        note: `ยอดในสลิปไม่ตรงกับบิล (สลิป ${r.amount ?? '—'} · บิล ${billAmt.toFixed(2)})` };
    }
    // เทียบบัญชีปลายทาง — ด้วยชื่อผู้รับ (หลัก) หรือเลขบัญชี/พร้อมเพย์ (รอง)
    if (!this.receiverMatches(rate, r)) {
      return { status: 'pending', transRef: r.transRef, amount: r.amount,
        note: `บัญชีปลายทางในสลิปไม่ตรงกับของ อบต. (${r.receiverName || r.receiverId || '—'}) — ตรวจเอง` };
    }
    // กันสลิปซ้ำระดับ query (index เป็น backstop)
    const [dup] = await this.billRepo.query(
      `SELECT id FROM water_bills_v2 WHERE organization_id = $1 AND slip_trans_ref = $2 AND id <> ALL($3) LIMIT 1`,
      [orgId, r.transRef, bills.map((b) => b.id)]);
    if (dup) return { status: 'pending', note: 'สลิปนี้ถูกใช้ชำระบิลอื่นไปแล้ว (เลขอ้างอิงซ้ำ)' };

    return { status: 'verified', transRef: r.transRef, amount: r.amount,
      note: `ตรวจสลิปผ่าน · ยอด ${r.amount?.toFixed(2)} · อ้างอิง ${r.transRef}` };
  }

  /** รายการสลิป (เจ้าหน้าที่) พร้อม signed URL รูป · status: 'pending' รอตรวจ | 'rejected' รอส่งหลักฐานใหม่ */
  async pendingSlips(orgId: string, status: 'pending' | 'rejected' = 'pending') {
    // มุมมองปกติ = สลิปที่รอดำเนินการ (รอตรวจ 'pending' + ตรวจผ่านแล้ว 'verified')
    const statuses = status === 'rejected' ? ['rejected'] : ['pending', 'verified'];
    const rows = await this.billRepo.query(
      `SELECT b.id AS "billId", b.customer_code AS "customerCode", b.full_name AS "fullName", b.village_no AS "villageNo",
              b.period_year AS "periodYear", b.period_month AS "periodMonth", b.total_amount::float AS "totalAmount",
              b.water_amount::float AS "waterAmount", b.service_fee::float AS "serviceFee",
              b.prev_reading AS "prevReading", b.curr_reading AS "currReading", b.units,
              b.slip_url AS "slipUrl", b.slip_uploaded_at AS "slipUploadedAt", b.slip_note AS "slipNote",
              b.slip_status AS "slipStatus", b.slip_trans_ref AS "slipTransRef", b.slip_amount::float AS "slipAmount",
              b.slip_verified_at AS "slipVerifiedAt", b.slip_group_bill_ids AS "slipGroupBillIds", c.phone
         FROM water_bills_v2 b LEFT JOIN water_customers c ON c.id = b.customer_id
        WHERE b.organization_id = $1 AND b.slip_status = ANY($2) AND b.status = 'unpaid'
        ORDER BY (b.slip_status = 'verified') DESC, b.slip_uploaded_at`,
      [orgId, statuses],
    );
    for (const r of rows) r.slipUrl = this.storage.signUrlIfPrivate(r.slipUrl);
    // บัญชีปลายทางที่เงินควรเข้า (ให้เจ้าหน้าที่เทียบกับสลิป) + เปิดตรวจสลิปอัตโนมัติอยู่ไหม
    const rate = await this.getRate(orgId);
    const payee = { name: rate.payeeName || null, promptpayId: rate.promptpayId || null, promptpayType: rate.promptpayType || null };
    return { count: rows.length, payee, autoVerify: this.slipProviders(rate).length > 0, rows };
  }

  /**
   * เจ้าหน้าที่ยืนยันสลิป → รับชำระ (ช่องทาง qr) + ออกใบเสร็จอัตโนมัติ + audit
   * ถ้าบิลนี้อยู่ในกลุ่ม (slipGroupBillIds — จ่ายหลายบิล+สลิปใบเดียว) ยืนยันทั้งกลุ่มพร้อมกัน ใช้ receiptNo เดียวกัน
   * (กด "ยืนยันชำระ" จากบิลไหนในกลุ่มก็ได้ผลเหมือนกัน)
   */
  async confirmSlip(id: string, orgId: string, userId: string) {
    const bill = await this.findBill(id, orgId);
    const groupIds = bill.slipGroupBillIds?.length ? bill.slipGroupBillIds : [bill.id];
    const bills = groupIds.length > 1 ? await Promise.all(groupIds.map((gid) => this.findBill(gid, orgId))) : [bill];
    for (const b of bills) {
      if (!['pending', 'verified'].includes(b.slipStatus)) throw new BadRequestException('บิลนี้ไม่มีสลิปรอตรวจ');
      if (b.status === 'paid') throw new ConflictException('บิลนี้ชำระแล้ว');
    }
    // ปิดช่องโกง: ถ้า อบต. เปิดตรวจสลิปอัตโนมัติ → กดยืนยันได้เฉพาะสลิปที่ระบบตรวจผ่าน (verified) เท่านั้น
    const rate = await this.getRate(orgId);
    const gated = this.slipProviders(rate).length > 0;
    if (gated && bills.some((b) => b.slipStatus !== 'verified'))
      throw new BadRequestException(`ยืนยันไม่ได้ — สลิปยังไม่ผ่านการตรวจกับธนาคาร${bill.slipNote ? ` (${bill.slipNote})` : ''}`);

    const now = new Date();
    const receiptNo = bill.receiptNo || await this.nextReceiptNo(orgId, this.fiscalYearBE(now));
    const paid: WaterBill[] = [];
    // atomic ทีละบิล: กัน 2 คนยืนยันสลิปเดียวกัน / หรือรับเงินสดชนกับยืนยันสลิป (เก็บซ้ำ)
    for (const b of bills) {
      const flip = await this.billRepo.createQueryBuilder()
        .update(WaterBill)
        .set({ status: 'paid', paidAt: now, paidAmount: Number(b.totalAmount).toFixed(2), receivedBy: userId, payMethod: 'qr', slipStatus: 'confirmed', receiptNo })
        .where('id = :id AND organization_id = :orgId AND status = :st AND slip_status = :ss', { id: b.id, orgId, st: 'unpaid', ss: b.slipStatus })
        .execute();
      if (flip.affected) paid.push(b);
    }
    if (!paid.length) throw new ConflictException('บิลนี้เพิ่งถูกดำเนินการโดยเจ้าหน้าที่อีกคน');
    for (const b of paid) {
      const saved = await this.findBill(b.id, orgId);
      await this.audit(orgId, userId, 'water_slip_confirm', saved, { receiptNo, amount: saved.totalAmount, batch: paid.length > 1 });
    }
    return { ok: true, receiptNo, count: paid.length, billIds: paid.map((b) => b.id) };
  }
  /**
   * เจ้าหน้าที่ปฏิเสธสลิป (เบลอ/ยอดไม่ตรง) → คงค้างชำระ + เหตุผลให้ประชาชนแก้
   * กลุ่มบิลเดียวกัน (จ่ายรวม+สลิปใบเดียว) ปฏิเสธพร้อมกันทั้งกลุ่ม
   */
  async rejectSlip(id: string, dto: CancelPaymentDto, orgId: string, userId: string) {
    const reason = dto.reason?.trim();
    if (!reason) throw new BadRequestException('กรุณาระบุเหตุผลที่ปฏิเสธสลิป');
    const bill = await this.findBill(id, orgId);
    const groupIds = bill.slipGroupBillIds?.length ? bill.slipGroupBillIds : [bill.id];
    const bills = groupIds.length > 1 ? await Promise.all(groupIds.map((gid) => this.findBill(gid, orgId))) : [bill];
    if (bills.some((b) => b.slipStatus !== 'pending')) throw new BadRequestException('บิลนี้ไม่มีสลิปรอตรวจ');
    for (const b of bills) { b.slipStatus = 'rejected'; b.slipNote = reason; }
    const saved = await this.billRepo.save(bills);
    for (const b of saved) await this.audit(orgId, userId, 'water_slip_reject', b, { reason });
    return { ok: true, count: saved.length, billIds: saved.map((b) => b.id) };
  }
}
