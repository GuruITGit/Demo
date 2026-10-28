import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { WaterBill } from '../../database/entities/water-bill.entity';
import { Organization } from '../../database/entities/organization.entity';
import { loadOrgIdentity } from './org-identity';
import { PdfService } from '../pdf/pdf.service';
import { MONTH_TH } from './water.service';
import { buildArLedgerHtml, buildP32Html, buildP32RegisterHtml, buildP31Html, buildVatHtml, ArRow, P32Row, P31Row, VatRow, ReportOrg } from './report-html';

export type P32Sort = 'receipt' | 'date' | 'collector';

export type ArMode = 'period' | 'outstanding';

/**
 * รายงานราชการกองการประปา — ป.17 บัญชีลูกหนี้ค่าน้ำ · ป.32 รายงานเงินรายรับ
 * ใช้บิลจริง (water_bills_v2) เป็นแหล่งเดียว เพื่อให้ตัวเลขตรงกับหน้าจดมิเตอร์/รับชำระ
 */
/**
 * รายงานฝั่ง "เงินรับ" (ป.32 / ทะเบียนรายรับ / ภาษีขาย) นับตาม **วันที่รับเงินจริง** ในเดือนที่เลือก — ไม่ใช่งวดของบิล
 * (เดือนนี้รับเงินบิลค้างงวดเก่าก็ต้องนับเป็นรายรับเดือนนี้) · DB เป็น UTC → แปลงเป็นเวลาไทยก่อนตัดวัน
 * $2 = ปี พ.ศ. · $3 = เดือน
 */
const PAID_BKK = `(b.paid_at AT TIME ZONE 'Asia/Bangkok')`;
const PAID_IN_MONTH = `${PAID_BKK} >= make_date($2::int - 543, $3::int, 1)
          AND ${PAID_BKK} < make_date($2::int - 543, $3::int, 1) + interval '1 month'`;

@Injectable()
export class WaterReportService {
  constructor(
    @InjectRepository(WaterBill) private billRepo: Repository<WaterBill>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    private readonly pdf: PdfService,
  ) {}

  private async org(orgId: string): Promise<ReportOrg> {
    const o = await loadOrgIdentity(this.orgRepo, orgId);
    const [rate] = await this.orgRepo.query(
      `SELECT report_signature_url AS sig FROM water_rate WHERE organization_id = $1 LIMIT 1`, [orgId]);
    return { nameTh: o.nameTh, type: o.type, signatureImage: rate?.sig || undefined };
  }

  private assertPeriod(year: number, month: number) {
    if (!Number.isInteger(year) || year < 2500 || year > 2700 || !Number.isInteger(month) || month < 1 || month > 12)
      throw new BadRequestException('กรุณาระบุปี (พ.ศ.) และเดือนให้ถูกต้อง');
  }

  private arPeriodLabel(year: number, month: number, mode: ArMode): string {
    const m = `${MONTH_TH[month]} ${year}`;
    return mode === 'outstanding' ? `ยอดค้างชำระสะสม ณ งวด ${m}` : `ประจำงวด ${m}`;
  }

  // ─────────────────────── ป.17 บัญชีลูกหนี้ค่าน้ำ
  /**
   * แยกประเภทเงิน "ค้างชำระ" (status=unpaid) ต่อรายลูกหนี้ + สรุปรายหมู่
   * mode=period      → บิลเฉพาะงวดนั้น (คิด ตั้งเก็บ/เก็บได้/ค้าง ของงวด)
   * mode=outstanding → บิลค้างสะสมทุกงวดจนถึงงวดที่เลือก (ทวงหนี้)
   */
  async arLedger(orgId: string, year: number, month: number, mode: ArMode = 'period', villageNo?: number) {
    this.assertPeriod(year, month);
    const params: any[] = [orgId, year, month];
    let periodWhere: string;
    if (mode === 'outstanding') {
      periodWhere = `AND b.status = 'unpaid' AND (b.period_year < $2 OR (b.period_year = $2 AND b.period_month <= $3))`;
    } else {
      periodWhere = `AND b.period_year = $2 AND b.period_month = $3 AND b.status IN ('paid','unpaid')`;
    }
    let vFilter = '';
    if (villageNo) { params.push(villageNo); vFilter = `AND b.village_no = $${params.length}`; }

    // แยกประเภทของยอด "ค้าง" (unpaid) — ป.17 แสดงลูกหนี้คงค้างเป็นหลัก
    const SUMS = `
      COALESCE(SUM(b.total_amount) FILTER (WHERE b.status IN ('paid','unpaid')), 0)::float AS billed,
      COALESCE(SUM(COALESCE(b.paid_amount, b.total_amount)) FILTER (WHERE b.status = 'paid'), 0)::float AS collected,
      COALESCE(SUM(b.total_amount)    FILTER (WHERE b.status = 'unpaid'), 0)::float AS outstanding,
      COALESCE(SUM(b.water_amount)    FILTER (WHERE b.status = 'unpaid'), 0)::float AS water,
      COALESCE(SUM(b.service_fee)     FILTER (WHERE b.status = 'unpaid'), 0)::float AS service,
      COALESCE(SUM(b.wastewater_fee)  FILTER (WHERE b.status = 'unpaid'), 0)::float AS wastewater,
      COALESCE(SUM(b.garbage_fee)     FILTER (WHERE b.status = 'unpaid'), 0)::float AS garbage,
      COALESCE(SUM(b.tax)             FILTER (WHERE b.status = 'unpaid'), 0)::float AS tax`;

    const byVillage = await this.billRepo.query(
      `SELECT b.village_no AS "villageNo",
              COUNT(DISTINCT b.customer_id)::int AS customers,
              COUNT(DISTINCT b.customer_id) FILTER (WHERE b.status = 'unpaid')::int AS debtors,
              ${SUMS}
         FROM water_bills_v2 b
        WHERE b.organization_id = $1 ${periodWhere} ${vFilter}
        GROUP BY b.village_no ORDER BY b.village_no`,
      params,
    );

    // ชื่อ/หมู่ยึดจากทะเบียนผู้ใช้น้ำ (c) เสมอ — ไม่ใช้ snapshot ในบิล เพราะ full_name เก่าเป็นชื่อคนจด
    // (ถ้า group ด้วย b.full_name จะแตกเป็นหลายแถวต่อคน + รหัสซ้ำ)
    const customers: ArRow[] = await this.billRepo.query(
      `SELECT c.customer_code AS "customerCode", c.full_name AS "fullName", c.village_no AS "villageNo",
              COUNT(*) FILTER (WHERE b.status = 'unpaid')::int AS "unpaidCount",
              ${SUMS}
         FROM water_bills_v2 b
         JOIN water_customers c ON c.id = b.customer_id
        WHERE b.organization_id = $1 ${periodWhere} ${vFilter}
        GROUP BY c.customer_code, c.full_name, c.village_no
       HAVING COALESCE(SUM(b.total_amount) FILTER (WHERE b.status = 'unpaid'), 0) > 0
        ORDER BY c.village_no, c.customer_code`,
      params,
    );

    // ── ยอดยกมา (carry) = ค้างสะสมของงวดก่อนหน้า — เฉพาะ period mode (ทำ ป.17 ให้เป็นบัญชียกยอดตามฟอร์มจริง)
    const carryV: Record<string, number> = {};
    const carryC: Record<string, number> = {};
    if (mode === 'period') {
      const cutoff = `b.status = 'unpaid' AND (b.period_year < $2 OR (b.period_year = $2 AND b.period_month < $3))`;
      for (const r of await this.billRepo.query(
        `SELECT b.village_no AS vn, COALESCE(SUM(b.total_amount), 0)::float AS carry
           FROM water_bills_v2 b WHERE b.organization_id = $1 AND ${cutoff} ${vFilter}
          GROUP BY b.village_no`, params)) carryV[String(r.vn)] = r.carry;
      for (const r of await this.billRepo.query(
        `SELECT c.customer_code AS cc, COALESCE(SUM(b.total_amount), 0)::float AS carry
           FROM water_bills_v2 b JOIN water_customers c ON c.id = b.customer_id
          WHERE b.organization_id = $1 AND ${cutoff} ${vFilter}
          GROUP BY c.customer_code`, params)) carryC[String(r.cc)] = r.carry;
    }
    // balance (คงค้างรวม) = ยอดยกมา + ค้างงวดนี้
    for (const v of byVillage as any[]) { v.carry = carryV[String(v.villageNo)] || 0; v.balance = v.carry + v.outstanding; }
    for (const c2 of customers as any[]) { c2.carry = carryC[String(c2.customerCode)] || 0; c2.balance = c2.carry + c2.outstanding; }

    const totals = (byVillage as any[]).reduce(
      (a: any, v: any) => ({
        customers: a.customers + v.customers, debtors: a.debtors + v.debtors,
        carry: a.carry + (v.carry || 0),
        billed: a.billed + v.billed, collected: a.collected + v.collected, outstanding: a.outstanding + v.outstanding,
        balance: a.balance + (v.balance || 0),
        water: a.water + v.water, service: a.service + v.service, wastewater: a.wastewater + v.wastewater,
        garbage: a.garbage + v.garbage, tax: a.tax + v.tax,
      }),
      { customers: 0, debtors: 0, carry: 0, billed: 0, collected: 0, outstanding: 0, balance: 0, water: 0, service: 0, wastewater: 0, garbage: 0, tax: 0 },
    );

    return { period: { periodYear: year, periodMonth: month }, mode, byVillage, customers, totals };
  }

  async arLedgerExcel(orgId: string, year: number, month: number, mode: ArMode, villageNo?: number): Promise<Buffer> {
    const d = await this.arLedger(orgId, year, month, mode, villageNo);
    const wb = new ExcelJS.Workbook();

    const t = d.totals as any;
    const s1 = wb.addWorksheet('สรุปรายหมู่');
    s1.addRow(['บัญชีลูกหนี้ค่าน้ำประปา (ป.17)', this.arPeriodLabel(year, month, mode)]);
    s1.addRow([]);
    if (mode === 'period') {
      // ป.17 บัญชียกยอด: ยอดยกมา + ตั้งเก็บงวดนี้ + เก็บได้ + คงค้างยกไป
      s1.addRow(['หมู่', 'ลูกหนี้(ราย)', 'ยอดยกมา', 'ตั้งเก็บงวดนี้', 'เก็บได้', 'คงค้างยกไป']);
      s1.getRow(3).font = { bold: true };
      for (const v of d.byVillage as any[]) s1.addRow([v.villageNo ?? '-', v.debtors, v.carry, v.billed, v.collected, v.balance]);
      s1.addRow(['รวม', t.debtors, t.carry, t.billed, t.collected, t.balance]).font = { bold: true };
      s1.columns = [{ width: 8 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 13 }, { width: 14 }];
    } else {
      s1.addRow(['หมู่', 'ลูกหนี้(ราย)', 'ค้างชำระ', 'ค่าน้ำ', 'ค่าบริการ', 'ค่าบำบัด', 'ค่าขยะ', 'ภาษี']);
      s1.getRow(3).font = { bold: true };
      for (const v of d.byVillage as any[]) s1.addRow([v.villageNo ?? '-', v.debtors, v.outstanding, v.water, v.service, v.wastewater, v.garbage, v.tax]);
      s1.addRow(['รวม', t.debtors, t.outstanding, t.water, t.service, t.wastewater, t.garbage, t.tax]).font = { bold: true };
      s1.columns = [{ width: 8 }, { width: 12 }, { width: 13 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 11 }, { width: 10 }];
    }

    const s2 = wb.addWorksheet('รายลูกหนี้');
    s2.addRow(['รหัส', 'ชื่อ-สกุล', 'หมู่', 'งวดค้าง', 'ค่าน้ำ', 'ค่าบริการ', 'ค่าบำบัด', 'ค่าขยะ', 'ภาษี', 'รวมค้างชำระ']);
    s2.getRow(1).font = { bold: true };
    for (const r of d.customers) {
      s2.addRow([r.customerCode, r.fullName, r.villageNo ?? '-', r.unpaidCount, r.water, r.service, r.wastewater, r.garbage, r.tax, r.outstanding]);
    }
    s2.columns = [{ width: 10 }, { width: 30 }, { width: 6 }, { width: 9 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 11 }, { width: 10 }, { width: 14 }];

    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  async arLedgerPdf(orgId: string, year: number, month: number, mode: ArMode, villageNo?: number): Promise<{ buffer: Buffer; filename: string }> {
    const d = await this.arLedger(orgId, year, month, mode, villageNo);
    const html = buildArLedgerHtml({
      org: await this.org(orgId),
      periodLabel: this.arPeriodLabel(year, month, mode),
      mode,
      rows: d.customers as any,
      totals: d.totals as any,
    });
    const buffer = await this.pdf.generateFromHtml(html, { format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
    return { buffer, filename: `บัญชีลูกหนี้ค่าน้ำ-ป17-${month}-${year}.pdf` };
  }

  // ─────────────────────── รายงานการใช้น้ำรายผู้ใช้ (use_water_user)
  /** สรุปหน่วยการใช้น้ำของงวด แยกรายหมู่ + รายผู้ใช้ (เทียบเดือนก่อน) */
  async usageReport(orgId: string, year: number, month: number, villageNo?: number) {
    this.assertPeriod(year, month);
    const params: any[] = [orgId, year, month];
    let vf = '';
    if (villageNo) { params.push(villageNo); vf = `AND b.village_no = $${params.length}`; }

    const byVillage = await this.billRepo.query(
      `SELECT b.village_no AS "villageNo",
              COUNT(*) FILTER (WHERE b.read_at IS NOT NULL)::int AS "readCount",
              COALESCE(SUM(b.units), 0)::int AS "totalUnits",
              COALESCE(ROUND(AVG(b.units) FILTER (WHERE b.read_at IS NOT NULL), 1), 0)::float AS "avgUnits",
              COALESCE(SUM(b.water_amount), 0)::float AS "waterAmount"
         FROM water_bills_v2 b
        WHERE b.organization_id = $1 AND b.period_year = $2 AND b.period_month = $3 ${vf}
        GROUP BY b.village_no ORDER BY b.village_no`,
      params,
    );

    // รายผู้ใช้ + หน่วยเดือนก่อน (LATERAL) — ดูใครใช้เยอะ/ผิดปกติ
    const customers = await this.billRepo.query(
      `SELECT c.customer_code AS "customerCode", c.full_name AS "fullName", c.village_no AS "villageNo",
              b.prev_reading AS "prevReading", b.curr_reading AS "currReading", b.units,
              prev.units AS "prevUnits"
         FROM water_bills_v2 b
         JOIN water_customers c ON c.id = b.customer_id
         LEFT JOIN LATERAL (
           SELECT units FROM water_bills_v2 p
            WHERE p.customer_id = b.customer_id
              AND (p.period_year < $2 OR (p.period_year = $2 AND p.period_month < $3))
            ORDER BY p.period_year DESC, p.period_month DESC LIMIT 1
         ) prev ON true
        WHERE b.organization_id = $1 AND b.period_year = $2 AND b.period_month = $3 AND b.read_at IS NOT NULL ${vf}
        ORDER BY b.units DESC LIMIT 500`,
      params,
    );

    const totals = byVillage.reduce(
      (a: any, v: any) => ({ readCount: a.readCount + v.readCount, totalUnits: a.totalUnits + v.totalUnits, waterAmount: a.waterAmount + v.waterAmount }),
      { readCount: 0, totalUnits: 0, waterAmount: 0 },
    );
    (totals as any).avgUnits = totals.readCount ? +(totals.totalUnits / totals.readCount).toFixed(1) : 0;
    return { period: { periodYear: year, periodMonth: month }, byVillage, customers, totals };
  }

  async usageExcel(orgId: string, year: number, month: number, villageNo?: number): Promise<Buffer> {
    const d = await this.usageReport(orgId, year, month, villageNo);
    const wb = new ExcelJS.Workbook();
    const s1 = wb.addWorksheet('สรุปหมู่');
    s1.addRow(['รายงานการใช้น้ำ', `${MONTH_TH[month]} ${year}`]);
    s1.addRow([]);
    s1.addRow(['หมู่', 'จดแล้ว(ราย)', 'รวมหน่วย', 'เฉลี่ย/ราย', 'ค่าน้ำ']);
    s1.getRow(3).font = { bold: true };
    for (const v of d.byVillage as any[]) s1.addRow([v.villageNo ?? '-', v.readCount, v.totalUnits, v.avgUnits, v.waterAmount]);
    const t = d.totals as any;
    s1.addRow(['รวม', t.readCount, t.totalUnits, t.avgUnits, t.waterAmount]).font = { bold: true };
    s1.columns = [{ width: 8 }, { width: 12 }, { width: 12 }, { width: 11 }, { width: 13 }];

    const s2 = wb.addWorksheet('รายผู้ใช้');
    s2.addRow(['รหัส', 'ชื่อ-สกุล', 'หมู่', 'มิเตอร์ก่อน', 'มิเตอร์หลัง', 'หน่วยงวดนี้', 'หน่วยงวดก่อน']);
    s2.getRow(1).font = { bold: true };
    for (const r of d.customers as any[]) s2.addRow([r.customerCode, r.fullName, r.villageNo ?? '-', r.prevReading, r.currReading, r.units, r.prevUnits ?? '']);
    s2.columns = [{ width: 10 }, { width: 30 }, { width: 6 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 13 }];
    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  // ─────────────────────── ป.32 รายงานเงินรายรับ
  async p32(orgId: string, year: number, month: number) {
    this.assertPeriod(year, month);
    const rows: P32Row[] = await this.billRepo.query(
      `SELECT to_char(${PAID_BKK}, 'YYYY-MM-DD') AS "date",
              COALESCE(NULLIF(TRIM(wu.full_name), ''), NULLIF(TRIM(COALESCE(u.title_th,'') || u.full_name_th), ''), 'ไม่ระบุ') AS "collector",
              COUNT(*)::int AS "count",
              COALESCE(SUM(b.water_amount), 0)::float AS "water",
              COALESCE(SUM(b.service_fee), 0)::float AS "service",
              COALESCE(SUM(b.wastewater_fee), 0)::float AS "wastewater",
              COALESCE(SUM(b.garbage_fee), 0)::float AS "garbage",
              COALESCE(SUM(b.tax), 0)::float AS "tax",
              COALESCE(SUM(COALESCE(b.paid_amount, b.total_amount)), 0)::float AS "total"
         FROM water_bills_v2 b
         LEFT JOIN water_users wu ON wu.id = b.received_by
         LEFT JOIN users u ON u.id = b.received_by
        WHERE b.organization_id = $1 AND b.status = 'paid' AND ${PAID_IN_MONTH}
        GROUP BY 1, 2 ORDER BY 1, 2`,
      [orgId, year, month],
    );
    const totals = rows.reduce(
      (a, r) => ({
        count: a.count + r.count, water: a.water + r.water, service: a.service + r.service,
        wastewater: a.wastewater + r.wastewater, garbage: a.garbage + r.garbage, tax: a.tax + r.tax, total: a.total + r.total,
      }),
      { count: 0, water: 0, service: 0, wastewater: 0, garbage: 0, tax: 0, total: 0 },
    );
    return { period: { periodYear: year, periodMonth: month }, rows, totals };
  }

  async p32Excel(orgId: string, year: number, month: number): Promise<Buffer> {
    const d = await this.p32(orgId, year, month);
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet('เงินรายรับ');
    s.addRow(['รายงานเงินรายรับค่าน้ำประปา (ป.32)', `${MONTH_TH[month]} ${year}`]);
    s.addRow([]);
    s.addRow(['วันที่รับเงิน', 'ผู้รับเงิน', 'จำนวนราย', 'ค่าน้ำ', 'ค่าบริการ', 'ค่าบำบัด', 'ค่าขยะ', 'ภาษี', 'รวมรับ']);
    s.getRow(3).font = { bold: true };
    for (const r of d.rows) s.addRow([r.date, r.collector, r.count, r.water, r.service, r.wastewater, r.garbage, r.tax, r.total]);
    const t = d.totals;
    s.addRow(['รวมทั้งสิ้น', '', t.count, t.water, t.service, t.wastewater, t.garbage, t.tax, t.total]).font = { bold: true };
    s.columns = [{ width: 14 }, { width: 26 }, { width: 10 }, { width: 13 }, { width: 12 }, { width: 12 }, { width: 11 }, { width: 10 }, { width: 14 }];
    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  async p32Pdf(orgId: string, year: number, month: number): Promise<{ buffer: Buffer; filename: string }> {
    const d = await this.p32(orgId, year, month);
    const html = buildP32Html({
      org: await this.org(orgId),
      periodLabel: `ประจำเดือน ${MONTH_TH[month]} ${year}`,
      rows: d.rows,
      totals: d.totals,
    });
    const buffer = await this.pdf.generateFromHtml(html, { format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
    return { buffer, filename: `รายงานเงินรายรับค่าน้ำ-ป32-${month}-${year}.pdf` };
  }

  // ─────────────────────── ป.32 ทะเบียนคุมเงินรายรับ (รายใบเสร็จ) — แต่ละใบเสร็จ 1 บรรทัด + variant การเรียง
  private p32SortLabel(sort: P32Sort): string {
    return sort === 'date' ? 'เรียงตามวันที่รับเงิน' : sort === 'collector' ? 'เรียงตามผู้รับเงิน' : 'เรียงตามเลขที่ใบเสร็จ';
  }

  async p32Register(orgId: string, year: number, month: number, sort: P32Sort = 'receipt') {
    this.assertPeriod(year, month);
    const order = sort === 'date' ? 'b.paid_at, b.receipt_no'
      : sort === 'collector' ? 'collector, b.paid_at'
      : 'b.receipt_no NULLS LAST, b.paid_at';
    const rows = await this.billRepo.query(
      `SELECT b.receipt_no AS "receiptNo", b.paid_at AS "paidAt",
              b.customer_code AS "customerCode", c.full_name AS "fullName", c.village_no AS "villageNo",
              COALESCE(NULLIF(TRIM(wu.full_name), ''), NULLIF(TRIM(COALESCE(u.title_th,'') || u.full_name_th), ''), 'ไม่ระบุ') AS collector,
              b.water_amount::float AS water, b.service_fee::float AS service,
              b.wastewater_fee::float AS wastewater, b.garbage_fee::float AS garbage, b.tax::float AS tax,
              COALESCE(b.paid_amount, b.total_amount)::float AS total
         FROM water_bills_v2 b
         JOIN water_customers c ON c.id = b.customer_id
         LEFT JOIN water_users wu ON wu.id = b.received_by
         LEFT JOIN users u ON u.id = b.received_by
        WHERE b.organization_id = $1 AND b.status = 'paid' AND ${PAID_IN_MONTH}
        ORDER BY ${order}`,
      [orgId, year, month],
    );
    const totals = rows.reduce(
      (a: any, r: any) => ({
        count: a.count + 1, water: a.water + r.water, service: a.service + r.service,
        wastewater: a.wastewater + r.wastewater, garbage: a.garbage + r.garbage, tax: a.tax + r.tax, total: a.total + r.total,
      }),
      { count: 0, water: 0, service: 0, wastewater: 0, garbage: 0, tax: 0, total: 0 },
    );
    return { period: { periodYear: year, periodMonth: month }, sort, rows, totals };
  }

  async p32RegisterPdf(orgId: string, year: number, month: number, sort: P32Sort = 'receipt'): Promise<{ buffer: Buffer; filename: string }> {
    const d = await this.p32Register(orgId, year, month, sort);
    const html = buildP32RegisterHtml({
      org: await this.org(orgId),
      periodLabel: `ประจำเดือน ${MONTH_TH[month]} ${year}`,
      sortLabel: this.p32SortLabel(sort),
      rows: d.rows as any,
      totals: d.totals as any,
    });
    const buffer = await this.pdf.generateFromHtml(html, { format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
    return { buffer, filename: `ทะเบียนรายรับค่าน้ำ-ป32-${month}-${year}.pdf` };
  }

  async p32RegisterExcel(orgId: string, year: number, month: number, sort: P32Sort = 'receipt'): Promise<Buffer> {
    const d = await this.p32Register(orgId, year, month, sort);
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet('ทะเบียนรายรับ');
    s.addRow(['ทะเบียนคุมเงินรายรับค่าน้ำประปา (ป.32)', `${MONTH_TH[month]} ${year}`, this.p32SortLabel(sort)]);
    s.addRow([]);
    s.addRow(['ลำดับ', 'เลขที่ใบเสร็จ', 'วันที่', 'รหัส', 'ชื่อ-สกุล', 'หมู่', 'ค่าน้ำ', 'ค่าบริการ', 'ค่าบำบัด', 'ค่าขยะ', 'ภาษี', 'รวม', 'ผู้รับเงิน']);
    s.getRow(3).font = { bold: true };
    (d.rows as any[]).forEach((r, i) => s.addRow([
      i + 1, r.receiptNo || '', r.paidAt ? new Date(r.paidAt).toLocaleDateString('th-TH') : '',
      r.customerCode, r.fullName, r.villageNo ?? '', r.water, r.service, r.wastewater, r.garbage, r.tax, r.total, r.collector,
    ]));
    const t = d.totals as any;
    s.addRow(['รวม', '', '', '', '', '', t.water, t.service, t.wastewater, t.garbage, t.tax, t.total, '']).font = { bold: true };
    s.columns = [{ width: 6 }, { width: 12 }, { width: 11 }, { width: 9 }, { width: 26 }, { width: 6 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 9 }, { width: 8 }, { width: 11 }, { width: 22 }];
    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  // ═══════════════════ ป.31 ทะเบียนการอ่านมาตรวัดน้ำ ═══════════════════
  async p31(orgId: string, year: number, month: number) {
    this.assertPeriod(year, month);
    const rows: P31Row[] = await this.billRepo.query(
      `SELECT b.customer_code AS "customerCode",
              COALESCE(NULLIF(TRIM(b.full_name), ''), 'ไม่ระบุ') AS "fullName",
              b.village_no AS "villageNo",
              b.prev_reading AS "prevReading", b.curr_reading AS "currReading", b.units AS "units",
              to_char(COALESCE(b.curr_read_at, b.read_at), 'YYYY-MM-DD') AS "readAt",
              b.reader_name AS "readerName"
         FROM water_bills_v2 b
        WHERE b.organization_id = $1 AND b.period_year = $2 AND b.period_month = $3
        ORDER BY b.village_no NULLS LAST, b.customer_code`,
      [orgId, year, month],
    );
    const totalUnits = rows.reduce((a, r) => a + Number(r.units || 0), 0);
    return { period: { periodYear: year, periodMonth: month }, rows, totalUnits };
  }

  async p31Excel(orgId: string, year: number, month: number): Promise<Buffer> {
    const d = await this.p31(orgId, year, month);
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet('อ่านมาตร');
    s.addRow(['ทะเบียนการอ่านมาตรวัดน้ำ (ป.31)', `${MONTH_TH[month]} ${year}`]);
    s.addRow([]);
    s.addRow(['ลำดับ', 'เลขที่ผู้ใช้น้ำ', 'ชื่อผู้ใช้น้ำ', 'หมู่', 'เลขมาตรครั้งก่อน', 'เลขมาตรครั้งนี้', 'หน่วยที่ใช้', 'วันที่จดมาตร', 'ผู้จดมาตร']);
    s.getRow(3).font = { bold: true };
    d.rows.forEach((r, i) => s.addRow([i + 1, r.customerCode, r.fullName, r.villageNo ?? '', r.prevReading, r.currReading, r.units, r.readAt ?? '', r.readerName ?? '']));
    s.addRow(['', '', '', '', '', 'รวมหน่วยที่ใช้', d.totalUnits, '', '']).font = { bold: true };
    s.columns = [{ width: 6 }, { width: 14 }, { width: 28 }, { width: 6 }, { width: 15 }, { width: 15 }, { width: 11 }, { width: 14 }, { width: 22 }];
    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  async p31Pdf(orgId: string, year: number, month: number): Promise<{ buffer: Buffer; filename: string }> {
    const d = await this.p31(orgId, year, month);
    const html = buildP31Html({ org: await this.org(orgId), periodLabel: `ประจำเดือน ${MONTH_TH[month]} ${year}`, rows: d.rows, totalUnits: d.totalUnits });
    const buffer = await this.pdf.generateFromHtml(html, { format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
    return { buffer, filename: `ทะเบียนอ่านมาตร-ป31-${month}-${year}.pdf` };
  }

  // ═══════════════════ รายงานภาษีขาย (VAT) ═══════════════════
  async vat(orgId: string, year: number, month: number) {
    this.assertPeriod(year, month);
    const rows: VatRow[] = await this.billRepo.query(
      `SELECT to_char(${PAID_BKK}, 'YYYY-MM-DD') AS "paidAt", b.receipt_no AS "receiptNo",
              COALESCE(NULLIF(TRIM(b.full_name), ''), 'ไม่ระบุ') AS "fullName",
              (COALESCE(b.paid_amount, b.total_amount) - COALESCE(b.tax, 0))::float AS "base",
              COALESCE(b.tax, 0)::float AS "tax",
              COALESCE(b.paid_amount, b.total_amount)::float AS "total"
         FROM water_bills_v2 b
        WHERE b.organization_id = $1 AND b.status = 'paid' AND ${PAID_IN_MONTH}
        ORDER BY b.paid_at, b.receipt_no`,
      [orgId, year, month],
    );
    const totals = rows.reduce((a, r) => ({ base: a.base + r.base, tax: a.tax + r.tax, total: a.total + r.total }), { base: 0, tax: 0, total: 0 });
    return { period: { periodYear: year, periodMonth: month }, rows, totals };
  }

  async vatExcel(orgId: string, year: number, month: number): Promise<Buffer> {
    const d = await this.vat(orgId, year, month);
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet('ภาษีขาย');
    s.addRow(['รายงานภาษีขาย (ภาษีมูลค่าเพิ่ม)', `${MONTH_TH[month]} ${year}`]);
    s.addRow([]);
    s.addRow(['ลำดับ', 'วัน/เดือน/ปี', 'เลขที่ใบเสร็จ', 'ชื่อผู้ซื้อสินค้า/บริการ', 'มูลค่าก่อนภาษี', 'ภาษีมูลค่าเพิ่ม', 'รวมเงิน']);
    s.getRow(3).font = { bold: true };
    d.rows.forEach((r, i) => s.addRow([i + 1, r.paidAt, r.receiptNo ?? '', r.fullName, r.base, r.tax, r.total]));
    const t = d.totals;
    s.addRow(['', '', '', 'รวมทั้งสิ้น', t.base, t.tax, t.total]).font = { bold: true };
    s.columns = [{ width: 6 }, { width: 13 }, { width: 16 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 }];
    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  async vatPdf(orgId: string, year: number, month: number): Promise<{ buffer: Buffer; filename: string }> {
    const d = await this.vat(orgId, year, month);
    const html = buildVatHtml({ org: await this.org(orgId), periodLabel: `ประจำเดือน ${MONTH_TH[month]} ${year}`, rows: d.rows, totals: d.totals });
    const buffer = await this.pdf.generateFromHtml(html, { format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
    return { buffer, filename: `รายงานภาษีขาย-VAT-${month}-${year}.pdf` };
  }

}
