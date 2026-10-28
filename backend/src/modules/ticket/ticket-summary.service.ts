/**
 * รายงานสรุป/สถิติ/Export ของสารบรรณ — แยกจาก ticket.service.ts ตามแผนจัดระเบียบโมดูล
 * (ก้อนรายงานทั้งหมด: dashboard stats, สรุปรายเดือน/รายปี v4, สถิติทะเบียน, export Excel/PDF)
 */
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { CorrespondenceTicket, TicketStatus, TicketDirection } from '../../database/entities/correspondence-ticket.entity';
import { TicketQueryDto } from './dto/ticket.dto';
import { AuthUser, buildVisibleQuery, applyTicketFilters } from './ticket-visibility';
import { listBooks } from './ticket-numbering.service';

// ตัดปี/เดือนจาก "เวลาไทย" เสมอ — created_at เป็น timestamptz, EXTRACT เฉย ๆ จะตัดตามโซนของ
// DB server (บน prod docker = UTC) ทำให้เรื่องที่ลงรับ 00:00-06:59 น. ตกเดือน/ปีผิด
const THAI_TS = `(t.created_at AT TIME ZONE 'Asia/Bangkok')`;
const THAI_YEAR_EXPR = `EXTRACT(YEAR FROM ${THAI_TS})::int + 543`;
const THAI_MONTH_EXPR = `EXTRACT(MONTH FROM ${THAI_TS})::int`;

/** label สถานะ (step) สำหรับ dashboard สรุป (คงที่ ไม่เติมชื่อกอง) */
const SUMMARY_STEP_LABELS: Record<string, string> = {
  PENDING_PERSON: 'รอผู้รับดำเนินการ',
  PENDING_OWNER_HEAD: 'รอผู้อำนวยการกอง (เจ้าของ)',
  PENDING_OWNER_CLERK: 'รอธุรการกอง (เจ้าของ)',
  PENDING_RELATED_HEAD: 'รอผู้อำนวยการกอง (เกี่ยวข้อง)',
  PENDING_RELATED_CLERK: 'รอธุรการกอง (เกี่ยวข้อง)',
  PENDING_CLERK: 'รอปลัด', PENDING_MAYOR: 'รอนายก',
  COMPLETED: 'เสร็จสิ้น', RETURNED: 'ตีกลับ', CANCELLED: 'ยกเลิก',
};
const stepLabelStatic = (k: string) => SUMMARY_STEP_LABELS[k] || k || 'ไม่ระบุ';

@Injectable()
export class TicketSummaryService {
  constructor(
    @InjectRepository(CorrespondenceTicket) private ticketRepo: Repository<CorrespondenceTicket>,
  ) {}

  /** สถิติสำหรับปุ่มกรองใน Dashboard (เคารพสิทธิ์การมองเห็น) */
  async getStats(user: AuthUser) {
    const countBy = async (statuses: string[]) => {
      const qb = buildVisibleQuery(this.ticketRepo, user, false);
      if (statuses.length) qb.andWhere('t.status IN (:...st)', { st: statuses });
      return qb.getCount();
    };
    const overdueCount = async () => {
      const qb = buildVisibleQuery(this.ticketRepo, user, false);
      qb.andWhere('t.due_date < CURRENT_DATE')
        .andWhere('t.status NOT IN (:...done)', { done: [TicketStatus.COMPLETED, TicketStatus.CANCELLED] });
      return qb.getCount();
    };
    const [all, assigned, inProgress, pendingClerk, pendingMayor, completed, returned, overdue] = await Promise.all([
      countBy([]),
      countBy([TicketStatus.ASSIGNED]),
      countBy([TicketStatus.IN_PROGRESS]),
      countBy([TicketStatus.PENDING_CLERK]),
      countBy([TicketStatus.PENDING_MAYOR]),
      countBy([TicketStatus.COMPLETED]),
      countBy([TicketStatus.RETURNED]),
      overdueCount(),
    ]);
    return { all, assigned, inProgress, pendingClerk, pendingMayor, completed, returned, overdue };
  }

  // ─────────────────────────────────────────── รายงานสรุปประจำเดือน (Summarize Report)
  // ปี = พ.ศ. จากวันที่ลงรับเข้าระบบ (created_at) · เดือน = 1-12
  // ตัวเลขสรุป scope ตามสิทธิ์การมองเห็นเดิม (กองตน + ชั้นความลับ) — ตรงกับรายการด้านล่างเสมอ ไม่รั่วจำนวนเรื่องลับ

  /** ปีที่มีข้อมูล + จำนวนเรื่องต่อปี (เฉพาะที่ผู้ใช้เห็นได้) */
  async summaryYears(user: AuthUser) {
    const rows = await buildVisibleQuery(this.ticketRepo, user, false)
      .select(THAI_YEAR_EXPR, 'year')
      .addSelect('COUNT(*)', 'count')
      .groupBy('year')
      .orderBy('year', 'DESC')
      .getRawMany();
    return rows.map((r) => ({ year: Number(r.year), count: Number(r.count) }));
  }

  /** จำนวนเรื่องรายเดือนของปีที่เลือก */
  async summaryMonths(year: number, user: AuthUser) {
    const rows = await buildVisibleQuery(this.ticketRepo, user, false)
      .select(THAI_MONTH_EXPR, 'month')
      .addSelect('COUNT(*)', 'count')
      .andWhere(`${THAI_YEAR_EXPR} = :sy`, { sy: year })
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany();
    return { year, months: rows.map((r) => ({ month: Number(r.month), count: Number(r.count) })) };
  }

  /** สรุปสารบรรณของเดือน (v4): รวม + แยก step/กอง/ความเร่งด่วน + รายการ (กรองกองได้) */
  async summaryMonthly(year: number, month: number, user: AuthUser, deptId?: string) {
    const base = (withUsers = false) => {
      const q = buildVisibleQuery(this.ticketRepo, user, withUsers)
        .andWhere(`${THAI_YEAR_EXPR} = :sy`, { sy: year })
        .andWhere(`${THAI_MONTH_EXPR} = :sm`, { sm: month });
      if (deptId) q.andWhere('t.owner_dept_id = :fd', { fd: deptId });
      return q;
    };
    const groupCount = async (expr: string) => {
      const rows = await base().select(expr, 'key').addSelect('COUNT(*)', 'count').groupBy('key').orderBy('count', 'DESC').getRawMany();
      return rows.map((r) => ({ key: r.key ?? 'ไม่ระบุ', count: Number(r.count) }));
    };
    const [byStepRaw, byUrgency, byDepartment, tickets] = await Promise.all([
      groupCount('t.current_step'),
      groupCount(`COALESCE(NULLIF(t.urgency_level, ''), 'ปกติ')`),
      groupCount(`COALESCE("ownerDept".name_th, 'ไม่ระบุกอง')`),
      base(true).orderBy('t.createdAt', 'DESC').take(300).getMany(),
    ]);
    const total = tickets.length < 300 ? tickets.length : await base().getCount();
    const byStep = byStepRaw.map((r) => ({ ...r, label: stepLabelStatic(r.key) }));
    return { year, month, total, byStep, byUrgency, byDepartment, tickets };
  }

  /** สรุปสารบรรณรายปี (v4): รวมทั้งปี + แยก step/กอง(อันดับ)/ความเร่งด่วน + แนวโน้ม 12 เดือน (กรองกองได้) */
  async summaryYearly(year: number, user: AuthUser, deptId?: string) {
    const base = () => {
      const q = buildVisibleQuery(this.ticketRepo, user, false).andWhere(`${THAI_YEAR_EXPR} = :sy`, { sy: year });
      if (deptId) q.andWhere('t.owner_dept_id = :fd', { fd: deptId });
      return q;
    };
    const groupCount = async (expr: string) => {
      const rows = await base().select(expr, 'key').addSelect('COUNT(*)', 'count').groupBy('key').orderBy('count', 'DESC').getRawMany();
      return rows.map((r) => ({ key: r.key ?? 'ไม่ระบุ', count: Number(r.count) }));
    };
    const [byStepRaw, byUrgency, byDepartment, monthsRaw, total] = await Promise.all([
      groupCount('t.current_step'),
      groupCount(`COALESCE(NULLIF(t.urgency_level, ''), 'ปกติ')`),
      groupCount(`COALESCE("ownerDept".name_th, 'ไม่ระบุกอง')`),
      base().select(THAI_MONTH_EXPR, 'month').addSelect('COUNT(*)', 'count').groupBy('month').getRawMany(),
      base().getCount(),
    ]);
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, count: Number(monthsRaw.find((m) => Number(m.month) === i + 1)?.count || 0) }));
    const byStep = byStepRaw.map((r) => ({ ...r, label: stepLabelStatic(r.key) }));
    return { year, total, byStep, byUrgency, byDepartment, months };
  }

  /** C7 — รายงานสรุปสารบรรณ (ตามสถานะ/กอง/ความเร่งด่วน + เกินกำหนด) — เคารพสิทธิ์การมองเห็น + ชั้นความลับ */
  async report(user: AuthUser) {
    const toNum = (rows: any[], k = 'count') => rows.map((r) => ({ ...r, count: Number(r[k]) }));

    const [byStatusRaw, byDeptRaw, byUrgencyRaw, total, overdue] = await Promise.all([
      buildVisibleQuery(this.ticketRepo, user)
        .select('t.status', 'name').addSelect('COUNT(*)', 'count')
        .groupBy('t.status').getRawMany(),
      buildVisibleQuery(this.ticketRepo, user)
        .select(`COALESCE(ownerDept.name_th, 'ไม่ระบุกอง')`, 'name').addSelect('COUNT(*)', 'count')
        .groupBy('ownerDept.name_th').orderBy('count', 'DESC').getRawMany(),
      buildVisibleQuery(this.ticketRepo, user)
        .select('t.urgency_level', 'name').addSelect('COUNT(*)', 'count')
        .groupBy('t.urgency_level').getRawMany(),
      buildVisibleQuery(this.ticketRepo, user).getCount(),
      buildVisibleQuery(this.ticketRepo, user)
        .andWhere('t.due_date < CURRENT_DATE')
        .andWhere('t.status NOT IN (:...done)', { done: [TicketStatus.COMPLETED, TicketStatus.CANCELLED] })
        .getCount(),
    ]);

    return {
      byStatus: toNum(byStatusRaw).map((r) => ({ status: r.name, count: r.count })),
      byDept: toNum(byDeptRaw),
      byUrgency: toNum(byUrgencyRaw),
      overdue,
      total,
    };
  }

  // ─────────────────────────────────────────── ข้อ 8: รายงานสถิติ
  /** สถิติทะเบียนตามเล่ม / ตามกอง / ตามเดือน (เคารพสิทธิ์ + กรองรายปี) */
  async statistics(user: AuthUser, fiscalYear?: number) {
    const base = () => {
      const qb = buildVisibleQuery(this.ticketRepo, user);
      if (fiscalYear) qb.andWhere('t.fiscal_year = :fy', { fy: fiscalYear });
      return qb;
    };

    const byBookRows = await base()
      .select('t.register_book', 'book').addSelect('t.direction', 'direction')
      .addSelect('COUNT(*)', 'count').groupBy('t.register_book').addGroupBy('t.direction').getRawMany();

    const byDeptRows = await base()
      .leftJoin('t.ownerDept', 'od')
      .select('od.name_th', 'dept').addSelect('COUNT(*)', 'count')
      .groupBy('od.name_th').orderBy('count', 'DESC').getRawMany();

    const byMonthRows = await base()
      .select(`TO_CHAR(t.created_at, 'YYYY-MM')`, 'month').addSelect('COUNT(*)', 'count')
      .groupBy('month').orderBy('month', 'ASC').getRawMany();

    const byStatusRows = await base()
      .select('t.status', 'status').addSelect('COUNT(*)', 'count').groupBy('t.status').getRawMany();

    const books = listBooks().map((b) => ({
      ...b,
      count: Number(byBookRows.find((r) => r.book === b.key)?.count || 0),
    }));
    const totalReceive = byBookRows.filter((r) => r.direction === TicketDirection.RECEIVE).reduce((s, r) => s + Number(r.count), 0);
    const totalSend = byBookRows.filter((r) => r.direction === TicketDirection.SEND).reduce((s, r) => s + Number(r.count), 0);

    return {
      fiscalYear: fiscalYear || null,
      totals: { all: totalReceive + totalSend, receive: totalReceive, send: totalSend },
      byBook: books,
      byDept: byDeptRows.map((r) => ({ dept: r.dept || 'ไม่ระบุกอง', count: Number(r.count) })),
      byMonth: byMonthRows.map((r) => ({ month: r.month, count: Number(r.count) })),
      byStatus: byStatusRows.map((r) => ({ status: r.status, count: Number(r.count) })),
    };
  }

  /** Export สถิติทะเบียนเป็น Excel (ข้อ 8) — 3 ชีต: ตามเล่ม/ตามกอง/ตามเดือน */
  async statisticsExcel(user: AuthUser, fiscalYear?: number): Promise<Buffer> {
    const stat = await this.statistics(user, fiscalYear);
    const wb = new ExcelJS.Workbook();
    const yearLabel = fiscalYear ? `ปีงบ ${fiscalYear}` : 'ทุกปี';

    const s1 = wb.addWorksheet('ตามสมุดทะเบียน');
    s1.addRow([`สถิติทะเบียนสารบรรณ — ${yearLabel}`]);
    s1.addRow([`รวมทั้งหมด ${stat.totals.all} | รับ ${stat.totals.receive} | ส่ง ${stat.totals.send}`]);
    s1.addRow([]);
    s1.addRow(['สมุดทะเบียน', 'ทิศทาง', 'จำนวน']);
    s1.getRow(4).font = { bold: true };
    for (const b of stat.byBook) s1.addRow([b.label, b.direction, b.count]);
    s1.columns = [{ width: 36 }, { width: 10 }, { width: 12 }];

    const s2 = wb.addWorksheet('ตามกอง');
    s2.addRow(['กองเจ้าของเรื่อง', 'จำนวน']);
    s2.getRow(1).font = { bold: true };
    for (const d of stat.byDept) s2.addRow([d.dept, d.count]);
    s2.columns = [{ width: 30 }, { width: 12 }];

    const s3 = wb.addWorksheet('ตามเดือน');
    s3.addRow(['เดือน', 'จำนวน']);
    s3.getRow(1).font = { bold: true };
    for (const m of stat.byMonth) s3.addRow([m.month, m.count]);
    s3.columns = [{ width: 16 }, { width: 12 }];

    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  // ─────────────────────────────────────────── Export Excel (ตามผลค้นหา + เคารพสิทธิ์)
  async exportExcel(dto: TicketQueryDto, user: AuthUser): Promise<Buffer> {
    const qb = buildVisibleQuery(this.ticketRepo, user);
    applyTicketFilters(qb, dto);
    qb.orderBy('t.createdAt', 'DESC').take(5000);
    const rows = await qb.getMany();

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('สารบรรณ', { pageSetup: { paperSize: 9, orientation: 'landscape' } });
    ws.columns = [
      { header: 'เลขสารบรรณ', key: 'ticketNumber', width: 16 },
      { header: 'เลขหนังสือภายนอก', key: 'externalDocNumber', width: 18 },
      { header: 'เรื่อง', key: 'subject', width: 40 },
      { header: 'หน่วยงานต้นทาง', key: 'sourceOrg', width: 26 },
      { header: 'กองเจ้าของเรื่อง', key: 'ownerDept', width: 20 },
      { header: 'ผู้รับผิดชอบ', key: 'responsible', width: 20 },
      { header: 'ความเร่งด่วน', key: 'urgencyLevel', width: 12 },
      { header: 'ชั้นความลับ', key: 'confidentiality', width: 12 },
      { header: 'วัตถุประสงค์', key: 'purpose', width: 16 },
      { header: 'สถานะ', key: 'status', width: 16 },
      { header: 'วันที่ส่ง', key: 'sentDate', width: 14 },
      { header: 'วันครบกำหนด', key: 'dueDate', width: 14 },
      { header: 'วันที่สร้าง', key: 'createdAt', width: 14 },
    ];
    ws.getRow(1).font = { bold: true };
    const fmt = (d: any) => (d ? new Date(d).toLocaleDateString('th-TH') : '');
    for (const r of rows) {
      ws.addRow({
        ticketNumber: r.ticketNumber,
        externalDocNumber: r.externalDocNumber || '',
        subject: r.subject,
        sourceOrg: r.sourceOrg || '',
        ownerDept: r.ownerDept?.nameTh || '',
        responsible: r.responsibleUser?.fullNameTh || '',
        urgencyLevel: r.urgencyLevel,
        confidentiality: r.confidentiality,
        purpose: r.purpose === 'อื่นๆ' ? (r.purposeOther || 'อื่นๆ') : (r.purpose || ''),
        status: r.status,
        sentDate: fmt(r.sentDate),
        dueDate: fmt(r.dueDate),
        createdAt: fmt(r.createdAt),
      });
    }
    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  // ─────────────────────────────────────────── Export Excel — รายงานสรุป (ปี/เดือน) v4
  async summaryYearlyExcel(year: number, user: AuthUser, deptId?: string): Promise<Buffer> {
    const sum = await this.summaryYearly(year, user, deptId);
    const M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const wb = new ExcelJS.Workbook();

    const s1 = wb.addWorksheet('ภาพรวม');
    s1.addRow([`สรุปสารบรรณ ปี ${year} (ภาพรวมทั้งปี)`]);
    s1.addRow([`รวมทั้งหมด ${sum.total} เรื่อง`]);
    s1.addRow([]);
    s1.addRow(['สถานะ (ขั้นตอน)', 'จำนวน']);
    s1.getRow(4).font = { bold: true };
    for (const r of sum.byStep) s1.addRow([r.label || r.key, r.count]);
    s1.columns = [{ width: 30 }, { width: 12 }];

    const s2 = wb.addWorksheet('รายเดือน');
    s2.addRow(['เดือน', 'จำนวน']);
    s2.getRow(1).font = { bold: true };
    for (const m of sum.months) s2.addRow([M[m.month - 1] || m.month, m.count]);
    s2.columns = [{ width: 16 }, { width: 12 }];

    const s3 = wb.addWorksheet('ตามกอง');
    s3.addRow(['กองเจ้าของเรื่อง', 'จำนวน']);
    s3.getRow(1).font = { bold: true };
    for (const d of sum.byDepartment) s3.addRow([d.key, d.count]);
    s3.columns = [{ width: 30 }, { width: 12 }];

    const s4 = wb.addWorksheet('ความเร่งด่วน');
    s4.addRow(['ระดับ', 'จำนวน']);
    s4.getRow(1).font = { bold: true };
    for (const u of sum.byUrgency) s4.addRow([u.key, u.count]);
    s4.columns = [{ width: 16 }, { width: 12 }];

    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  async summaryMonthlyExcel(year: number, month: number, user: AuthUser, deptId?: string): Promise<Buffer> {
    const sum = await this.summaryMonthly(year, month, user, deptId);
    const M = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
    const wb = new ExcelJS.Workbook();

    const s1 = wb.addWorksheet('สรุป');
    s1.addRow([`สรุปสารบรรณ ${M[month - 1] || month} ${year}`]);
    s1.addRow([`รวม ${sum.total} เรื่อง`]);
    s1.addRow([]);
    s1.addRow(['สถานะ (ขั้นตอน)', 'จำนวน']);
    s1.getRow(4).font = { bold: true };
    for (const r of sum.byStep) s1.addRow([r.label || r.key, r.count]);
    s1.columns = [{ width: 30 }, { width: 12 }];

    const s2 = wb.addWorksheet('รายการเรื่อง');
    s2.columns = [
      { header: 'เลขทะเบียนรับ', key: 'reg', width: 18 },
      { header: 'เอกสารเลขที่', key: 'ext', width: 16 },
      { header: 'เรื่อง', key: 'subject', width: 40 },
      { header: 'จาก', key: 'from', width: 24 },
      { header: 'กองเจ้าของเรื่อง', key: 'dept', width: 20 },
      { header: 'สถานะ', key: 'status', width: 22 },
      { header: 'ความเร่งด่วน', key: 'urgency', width: 12 },
    ];
    s2.getRow(1).font = { bold: true };
    for (const t of sum.tickets as any[]) {
      s2.addRow({
        reg: t.receiveRegNumber || t.ticketNumber,
        ext: t.externalDocNumber || '',
        subject: t.subject,
        from: t.sourceOrg || '',
        dept: t.ownerDept?.nameTh || '',
        status: stepLabelStatic(t.currentStep) || t.status,
        urgency: t.urgencyLevel || 'ปกติ',
      });
    }

    const s3 = wb.addWorksheet('ตามกอง');
    s3.addRow(['กองเจ้าของเรื่อง', 'จำนวน']);
    s3.getRow(1).font = { bold: true };
    for (const d of sum.byDepartment) s3.addRow([d.key, d.count]);
    s3.columns = [{ width: 30 }, { width: 12 }];

    return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
  }

  /** ดึงรายการตามผลค้นหา (สำหรับ export PDF รายการ) */
  async findForExport(dto: TicketQueryDto, user: AuthUser) {
    const qb = buildVisibleQuery(this.ticketRepo, user);
    qb.leftJoinAndSelect('t.organization', 'organization');
    applyTicketFilters(qb, dto);
    qb.orderBy('t.createdAt', 'DESC').take(2000);
    return qb.getMany();
  }

  // ─────────────────────────────────────────── ภาพรวมผู้บริหาร (หน้าหลักนายก)
  /**
   * งานที่ยังไม่ปิด "อยู่ที่ใคร ค้างกี่วัน" — scope ตามสิทธิ์การมองเห็นเดิม (buildVisibleQuery + ชั้นความลับ)
   * วันที่มาถึงขั้นปัจจุบัน = log ล่าสุดของเรื่อง (ส่งต่อ/ตีกลับ/ลงรับ) ไม่มี log ใช้วันลงรับ
   */
  async overview(user: AuthUser) {
    const sinceExpr = `COALESCE((SELECT MAX(l.acted_at) FROM document_workflow_logs l WHERE l.doc_type = 'TICKET' AND l.document_id = t.id), t.received_record_at, t.created_at)`;
    const rows: any[] = await buildVisibleQuery(this.ticketRepo, user, false)
      .andWhere('t.status NOT IN (:...closed)', { closed: [TicketStatus.COMPLETED, TicketStatus.CANCELLED] })
      .leftJoin('users', 'h', 'h.id = t.current_holder_user_id')
      .leftJoin('departments', 'hd', 'hd.id = h.department_id')
      .select([
        't.id AS id', 't.ticket_number AS "ticketNumber"', 't.receive_reg_number AS "regNo"', 't.subject AS subject', 't.source_org AS "sourceOrg"',
        't.status AS status', 't.current_step AS step', 't.current_holder_user_id AS "holderId"',
        `TRIM(COALESCE(h.title_th, '') || h.full_name_th) AS "holderName"`, 'h.position_name AS "holderPos"',
        'hd.name_th AS "holderDept"', 'ownerDept.name_th AS "ownerDept"',
        `${sinceExpr} AS since`,
      ])
      .getRawMany();

    const now = Date.now();
    const daysOf = (d: any) => Math.max(0, Math.floor((now - new Date(d).getTime()) / 86400000));
    const holderOf = await this.roleHolders(user.organizationId);
    const groups = new Map<string, any>();
    const mayorQueue: any[] = [];
    let person = 0, clerk = 0, mayor = 0, stale7 = 0;
    for (const r of rows) {
      const item = { id: r.id, ticketNumber: r.regNo || r.ticketNumber, subject: r.subject, sourceOrg: r.sourceOrg, days: daysOf(r.since), since: r.since };
      if (item.days > 7) stale7++;
      let key: string, head: any;
      if (r.step === 'PENDING_MAYOR' || r.status === TicketStatus.PENDING_MAYOR) {
        mayor++; mayorQueue.push(item);
        key = 'role:mayor'; head = { kind: 'mayor', name: holderOf.mayor?.name || 'นายก', position: holderOf.mayor?.position || 'นายก' };
      } else if (r.step === 'PENDING_CLERK' || r.status === TicketStatus.PENDING_CLERK) {
        clerk++;
        key = 'role:clerk'; head = { kind: 'clerk', name: holderOf.clerk?.name || 'ปลัด', position: holderOf.clerk?.position || 'ปลัด' };
      } else if (r.holderId) {
        person++;
        key = 'user:' + r.holderId; head = { kind: 'person', name: r.holderName, position: r.holderPos, dept: r.holderDept };
      } else {
        person++;
        key = 'dept:' + (r.ownerDept || '-'); head = { kind: 'dept', name: r.ownerDept || 'ไม่ระบุกอง', position: 'ยังไม่ระบุผู้รับ' };
      }
      const g = groups.get(key) ?? { key, ...head, count: 0, oldestDays: 0, items: [] as any[] };
      g.count++; g.oldestDays = Math.max(g.oldestDays, item.days); g.items.push(item);
      groups.set(key, g);
    }
    const holders = [...groups.values()]
      .map((g) => ({ ...g, items: g.items.sort((a: any, b: any) => b.days - a.days) }))
      .sort((a, b) => b.oldestDays - a.oldestDays || b.count - a.count);
    mayorQueue.sort((a, b) => b.days - a.days);

    // เรื่องที่ปิดงานเดือนนี้ (เวลาไทย) — ใช้ทั้งตัวเลขและหน้ารายการ "เสร็จเดือนนี้"
    const done: any[] = await buildVisibleQuery(this.ticketRepo, user, false)
      .andWhere('t.status = :done', { done: TicketStatus.COMPLETED })
      .andWhere(`date_trunc('month', COALESCE(t.completed_at, t.updated_at) AT TIME ZONE 'Asia/Bangkok') = date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok')`)
      .leftJoin('users', 'ms', 'ms.id = t.mayor_signed_by')
      .select([
        't.id AS id', `COALESCE(t.receive_reg_number, t.ticket_number) AS "ticketNumber"`, 't.subject AS subject', 't.source_org AS "sourceOrg"',
        'ownerDept.name_th AS "ownerDept"', `TRIM(COALESCE(ms.title_th, '') || ms.full_name_th) AS "closedBy"`,
        'COALESCE(t.completed_at, t.updated_at) AS "doneAt"', 't.created_at AS "createdAt"',
      ])
      .orderBy('"doneAt"', 'DESC')
      .getRawMany();

    return { total: rows.length, stale7, byStep: { person, clerk, mayor, completedThisMonth: done.length }, holders, mayorQueue, done };
  }

  /** ชื่อผู้ถือตำแหน่งปลัด/นายกปัจจุบัน (ตัวหลักก่อนรอง) — ใช้แสดงในแถว "อยู่ที่ใคร" */
  private async roleHolders(orgId: string) {
    const rows: any[] = await this.ticketRepo.query(
      `SELECT ro.name AS role, TRIM(COALESCE(u.title_th, '') || u.full_name_th) AS name, u.position_name AS position
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id AND (ur.expires_at IS NULL OR ur.expires_at > now())
         JOIN roles ro ON ro.id = ur.role_id
        WHERE u.organization_id = $1 AND u.is_active = true AND ro.name IN ('CLERK','DEPUTY_CLERK','MAYOR','DEPUTY_MAYOR')
        ORDER BY u.created_at`, [orgId]);
    const pick = (names: string[]) => {
      for (const n of names) { const r = rows.find((x) => x.role === n); if (r) return { name: r.name, position: r.position }; }
      return null;
    };
    return { clerk: pick(['CLERK', 'DEPUTY_CLERK']), mayor: pick(['MAYOR', 'DEPUTY_MAYOR']) };
  }
}
