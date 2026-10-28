import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { WaterCustomer } from '../../database/entities/water-customer.entity';
import { WaterNotice } from '../../database/entities/water-notice.entity';
import { WaterCollectionSummary } from '../../database/entities/water-collection.entity';
import { WaterApplication } from '../../database/entities/water-application.entity';
import { Organization } from '../../database/entities/organization.entity';
import { loadOrgIdentity } from './org-identity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { paginate } from '../../common/dto/pagination.dto';
import { bahtText } from '../../common/utils/baht-text.util';
import { PdfService } from '../pdf/pdf.service';
import { buildNoticeHtml, buildBulkNoticeHtml, type NoticeOrg } from './notice-html';
import { noticeFontCss } from './notice-fonts';
import { buildApplicationHtml, buildContractHtml, AppDoc } from './application-html';
import { parseCustomerFile, ImportRow, ImportIssue } from './customer-import';
import {
  CreateWaterCustomerDto, UpdateWaterCustomerDto, WaterCustomerQueryDto, BulkUnitPriceDto,
  CreateWaterNoticeDto, WaterNoticeQueryDto, SaveCollectionDto, CollectionQueryDto,
  SaveWaterApplicationDto,
} from './dto/water.dto';

export const MONTH_TH: Record<number, string> = {
  1: 'มกราคม', 2: 'กุมภาพันธ์', 3: 'มีนาคม', 4: 'เมษายน', 5: 'พฤษภาคม', 6: 'มิถุนายน',
  7: 'กรกฎาคม', 8: 'สิงหาคม', 9: 'กันยายน', 10: 'ตุลาคม', 11: 'พฤศจิกายน', 12: 'ธันวาคม',
};

/**
 * CTE รวมข้อมูลสรุปการเก็บค่าน้ำ 2 แหล่งต่อ งวด×หมู่ ($1 = organization_id):
 *   - บิลจริงจาก field app (water_bills_v2) — ใช้ก่อนถ้ามี
 *   - ตัวเลขป้อนมือ (water_collection_summary) — fallback (เช่น import ตัวเลขจากระบบเดิม)
 * ให้ dashboard สะท้อนของจริงเมื่อเริ่มจดในระบบ แต่ยังดูงวดเก่าที่ป้อนมือไว้ได้
 */
const MERGED_COLLECTION_CTE = `
  WITH bill_agg AS (
    SELECT period_year AS py, period_month AS pm, village_no AS vn,
           COUNT(*) FILTER (WHERE read_at IS NOT NULL)::int AS customers,
           COALESCE(SUM(total_amount) FILTER (WHERE read_at IS NOT NULL), 0) AS billed,
           COALESCE(SUM(total_amount) FILTER (WHERE status = 'paid'), 0) AS collected
      FROM water_bills_v2 WHERE organization_id = $1 AND village_no IS NOT NULL
     GROUP BY 1, 2, 3
  ),
  summ AS (
    SELECT period_year AS py, period_month AS pm, village_no AS vn,
           customers::int AS customers, billed_amount AS billed, collected_amount AS collected
      FROM water_collection_summary WHERE organization_id = $1
  ),
  merged AS (
    SELECT COALESCE(b.py, s.py) AS py, COALESCE(b.pm, s.pm) AS pm, COALESCE(b.vn, s.vn) AS vn,
           COALESCE(b.customers, s.customers, 0) AS customers,
           COALESCE(b.billed, s.billed, 0)::float AS billed,
           COALESCE(b.collected, s.collected, 0)::float AS collected
      FROM bill_agg b FULL OUTER JOIN summ s ON b.py = s.py AND b.pm = s.pm AND b.vn = s.vn
  )`;

@Injectable()
export class WaterService {
  constructor(
    @InjectRepository(WaterCustomer) private customerRepo: Repository<WaterCustomer>,
    @InjectRepository(WaterNotice) private noticeRepo: Repository<WaterNotice>,
    @InjectRepository(WaterCollectionSummary) private collectionRepo: Repository<WaterCollectionSummary>,
    @InjectRepository(WaterApplication) private appRepo: Repository<WaterApplication>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private readonly pdf: PdfService,
  ) {}

  // ─────────────────────────────────────── แบบคำขอใช้น้ำ/สัญญา
  async getApplication(customerId: string, orgId: string) {
    await this.findCustomer(customerId, orgId); // กันข้ามองค์กร
    const app = await this.appRepo.findOne({ where: { customerId, organizationId: orgId } });
    return app || null;
  }

  async saveApplication(customerId: string, dto: SaveWaterApplicationDto, orgId: string, userId: string) {
    await this.findCustomer(customerId, orgId);
    const existing = await this.appRepo.findOne({ where: { customerId, organizationId: orgId } });
    if (existing) {
      Object.assign(existing, dto);
      return this.appRepo.save(existing);
    }
    return this.appRepo.save(this.appRepo.create({ ...dto, customerId, organizationId: orgId, createdBy: userId } as any));
  }

  /** รวมข้อมูลผู้ใช้น้ำ + คำขอ เป็น payload สำหรับเรนเดอร์เอกสาร */
  private async buildAppDoc(customerId: string, orgId: string): Promise<AppDoc> {
    const c = await this.findCustomer(customerId, orgId);
    const app = (await this.appRepo.findOne({ where: { customerId, organizationId: orgId } })) || ({} as WaterApplication);
    const org = await loadOrgIdentity(this.orgRepo, orgId);
    return {
      org: { nameTh: org.nameTh, type: org.type },
      customerCode: c.customerCode, fullName: c.fullName,
      address: c.address, soi: c.soi, road: c.road, villageNo: c.villageNo,
      nationalId: c.nationalId, meterSerial: c.meterSerial, meterSizeCode: c.meterSizeCode,
      app: {
        age: app.age, idExpiry: app.idExpiry, occupation: app.occupation, workplace: app.workplace,
        purpose: app.purpose, operateAt: app.operateAt, nearby: app.nearby,
        pipeSize: app.pipeSize, faucetSize: app.faucetSize, faucetCount: app.faucetCount,
        depositAmount: app.depositAmount, receiver: app.receiver, applyDate: app.applyDate,
        contractSigner: app.contractSigner, witness1: app.witness1, witness2: app.witness2,
      },
    };
  }

  async applicationPdf(customerId: string, orgId: string, kind: 'application' | 'contract'): Promise<{ buffer: Buffer; filename: string }> {
    const doc = await this.buildAppDoc(customerId, orgId);
    const html = kind === 'contract' ? buildContractHtml(doc) : buildApplicationHtml(doc);
    const buffer = await this.pdf.generateFromHtml(html, { format: 'A4', printBackground: true, preferCSSPageSize: true });
    const label = kind === 'contract' ? 'สัญญาการใช้น้ำ' : 'แบบคำขอใช้น้ำ';
    return { buffer, filename: `${label}-${doc.customerCode}.pdf` };
  }

  /**
   * บันทึกประวัติกิจกรรม — ต้องใส่ organizationId เสมอ ไม่งั้นไม่โผล่ในหน้าประวัติกิจกรรม
   * และ module เป็น NOT NULL (ลืมใส่แล้ว insert ไม่ผ่านทั้ง transaction)
   */
  private async audit(orgId: string, userId: string, action: string, resourceId: string, title: string) {
    await this.auditRepo.save({
      organizationId: orgId, userId, action, module: 'water',
      resourceType: 'water_notice', resourceId, resourceTitle: title,
    } as any);
  }

  // ─────────────────────────────────────── ทะเบียนผู้ใช้น้ำ
  async findCustomers(orgId: string, dto: WaterCustomerQueryDto) {
    // raw query เพื่อ join ยอดค้างสะสมต่อรายมาแสดงในลิสต์ (ไม่ดึง legacy(jsonb) ก้อนใหญ่)
    const params: any[] = [orgId];
    const conds = ['c.organization_id = $1', 'c.deleted_at IS NULL'];
    if (dto.villageNo) { params.push(dto.villageNo); conds.push(`c.village_no = $${params.length}`); }
    if (dto.status === 'active') conds.push(`c.usage_status = '01'`);
    else if (dto.status === 'inactive') conds.push(`c.usage_status IN ('02','03')`);
    if (dto.search?.trim()) {
      params.push(`%${dto.search.trim()}%`);
      const p = `$${params.length}`;
      conds.push(`(c.customer_code ILIKE ${p} OR c.full_name ILIKE ${p} OR c.national_id ILIKE ${p} OR c.address ILIKE ${p} OR c.phone ILIKE ${p})`);
    }
    const where = conds.join(' AND ');

    // สรุปภาพรวมยอดค้าง (ตามตัวกรองหมู่/สถานะ/ค้นหา แต่ไม่รวมตัวกรองค้างชำระเอง — ให้เห็นบริบทเทียบทั้งหมด)
    const [summary] = await this.customerRepo.query(
      `SELECT
          COUNT(*)::int AS "totalCustomers",
          COUNT(*) FILTER (WHERE COALESCE(o.unpaid_count, 0) > 0)::int AS "overdueCount",
          COALESCE(SUM(o.outstanding), 0)::float AS "totalOutstanding"
         FROM water_customers c
         LEFT JOIN (SELECT customer_id, SUM(total_amount) AS outstanding, COUNT(*) AS unpaid_count
                      FROM water_bills_v2 WHERE organization_id = $1 AND status = 'unpaid' GROUP BY customer_id) o
           ON o.customer_id = c.id
        WHERE ${where}`,
      params,
    );

    // กรองตามจำนวนงวดที่ค้าง — ใส่เพิ่มเฉพาะ query หลัก (ไม่กระทบ summary ด้านบน)
    let overdueCond = '';
    if (dto.overdue === '0') overdueCond = 'AND COALESCE(o.unpaid_count, 0) = 0';
    else if (dto.overdue === '1') overdueCond = 'AND COALESCE(o.unpaid_count, 0) = 1';
    else if (dto.overdue === '2') overdueCond = 'AND COALESCE(o.unpaid_count, 0) = 2';
    else if (dto.overdue === '3plus') overdueCond = 'AND COALESCE(o.unpaid_count, 0) >= 3';
    const orderBy = dto.overdue ? 'o.outstanding DESC NULLS LAST' : 'c.customer_code ASC';

    const [{ count }] = await this.customerRepo.query(
      `SELECT COUNT(*)::int AS count
         FROM water_customers c
         LEFT JOIN (SELECT customer_id, COUNT(*) AS unpaid_count FROM water_bills_v2 WHERE organization_id = $1 AND status = 'unpaid' GROUP BY customer_id) o
           ON o.customer_id = c.id
        WHERE ${where} ${overdueCond}`,
      params,
    );
    const limit = dto.limit || 20;
    const data = await this.customerRepo.query(
      `SELECT c.id, c.customer_code AS "customerCode", c.full_name AS "fullName", c.village_no AS "villageNo",
              c.phone, c.address, c.national_id AS "nationalId", c.meter_serial AS "meterSerial",
              c.meter_last_reading AS "meterLastReading", c.usage_status AS "usageStatus", c.collection_route AS "collectionRoute",
              COALESCE(o.outstanding, 0)::float AS outstanding, COALESCE(o.unpaid_count, 0)::int AS "unpaidCount"
         FROM water_customers c
         LEFT JOIN (SELECT customer_id, SUM(total_amount) AS outstanding, COUNT(*) AS unpaid_count
                      FROM water_bills_v2 WHERE organization_id = $1 AND status = 'unpaid' GROUP BY customer_id) o
           ON o.customer_id = c.id
        WHERE ${where} ${overdueCond}
        ORDER BY ${orderBy}
        LIMIT ${limit} OFFSET ${dto.skip || 0}`,
      params,
    );
    return { ...paginate(data, count, dto), summary };
  }

  /** รายละเอียดผู้ใช้น้ำ 1 ราย + ยอดค้างรวม + ประวัติบิลย้อนหลัง (สำหรับหน้ารายละเอียด) */
  async findCustomerDetail(id: string, orgId: string) {
    const c = await this.findCustomer(id, orgId);
    const { legacy, ...rest } = c as any; // ไม่ส่ง record ดิบก้อนใหญ่กลับหน้าเว็บ
    const [agg] = await this.customerRepo.query(
      `SELECT COALESCE(SUM(total_amount), 0)::float AS outstanding, COUNT(*)::int AS "unpaidCount"
         FROM water_bills_v2 WHERE customer_id = $1 AND organization_id = $2 AND status = 'unpaid'`,
      [id, orgId],
    );
    const bills = await this.customerRepo.query(
      `SELECT id, period_year AS "periodYear", period_month AS "periodMonth", period_round AS "periodRound",
              COALESCE(bill_no,
                right((CASE WHEN period_month >= 10 THEN period_year + 1 ELSE period_year END)::text, 2)
                || '-' || lpad((((period_month + 2) % 12) + 1)::text, 3, '0')
                || '-' || customer_code) AS "billNo",
              prev_reading AS "prevReading", curr_reading AS "currReading", units,
              water_amount AS "waterAmount", service_fee AS "serviceFee",
              garbage_fee AS "garbageFee", wastewater_fee AS "wastewaterFee", tax,
              total_amount AS "totalAmount",
              status, paid_at AS "paidAt", read_at AS "readAt", edit_history AS "editHistory"
         FROM water_bills_v2
        WHERE customer_id = $1 AND organization_id = $2
        ORDER BY period_year DESC, period_month DESC LIMIT 24`,
      [id, orgId],
    );
    return { ...rest, outstanding: agg.outstanding, unpaidCount: agg.unpaidCount, bills };
  }

  /** จุดพิกัดมาตรวัดน้ำ (GIS) — ผู้ใช้น้ำที่มี gps "lat,lng" สำหรับแสดงบนแผนที่ */
  async mapPoints(orgId: string, villageNo?: number) {
    const params: any[] = [orgId];
    let vf = '';
    if (villageNo) { params.push(villageNo); vf = `AND village_no = $2`; }
    const rows = await this.customerRepo.query(
      `SELECT id, customer_code AS "customerCode", full_name AS "fullName", village_no AS "villageNo",
              gps, phone, address
         FROM water_customers
        WHERE organization_id = $1 AND deleted_at IS NULL AND gps ~ '^-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?$' ${vf}
        ORDER BY village_no, customer_code`,
      params,
    );
    return rows.map((r: any) => {
      const [lat, lng] = String(r.gps).split(',').map(Number);
      return { ...r, lat, lng };
    });
  }

  /** Export Excel พิกัดมาตรวัดน้ำ (GIS) — ไว้ทำแผนที่ภายนอก/ตรวจสอบ */
  async mapPointsExcel(orgId: string, villageNo?: number): Promise<Buffer> {
    const rows = await this.mapPoints(orgId, villageNo);
    const wb = new ExcelJS.Workbook();
    const s = wb.addWorksheet('พิกัดมาตรวัดน้ำ');
    s.addRow(['รหัส', 'ชื่อ-สกุล', 'หมู่', 'บ้านเลขที่', 'เบอร์โทร', 'ละติจูด', 'ลองจิจูด', 'พิกัด (lat,lng)']);
    s.getRow(1).font = { bold: true };
    for (const r of rows as any[]) s.addRow([r.customerCode, r.fullName, r.villageNo ?? '', r.address ?? '', r.phone ?? '', r.lat, r.lng, r.gps]);
    s.columns = [{ width: 10 }, { width: 28 }, { width: 6 }, { width: 14 }, { width: 14 }, { width: 13 }, { width: 13 }, { width: 22 }];
    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  /** จำนวนผู้ใช้น้ำแยกตามหมู่ — ใช้ทำตัวเลือก "เลือกหมู่" ในหน้ากรอกหนังสือ */
  async villages(orgId: string) {
    return this.customerRepo.query(
      `SELECT village_no AS "villageNo", COUNT(*)::int AS count
         FROM water_customers
        WHERE organization_id = $1 AND deleted_at IS NULL AND village_no IS NOT NULL
        GROUP BY village_no ORDER BY village_no`,
      [orgId],
    );
  }

  async findCustomer(id: string, orgId: string) {
    const c = await this.customerRepo.findOne({ where: { id, organizationId: orgId } });
    if (!c) throw new NotFoundException('ไม่พบผู้ใช้น้ำรายนี้');
    return c;
  }

  /**
   * แนะนำรหัสผู้ใช้น้ำถัดไป — รหัสจริงมักเป็น "ตัวอักษรนำหน้า + เลข" (เช่น CYT01) และมีได้หลายกลุ่ม
   * คำนำหน้าปนกันในองค์กรเดียว (เช่น CYT/CYU/CY ตามเขต/เส้นทาง) จึงจัดกลุ่มตามคำนำหน้าแล้วหา
   * เลขมากสุดของแต่ละกลุ่มแยกกัน ให้เจ้าหน้าที่เลือกต่อกลุ่มที่ตรงเอง แทนที่จะเดากลุ่มเดียวให้
   * (กันแนะนำผิดกลุ่ม) — รหัสที่ไม่มีเลขต่อท้ายเลยถูกข้าม ไม่เข้าเงื่อนไขการจัดกลุ่ม
   */
  async suggestNextCustomerCode(orgId: string) {
    const rows: Array<{ customer_code: string }> = await this.customerRepo.query(
      `SELECT customer_code FROM water_customers WHERE organization_id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    const groups = new Map<string, { maxN: number; maxLen: number; count: number }>();
    for (const r of rows) {
      const s = String(r.customer_code ?? '').trim();
      const m = /^([A-Za-z]*)(\d+)$/.exec(s);
      if (!m) continue;
      const [, prefix, digits] = m;
      const n = parseInt(digits, 10);
      const g = groups.get(prefix);
      if (!g) groups.set(prefix, { maxN: n, maxLen: digits.length, count: 1 });
      else { g.count++; if (n > g.maxN) { g.maxN = n; g.maxLen = digits.length; } }
    }
    return {
      groups: [...groups.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([prefix, g]) => ({
          prefix,
          lastCode: `${prefix}${String(g.maxN).padStart(g.maxLen, '0')}`,
          nextCode: `${prefix}${String(g.maxN + 1).padStart(g.maxLen, '0')}`,
          count: g.count,
        })),
    };
  }

  /**
   * สุ่มรหัส 6 หลัก (อักษร+เลข ตัดตัวอักษรกำกวม 0/O/1/I ออก) — กันชนด้วยเช็คซ้ำก่อนคืนค่า
   * ใช้เป็นทั้งรหัสผู้ใช้น้ำ (customerCode) และรหัสเข้าถึงสาธารณะ (accessToken) ตัวเดียวกัน
   * เช็คซ้ำกับทั้ง 2 คอลัมน์ กันชนกับรหัสเก่าที่นำเข้ามาจากระบบ vendor (เลขล้วน) ด้วย
   */
  private async generateUniqueCode(orgId: string): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 20; attempt++) {
      let candidate = '';
      for (let i = 0; i < 6; i++) candidate += chars[Math.floor(Math.random() * chars.length)];
      const dup = await this.customerRepo.findOne({
        where: [{ organizationId: orgId, customerCode: candidate }, { organizationId: orgId, accessToken: candidate }],
      });
      if (!dup) return candidate;
    }
    throw new Error('สร้างรหัสไม่สำเร็จ (ชนกันเกิน 20 ครั้งติด) ลองใหม่อีกครั้ง');
  }

  /**
   * สร้างผู้ใช้น้ำรายใหม่ (เจ้าหน้าที่กดเพิ่มเอง) — รหัสผู้ใช้น้ำ = รหัสใบแจ้งหนี้/QR ตัวเดียวกัน
   * สุ่มให้อัตโนมัติเสมอ ไม่ให้เจ้าหน้าที่พิมพ์เอง (กันชนกับรหัสเก่าที่นำเข้าจากระบบ vendor/เดากันไม่ได้)
   */
  async createCustomer(dto: CreateWaterCustomerDto, orgId: string) {
    const code = await this.generateUniqueCode(orgId);
    const { unitPrice, customerCode: _ignored, ...rest } = dto;
    return this.customerRepo.save(this.customerRepo.create({
      ...rest, customerCode: code, organizationId: orgId, accessToken: code,
      unitPrice: unitPrice == null ? null : Number(unitPrice).toFixed(2),
    }));
  }

  async updateCustomer(id: string, dto: UpdateWaterCustomerDto, orgId: string) {
    const c = await this.findCustomer(id, orgId);
    if (dto.customerCode && dto.customerCode.trim() !== c.customerCode) {
      const code = dto.customerCode.trim();
      const dup = await this.customerRepo.findOne({ where: { organizationId: orgId, customerCode: code } });
      if (dup) throw new ConflictException(`รหัสผู้ใช้น้ำ "${code}" มีในระบบแล้ว (${dup.fullName})`);
    }
    const { unitPrice, ...rest } = dto;
    Object.assign(c, rest);
    if (unitPrice !== undefined) c.unitPrice = unitPrice == null ? null : Number(unitPrice).toFixed(2);
    return this.customerRepo.save(c);
  }

  /**
   * ตั้งราคาต่อหน่วยเฉพาะรายทีเดียวหลายคน — แทนการแก้ทีละคนแบบระบบเก่า (vendor บังคับคลิกทีละคน 2,700 ครั้ง)
   * unitPrice=null → ล้างค่า กลับไปใช้เรตกลางของ อบต.
   */
  async bulkSetUnitPrice(dto: BulkUnitPriceDto, orgId: string) {
    const val = dto.unitPrice == null ? null : Number(dto.unitPrice).toFixed(2);
    const qb = this.customerRepo.createQueryBuilder()
      .update(WaterCustomer)
      .set({ unitPrice: val as any })
      .where('organization_id = :orgId', { orgId });
    if (dto.scope === 'village') {
      if (dto.villageNo == null) throw new BadRequestException('เลือกขอบเขต "ทั้งหมู่" ต้องระบุหมู่');
      qb.andWhere('village_no = :v', { v: dto.villageNo });
    } else if (dto.scope === 'ids') {
      if (!dto.ids || !dto.ids.length) throw new BadRequestException('ไม่ได้เลือกผู้ใช้น้ำ');
      qb.andWhere('id IN (:...ids)', { ids: dto.ids });
    }
    const res = await qb.execute();
    return { updated: res.affected ?? 0, unitPrice: val };
  }

  /**
   * นำเข้าทะเบียนผู้ใช้น้ำจากไฟล์ที่เจ้าหน้าที่อัปโหลด (CSV หรือ JSON)
   *
   * ทำเป็นหน้าอัปโหลดแทนการ commit ไฟล์รายชื่อขึ้น repo เพราะเป็นข้อมูลส่วนบุคคล
   * ของชาวบ้านทั้งตำบล ไม่ควรอยู่ในที่เก็บโค้ด — และ อบต. อัปเดตเองได้เมื่อมีคนย้ายเข้า-ออก
   *
   * @param preview true = แค่ตรวจไฟล์ ไม่เขียนฐานข้อมูล (ให้ดูก่อนยืนยัน)
   */
  async importCustomers(buffer: Buffer, filename: string, orgId: string, preview = false) {
    let rows: ImportRow[], issues: ImportIssue[];
    try {
      ({ rows, issues } = parseCustomerFile(buffer, filename));
    } catch (e: any) {
      throw new BadRequestException(e.message || 'อ่านไฟล์ไม่ได้');
    }
    if (!rows.length) {
      throw new BadRequestException(
        issues.length
          ? `ไม่มีแถวที่ใช้ได้เลย (ข้าม ${issues.length} แถว เช่น บรรทัด ${issues[0].line}: ${issues[0].reason})`
          : 'ไม่พบข้อมูลในไฟล์ — ตรวจสอบว่ามีคอลัมน์ รหัส / ชื่อ-สกุล / หมู่',
      );
    }

    const existing = await this.customerRepo.find({
      where: { organizationId: orgId },
      select: ['id', 'customerCode', 'fullName', 'villageNo'],
    });
    const byCode = new Map(existing.map((c) => [c.customerCode, c]));

    let created = 0, updated = 0, unchanged = 0;
    const toCreate: Partial<WaterCustomer>[] = [];
    const toUpdate: { id: string; fullName: string; villageNo: number | null }[] = [];

    for (const r of rows) {
      const found = byCode.get(r.customerCode);
      if (!found) {
        toCreate.push({ organizationId: orgId, ...r });
        created++;
      } else if (found.fullName !== r.fullName || (found.villageNo ?? null) !== r.villageNo) {
        toUpdate.push({ id: found.id, fullName: r.fullName, villageNo: r.villageNo });
        updated++;
      } else {
        unchanged++;
      }
    }

    const sample = rows.slice(0, 5);
    const result = {
      total: rows.length, created, updated, unchanged, sample,
      issues: issues.slice(0, 50),
      skipped: issues.filter((i) => i.kind === 'skip').length,     // แถวที่ไม่ได้นำเข้า
      warned: issues.filter((i) => i.kind === 'warn').length,      // นำเข้าแล้วแต่ข้อมูลไม่ครบ
    };
    if (preview) return { preview: true, ...result };

    if (toCreate.length) {
      // สุ่มรหัสเข้าถึงให้ครบทุกรายใหม่ — เลี่ยงชนทั้งกับของเดิมในฐานข้อมูลและกันเองภายในชุดนี้
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const existingTokens = new Set(
        (await this.customerRepo.find({ where: { organizationId: orgId }, select: ['accessToken'] }))
          .map((c) => c.accessToken).filter(Boolean),
      );
      for (const row of toCreate) {
        let candidate = '';
        do {
          candidate = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        } while (existingTokens.has(candidate));
        existingTokens.add(candidate);
        (row as any).accessToken = candidate;
      }
    }

    // เขียนทีเดียวใน transaction — ไฟล์พังกลางคันจะได้ไม่เหลือข้อมูลค้างครึ่งๆ
    await this.customerRepo.manager.transaction(async (em) => {
      if (toCreate.length) {
        // แบ่งเป็นก้อนละ 500 กัน query ยาวเกินลิมิตของ postgres
        for (let i = 0; i < toCreate.length; i += 500) {
          await em.insert(WaterCustomer, toCreate.slice(i, i + 500) as any);
        }
      }
      for (const u of toUpdate) {
        await em.update(WaterCustomer, u.id, { fullName: u.fullName, villageNo: u.villageNo });
      }
    });

    return { preview: false, ...result };
  }

  async removeCustomer(id: string, orgId: string) {
    const c = await this.findCustomer(id, orgId);
    await this.customerRepo.softRemove(c);
    return { message: `ลบ ${c.customerCode} ${c.fullName} แล้ว` };
  }

  // ─────────────────────────────────────── หนังสือแจ้งค้างชำระ
  /**
   * เลขที่หนังสือถัดไปของปีนั้น (พ.ศ.) — ใช้เป็น "คำแนะนำ" ให้เจ้าหน้าที่เท่านั้น
   * ระบบไม่ได้รันเลขให้อัตโนมัติ เพราะเลขจริงมาจากทะเบียนส่งของ อบต.
   */
  async nextDocNumber(orgId: string, year?: number) {
    const y = year || new Date().getFullYear() + 543;
    const [row] = await this.noticeRepo.query(
      `SELECT COALESCE(MAX(doc_number), 0)::int AS max FROM water_notices
        WHERE organization_id = $1 AND doc_year = $2 AND deleted_at IS NULL`,
      [orgId, y],
    );
    return { year: y, next: (row?.max ?? 0) + 1 };
  }

  async findNotices(orgId: string, dto: WaterNoticeQueryDto) {
    const qb = this.noticeRepo.createQueryBuilder('n')
      .where('n.organizationId = :orgId', { orgId });

    if (dto.villageNo) qb.andWhere('n.villageNo = :v', { v: dto.villageNo });
    if (dto.periodMonth) qb.andWhere('n.periodMonth = :m', { m: dto.periodMonth });
    if (dto.periodYear) qb.andWhere('n.periodYear = :y', { y: dto.periodYear });
    if (dto.search?.trim()) {
      qb.andWhere('(n.customerCode ILIKE :q OR n.fullName ILIKE :q)', { q: `%${dto.search.trim()}%` });
    }

    const [data, total] = await qb
      .orderBy('n.noticeDate', 'DESC').addOrderBy('n.docNumber', 'DESC')
      .skip(dto.skip).take(dto.limit || 20)
      .getManyAndCount();
    return paginate(data, total, dto);
  }

  async findNotice(id: string, orgId: string) {
    const n = await this.noticeRepo.findOne({ where: { id, organizationId: orgId } });
    if (!n) throw new NotFoundException('ไม่พบหนังสือฉบับนี้');
    return n;
  }

  /**
   * สร้าง PDF ของหนังสือ — เรนเดอร์ที่ server เพื่อให้ได้กระดาษเหมือนกันทุกเครื่อง
   * (พิมพ์จากเบราว์เซอร์ตรงๆ จะติดขอบกระดาษ/หัวท้าย/การย่อขนาดตามที่แต่ละเครื่องตั้งไว้)
   */
  async noticePdf(id: string, orgId: string): Promise<{ buffer: Buffer; filename: string }> {
    const n = await this.findNotice(id, orgId);
    const [rate] = await this.noticeRepo.query(
      `SELECT warning_signature_url AS sig FROM water_rate WHERE organization_id = $1 LIMIT 1`, [orgId]);
    const html = buildNoticeHtml({ ...(n as any), org: await this.noticeOrg(orgId), signatureImage: rate?.sig || undefined });
    const buffer = await this.pdf.generateFromHtml(html, {
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }, // ขอบอยู่ใน HTML แล้ว
      preferCSSPageSize: true,
    });
    const no = n.docNumber ? `${n.docNumber}-${n.docYear}` : `${n.customerCode}`;
    return { buffer, filename: `หนังสือค้างชำระค่าน้ำ-${no}.pdf` };
  }

  /** หน้าซองจดหมายส่งใบเตือน — ผู้ส่ง(อบต.) + ผู้รับ(ผู้ใช้น้ำ) พิมพ์ลงซอง */
  async noticeEnvelopePdf(id: string, orgId: string): Promise<{ buffer: Buffer; filename: string }> {
    const n = await this.findNotice(id, orgId);
    const org = await loadOrgIdentity(this.orgRepo, orgId);
    const cust = await this.customerRepo.findOne({ where: { id: n.customerId } });
    const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const orgName = org.nameTh || 'องค์การบริหารส่วนตำบล';
    const orgAddr = org.address?.trim() || [org.subDistrict && `ต.${org.subDistrict}`, org.district && `อ.${org.district}`,
      org.province && `จ.${org.province}`].filter(Boolean).join(' ');
    const rcptAddr = [cust?.address && `บ้านเลขที่ ${cust.address}`, n.villageNo && `หมู่ ${n.villageNo}`, orgAddr].filter(Boolean).join(' ');
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
      ${noticeFontCss()}
      @page { size: 176mm 125mm; margin: 0; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { width:176mm; height:125mm; font-family:'TH SarabunIT๙','TH SarabunNew',sans-serif; position:relative; }
      .sender { position:absolute; top:12mm; left:12mm; font-size:15pt; line-height:1.4; max-width:80mm; }
      .stamp { position:absolute; top:10mm; right:12mm; border:1px dashed #999; padding:6mm 8mm; font-size:11pt; color:#999; }
      .rcpt { position:absolute; top:62mm; left:64mm; font-size:19pt; line-height:1.5; max-width:100mm; }
      .rcpt .to { font-size:15pt; color:#333; }
      .rcpt .name { font-weight:700; }
    </style></head><body>
      <div class="sender"><b>จาก</b> ${esc(orgName)}<br>${esc(orgAddr)}${org.phone ? `<br>โทร ${esc(org.phone)}` : ''}</div>
      <div class="stamp">ชำระค่าฝากส่ง<br>เป็นรายเดือน</div>
      <div class="rcpt"><div class="to">เรียน</div><div class="name">${esc(n.fullName)}</div><div>${esc(rcptAddr)}</div></div>
    </body></html>`;
    const buffer = await this.pdf.generateFromHtml(html, {
      width: '176mm', height: '125mm', printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true,
    });
    return { buffer, filename: `ซองใบเตือน-${n.customerCode}.pdf` };
  }

  // ─────────── ทวงหนี้ยกล็อต (ตาม vendor: กรองหมู่ + จำนวนเดือนค้าง → พิมพ์รวด) ───────────
  /** ลูกหนี้ค้าง ≥ minMonths เดือน (กรองหมู่ได้) — สำหรับทวงยกล็อต */
  async debtorsForDunning(orgId: string, villageNo: number | undefined, minMonths: number) {
    const params: any[] = [orgId];
    let vf = '';
    if (villageNo) { params.push(villageNo); vf = `AND c.village_no = $${params.length}`; }
    params.push(Math.max(1, Math.floor(minMonths || 1)));
    const rows = await this.customerRepo.query(
      `SELECT c.id AS "customerId", c.customer_code AS "customerCode", c.full_name AS "fullName",
              c.village_no AS "villageNo", c.address,
              COUNT(*)::int AS months, COALESCE(SUM(b.total_amount), 0)::float AS amount,
              MAX(b.period_year * 100 + b.period_month) AS "latestYm"
         FROM water_bills_v2 b JOIN water_customers c ON c.id = b.customer_id
        WHERE b.organization_id = $1 AND b.status = 'unpaid' ${vf}
        GROUP BY c.id, c.customer_code, c.full_name, c.village_no, c.address
       HAVING COUNT(*) >= $${params.length}
        ORDER BY c.village_no, c.customer_code`,
      params,
    );
    return rows.map((r: any) => ({ ...r, periodYear: Math.floor(r.latestYm / 100), periodMonth: r.latestYm % 100 }));
  }

  private async warningSig(orgId: string): Promise<string | undefined> {
    const [rate] = await this.noticeRepo.query(
      `SELECT warning_signature_url AS sig FROM water_rate WHERE organization_id = $1 LIMIT 1`, [orgId]);
    return rate?.sig || undefined;
  }

  /**
   * หัวหนังสือ/ผู้ลงนาม บนหนังสือแจ้งค้างชำระ — มาจากหน้าตั้งค่าระบบประปาของแต่ละ อบต.
   * (เดิมฝังชื่อ อบต. ไว้ในตัวเรนเดอร์ → อบต. อื่นออกหนังสือได้ชื่อผิด)
   */
  private async noticeOrg(orgId: string): Promise<NoticeOrg> {
    const org = await loadOrgIdentity(this.noticeRepo as any, orgId);
    const [r] = await this.noticeRepo.query(
      `SELECT notice_doc_prefix, notice_address_line, notice_division, notice_signer_name,
              notice_signer_title, notice_phone, notice_due_days
         FROM water_rate WHERE organization_id = $1 LIMIT 1`, [orgId]);
    // ที่อยู่หัวหนังสือ: ที่ตั้งเอง → ประกอบ "อำเภอ… จังหวัด…" จากทะเบียนหน่วยงาน
    const addressLine = r?.notice_address_line
      || [org.district && `อำเภอ${org.district}`, org.province && `จังหวัด${org.province}`].filter(Boolean).join(' ');
    return {
      name: org.nameTh, addressLine, phone: r?.notice_phone || org.phone,
      docPrefix: r?.notice_doc_prefix || undefined,
      division: r?.notice_division || undefined,
      signerName: r?.notice_signer_name || undefined,
      signerTitle: r?.notice_signer_title || undefined,
      dueDays: r?.notice_due_days ?? undefined,
    };
  }

  /** พิมพ์หนังสือแจ้งเตือนยกล็อต — 1 ฉบับ/ราย ใน PDF เดียว */
  async bulkNoticePdf(orgId: string, villageNo: number | undefined, minMonths: number, noticeDate: string): Promise<{ buffer: Buffer; filename: string }> {
    const debtors = await this.debtorsForDunning(orgId, villageNo, minMonths);
    if (!debtors.length) throw new BadRequestException('ไม่มีลูกหนี้ตามเงื่อนไข (หมู่/จำนวนเดือนค้าง)');
    const sig = await this.warningSig(orgId);
    const org = await this.noticeOrg(orgId);
    const docYear = Number(String(noticeDate).slice(0, 4)) + 543;
    const notices = debtors.map((d: any) => ({
      org, docNumber: null, docYear, noticeDate,
      fullName: d.fullName, customerCode: d.customerCode, villageNo: d.villageNo,
      periodMonth: d.periodMonth, periodYear: d.periodYear,
      amount: d.amount, amountText: bahtText(d.amount), signatureImage: sig,
    }));
    const buffer = await this.pdf.generateFromHtml(buildBulkNoticeHtml(notices as any), {
      format: 'A4', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true,
    });
    return { buffer, filename: `หนังสือค้างชำระยกล็อต-${debtors.length}ฉบับ.pdf` };
  }

  /** พิมพ์หน้าซองยกล็อต — 1 ซอง/ราย ใน PDF เดียว */
  async bulkEnvelopePdf(orgId: string, villageNo: number | undefined, minMonths: number): Promise<{ buffer: Buffer; filename: string }> {
    const debtors = await this.debtorsForDunning(orgId, villageNo, minMonths);
    if (!debtors.length) throw new BadRequestException('ไม่มีลูกหนี้ตามเงื่อนไข (หมู่/จำนวนเดือนค้าง)');
    const org = await loadOrgIdentity(this.orgRepo, orgId);
    const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
    const orgName = org.nameTh || 'องค์การบริหารส่วนตำบล';
    const orgAddr = org.address?.trim() || [org.subDistrict && `ต.${org.subDistrict}`, org.district && `อ.${org.district}`,
      org.province && `จ.${org.province}`].filter(Boolean).join(' ');
    const pages = debtors.map((d: any) => {
      const rcptAddr = [d.address && `บ้านเลขที่ ${d.address}`, d.villageNo && `หมู่ ${d.villageNo}`, orgAddr].filter(Boolean).join(' ');
      return `<div class="env">
        <div class="sender"><b>จาก</b> ${esc(orgName)}<br>${esc(orgAddr)}${org.phone ? `<br>โทร ${esc(org.phone)}` : ''}</div>
        <div class="stamp">ชำระค่าฝากส่ง<br>เป็นรายเดือน</div>
        <div class="rcpt"><div class="to">เรียน</div><div class="name">${esc(d.fullName)}</div><div>${esc(rcptAddr)}</div></div>
      </div>`;
    }).join('');
    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
      ${noticeFontCss()}
      @page { size: 176mm 125mm; margin: 0; }
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'TH SarabunIT๙','TH SarabunNew',sans-serif; }
      .env { width:176mm; height:125mm; position:relative; overflow:hidden; }
      .env:not(:last-child) { page-break-after: always; }
      .sender { position:absolute; top:12mm; left:12mm; font-size:15pt; line-height:1.4; max-width:80mm; }
      .stamp { position:absolute; top:10mm; right:12mm; border:1px dashed #999; padding:6mm 8mm; font-size:11pt; color:#999; }
      .rcpt { position:absolute; top:62mm; left:64mm; font-size:19pt; line-height:1.5; max-width:100mm; }
      .rcpt .to { font-size:15pt; color:#333; }
      .rcpt .name { font-weight:700; }
    </style></head><body>${pages}</body></html>`;
    const buffer = await this.pdf.generateFromHtml(html, {
      width: '176mm', height: '125mm', printBackground: true, margin: { top: '0', right: '0', bottom: '0', left: '0' }, preferCSSPageSize: true,
    });
    return { buffer, filename: `ซองใบเตือนยกล็อต-${debtors.length}ซอง.pdf` };
  }

  async createNotice(dto: CreateWaterNoticeDto, orgId: string, userId: string) {
    const docYear = Number(String(dto.noticeDate).slice(0, 4)) + 543;
    // เลขที่หนังสือมาจากทะเบียนส่งของ อบต. เอง ระบบไม่รันให้ — ไม่กรอกก็ออกหนังสือได้ (เว้นว่างในกระดาษ)
    const docNumber = dto.docNumber ?? null;
    if (docNumber !== null) {
      const dup = await this.noticeRepo.findOne({ where: { organizationId: orgId, docYear, docNumber } });
      if (dup) throw new ConflictException(`เลขที่หนังสือ ${docNumber}/${docYear} ถูกใช้ไปแล้ว (${dup.fullName})`);
    }

    // ข้อความจำนวนเงินคำนวณที่ server เสมอ — ห้ามรับจากฝั่งหน้าเว็บ กันแก้ให้ไม่ตรงกับตัวเลข
    const amountText = bahtText(dto.amount);

    // บันทึกหนังสือ + ประวัติกิจกรรม ใน transaction เดียว
    // ถ้าแยกกันแล้วอันหลังพัง จะได้หนังสือค้างในระบบและเลขที่กระโดดโดยไม่มีใครรู้
    return this.noticeRepo.manager.transaction(async (em) => {
      const saved = await em.save(em.create(WaterNotice, {
        organizationId: orgId,
        docNumber, docYear,
        noticeDate: dto.noticeDate,
        customerId: dto.customerId || null,
        customerCode: dto.customerCode.trim(),
        fullName: dto.fullName.trim(),
        villageNo: dto.villageNo ?? null,
        periodMonth: dto.periodMonth,
        periodYear: dto.periodYear,
        amount: dto.amount.toFixed(2),
        amountText,
        createdBy: userId,
      } as any)) as unknown as WaterNotice;

      await em.save(em.create(AuditLog, {
        organizationId: orgId, userId, action: 'CREATE', module: 'water',
        resourceType: 'water_notice', resourceId: saved.id,
        resourceTitle: `ออกหนังสือแจ้งค้างชำระค่าน้ำ ${docNumber}/${docYear} — ${saved.customerCode} ${saved.fullName} ${dto.amount.toFixed(2)} บาท`,
      } as any));

      return saved;
    });
  }

  async removeNotice(id: string, orgId: string, userId: string) {
    const n = await this.findNotice(id, orgId);
    await this.noticeRepo.softRemove(n);
    const label = n.docNumber ? `เลขที่ ${n.docNumber}/${n.docYear}` : `ของ ${n.fullName}`;
    await this.audit(orgId, userId, 'DELETE', id,
      `ลบหนังสือแจ้งค้างชำระ ${label} — ${n.customerCode} ${n.fullName}`);
    return { message: `ลบหนังสือ${label} แล้ว` };
  }

  /** สรุปจำนวนหนังสือที่ออก แยกตามเดือน — ใช้ในหน้ารายการ */
  async noticeSummary(orgId: string) {
    const [totals] = await this.noticeRepo.query(
      `SELECT COUNT(*)::int AS total, COALESCE(SUM(amount), 0)::float AS amount
         FROM water_notices WHERE organization_id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    const byMonth = await this.noticeRepo.query(
      `SELECT period_year AS "periodYear", period_month AS "periodMonth",
              COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float AS amount
         FROM water_notices WHERE organization_id = $1 AND deleted_at IS NULL
        GROUP BY period_year, period_month
        ORDER BY period_year DESC, period_month DESC LIMIT 12`,
      [orgId],
    );
    return { totals, byMonth };
  }

  // ─────────────────────────────────────── สรุปการเก็บค่าน้ำ (dashboard)
  /** งวดล่าสุดที่มีข้อมูล (บิลจริง หรือ ตัวเลขป้อนมือ) — ใช้เป็นค่าเริ่มต้นของ dashboard */
  async collectionLatestPeriod(orgId: string): Promise<{ periodYear: number; periodMonth: number } | null> {
    const [row] = await this.collectionRepo.query(
      `${MERGED_COLLECTION_CTE}
       SELECT py AS "periodYear", pm AS "periodMonth" FROM merged
        GROUP BY py, pm ORDER BY py DESC, pm DESC LIMIT 1`,
      [orgId],
    );
    return row || null;
  }

  /** รายการงวดที่มีข้อมูล (ให้เลือกใน dropdown) — รวมบิลจริง + ป้อนมือ */
  async collectionPeriods(orgId: string) {
    return this.collectionRepo.query(
      `${MERGED_COLLECTION_CTE}
       SELECT py AS "periodYear", pm AS "periodMonth",
              SUM(billed)::float AS billed, SUM(collected)::float AS collected
         FROM merged GROUP BY py, pm ORDER BY py DESC, pm DESC`,
      [orgId],
    );
  }

  /** ตัวเลขรายหมู่ของงวดหนึ่ง (ใช้ทั้งแสดงและตอนกรอก) */
  async getCollection(orgId: string, dto: CollectionQueryDto) {
    const rows = await this.collectionRepo.find({
      where: { organizationId: orgId, periodYear: dto.year, periodMonth: dto.month },
      order: { villageNo: 'ASC' },
    });
    return rows.map((r) => ({
      villageNo: r.villageNo, customers: r.customers,
      billedAmount: Number(r.billedAmount), collectedAmount: Number(r.collectedAmount),
      units: r.units ?? null,
    }));
  }

  /**
   * บันทึกตัวเลขของทั้งงวด — แทนที่ของงวดนั้นทั้งชุด (ลบเก่า แล้วใส่ใหม่เฉพาะแถวที่มีตัวเลข)
   * ทำใน transaction กันข้อมูลค้างครึ่งๆ ถ้าพังกลางคัน
   */
  async saveCollection(dto: SaveCollectionDto, orgId: string) {
    // เก็บเฉพาะแถวที่มีตัวเลขจริง (กัน insert แถวศูนย์เปล่าๆ ของหมู่ที่ยังไม่กรอก)
    const rows = dto.rows.filter((r) => r.customers > 0 || r.billedAmount > 0 || r.collectedAmount > 0);
    for (const r of rows) {
      if (r.collectedAmount > r.billedAmount) {
        throw new BadRequestException(`หมู่ ${r.villageNo}: ยอดเก็บได้ (${r.collectedAmount}) มากกว่ายอดบิล (${r.billedAmount}) ไม่ได้`);
      }
    }

    await this.collectionRepo.manager.transaction(async (em) => {
      await em.delete(WaterCollectionSummary, {
        organizationId: orgId, periodYear: dto.periodYear, periodMonth: dto.periodMonth,
      });
      if (rows.length) {
        await em.insert(WaterCollectionSummary, rows.map((r) => ({
          organizationId: orgId, periodYear: dto.periodYear, periodMonth: dto.periodMonth,
          villageNo: r.villageNo, customers: r.customers,
          billedAmount: r.billedAmount.toFixed(2), collectedAmount: r.collectedAmount.toFixed(2),
          units: r.units ?? null,
        })) as any);
      }
    });

    return { periodYear: dto.periodYear, periodMonth: dto.periodMonth, saved: rows.length };
  }

  /**
   * ข้อมูล dashboard ของงวดหนึ่ง (ไม่ส่งงวด = งวดล่าสุด):
   * KPI รวม + แยกรายหมู่ + เทรนด์ย้อนหลัง 12 งวด + จำนวนหนังสือค้างที่ออกในงวด
   */
  async collectionDashboard(orgId: string, year?: number, month?: number) {
    let periodYear = year, periodMonth = month;
    if (!periodYear || !periodMonth) {
      const latest = await this.collectionLatestPeriod(orgId);
      if (!latest) return { hasData: false, period: null, totals: null, byVillage: [], trend: [], noticesInPeriod: 0 };
      periodYear = latest.periodYear; periodMonth = latest.periodMonth;
    }

    const byVillage = await this.collectionRepo.query(
      `${MERGED_COLLECTION_CTE}
       SELECT vn AS "villageNo", customers::int AS customers,
              billed AS billed, collected AS collected, (billed - collected) AS outstanding
         FROM merged WHERE py = $2 AND pm = $3 AND (customers > 0 OR billed > 0)
        ORDER BY vn`,
      [orgId, periodYear, periodMonth],
    );

    const totals = byVillage.reduce(
      (a: any, v: any) => ({
        customers: a.customers + v.customers, billed: a.billed + v.billed,
        collected: a.collected + v.collected, outstanding: a.outstanding + v.outstanding,
      }),
      { customers: 0, billed: 0, collected: 0, outstanding: 0 },
    );
    totals.rate = totals.billed > 0 ? +(totals.collected / totals.billed * 100).toFixed(1) : 0;

    // เทรนด์ย้อนหลัง 12 งวด (เก่า→ใหม่ เพื่อทำกราฟซ้ายไปขวา) — จากข้อมูลรวม
    const trend = (await this.collectionRepo.query(
      `${MERGED_COLLECTION_CTE}
       SELECT py AS "periodYear", pm AS "periodMonth",
              SUM(billed)::float AS billed, SUM(collected)::float AS collected
         FROM merged GROUP BY py, pm ORDER BY py DESC, pm DESC LIMIT 12`,
      [orgId],
    )).reverse();

    // จำนวนหนังสือค้างชำระที่ออกในงวดนี้ (เชื่อมกับโมดูลหนังสือ)
    const [{ notices }] = await this.noticeRepo.query(
      `SELECT COUNT(*)::int AS notices FROM water_notices
        WHERE organization_id = $1 AND period_year = $2 AND period_month = $3 AND deleted_at IS NULL`,
      [orgId, periodYear, periodMonth],
    );

    return { hasData: byVillage.length > 0, period: { periodYear, periodMonth }, totals, byVillage, trend, noticesInPeriod: notices };
  }
}
