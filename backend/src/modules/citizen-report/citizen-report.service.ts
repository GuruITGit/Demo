import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CitizenReport } from '../../database/entities/citizen-report.entity';
import { Organization } from '../../database/entities/organization.entity';
import { WaterCustomer } from '../../database/entities/water-customer.entity';
import { Department } from '../../database/entities/department.entity';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { notifyUsersWithPermission } from '../../common/notify-permission';
import { PdfService } from '../pdf/pdf.service';
import { CreateReportDto, UpdateReportDto, SignatureSlot } from './dto/citizen-report.dto';

export const REPORT_STATUSES = ['new', 'in_progress', 'done', 'rejected'] as const;

/** ผู้ใช้ที่ login (จาก JWT) เท่าที่ขั้นตอนอนุมัติ 3 ผู้เซ็นต้องใช้ — ไม่ import ข้ามโมดูล ticket/correspondence */
export interface ReportActorUser {
  id: string;
  roles?: string[];
}

@Injectable()
export class CitizenReportService {
  constructor(
    @InjectRepository(CitizenReport) private readonly repo: Repository<CitizenReport>,
    @InjectRepository(Organization) private readonly orgRepo: Repository<Organization>,
    @InjectRepository(WaterCustomer) private readonly waterCustomerRepo: Repository<WaterCustomer>,
    @InjectRepository(Department) private readonly deptRepo: Repository<Department>,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  /** แจ้งผู้ที่มีสิทธิ์จัดการเรื่องแจ้ง/ร้องเรียนว่ามีเรื่องใหม่ */
  private async notifyNewReport(orgId: string, refNo: string, id: string, title: string) {
    await notifyUsersWithPermission(this.repo.manager.connection, this.notifications, orgId, { module: 'complaint', action: 'manage', subject: 'Report' }, {
      type: 'complaint:new', title: 'มีเรื่องแจ้ง/ร้องเรียนใหม่', body: `${refNo} · ${title}`, actionUrl: '/citizen-reports', refType: 'citizen_report', refId: id,
    });
  }

  /** หา org: ใช้ code ถ้าส่งมา, ไม่งั้นถ้ามี อบต. เดียวใช้อันนั้น (พอร์ทัลสาธารณะไม่มี JWT) */
  private async resolveOrg(code?: string): Promise<string> {
    if (code?.trim()) {
      const r = await this.orgRepo.query(
        `SELECT id FROM organizations WHERE UPPER(code) = UPPER($1) AND is_active = true LIMIT 1`, [code.trim()]);
      if (r[0]) return r[0].id;
    }
    const rows = await this.orgRepo.query(`SELECT id FROM organizations WHERE is_active = true LIMIT 2`);
    if (rows.length === 1) return rows[0].id;
    throw new BadRequestException('ระบุหน่วยงานไม่ถูกต้อง');
  }

  /** เลขอ้างอิง Ryy-00001 ต่อ อบต. ต่อปี พ.ศ. */
  private async nextRef(orgId: string): Promise<string> {
    const yy = String(new Date().getFullYear() + 543).slice(-2);
    const rows = await this.repo.query(
      `SELECT COUNT(*)::int AS c FROM citizen_reports WHERE organization_id = $1 AND ref_no LIKE $2`,
      [orgId, `R${yy}-%`]);
    const n = (rows[0]?.c || 0) + 1;
    return `R${yy}-${String(n).padStart(5, '0')}`;
  }

  /**
   * แนะนำชื่อผู้แจ้งแบบเรียลไทม์ — ค้นจากชื่อที่เคยแจ้งเรื่องไว้จริงในระบบ (ช่วยพิมพ์ให้ตรงตอนติดตามสถานะ)
   * ไม่โชว์รายละเอียดเรื่อง/เบอร์ คืนแค่ชื่อ กันข้อมูลหลุดเกินจำเป็น — ยืนยันตัวตนจริงยังต้องกรอกเบอร์คู่เหมือนเดิม
   */
  async suggestNames(q: string, org?: string): Promise<string[]> {
    const query = q.trim();
    if (query.length < 2) return [];
    const orgId = await this.resolveOrg(org);
    const rows = await this.repo.query(
      `SELECT DISTINCT reporter_name FROM citizen_reports
        WHERE organization_id = $1 AND reporter_name ILIKE $2 || '%'
        ORDER BY reporter_name LIMIT 8`,
      [orgId, query],
    );
    return rows.map((r: { reporter_name: string }) => r.reporter_name);
  }

  /**
   * เดาหมู่ที่จากพิกัด GPS — หามาตรวัดน้ำที่มีพิกัดใกล้ที่สุด (ระยะทางแบบประมาณ พอเพียงสำหรับ
   * "ใกล้สุด" ในพื้นที่ตำบลเดียว ไม่ต้องคำนวณระยะจริงแบบ Haversine) แล้วใช้หมู่ของรายนั้น
   * เป็นค่าแนะนำ — เป็นการประมาณจากข้อมูลจริง ไม่ใช่ขอบเขตหมู่ทางการ จึงต้องให้แก้เองได้เสมอ
   * ไม่พบจุดใกล้พอ (เกิน ~3 กม.) → คืน null ให้ประชาชนเลือกเอง
   */
  async nearestVillage(lat: number, lng: number, org?: string): Promise<{ villageNo: number | null }> {
    const orgId = await this.resolveOrg(org);
    const MAX_DIST2 = 0.03 * 0.03; // ~3 กม. (องศา² โดยประมาณ)
    const [row] = await this.waterCustomerRepo.query(
      `SELECT village_no,
              (split_part(gps, ',', 1)::float - $2) ^ 2 + (split_part(gps, ',', 2)::float - $3) ^ 2 AS dist2
         FROM water_customers
        WHERE organization_id = $1 AND deleted_at IS NULL AND village_no IS NOT NULL
          AND gps ~ '^-?[0-9.]+,-?[0-9.]+$'
        ORDER BY dist2 ASC LIMIT 1`,
      [orgId, lat, lng],
    );
    if (!row || Number(row.dist2) > MAX_DIST2) return { villageNo: null };
    return { villageNo: row.village_no };
  }

  // ─────────────────────────────── ประชาชน (สาธารณะ)
  async create(dto: CreateReportDto, file?: Express.Multer.File) {
    const orgId = await this.resolveOrg(dto.org);
    if (!dto.category?.trim() || !dto.detail?.trim()) throw new BadRequestException('กรุณาระบุประเภทและรายละเอียด');
    let photoUrl: string | null = null;
    if (file) {
      photoUrl = await this.storage.storeCitizenAttachment(file.buffer, file.mimetype, file.originalname, 'citizen-reports');
    }
    const refNo = await this.nextRef(orgId);
    const geo = dto.geoLat && dto.geoLng ? { lat: Number(dto.geoLat), lng: Number(dto.geoLng) } : null;
    const villageNo = dto.villageNo ? Number(dto.villageNo) : null;
    // คำร้องทั่วไป — ลูกบ้านกรอกเรื่อง/คำนำหน้า/บ้านเลขที่เองตั้งแต่ตอนแจ้ง (เก็บ answers jsonb เดียวกับที่หน้า admin แก้ไขใช้)
    const answers = (dto.titlePrefix || dto.houseNo) ? {
      ...(dto.titlePrefix?.trim() ? { titlePrefix: dto.titlePrefix.trim() } : {}),
      ...(dto.houseNo?.trim() ? { houseNo: dto.houseNo.trim() } : {}),
    } : null;
    const row = await this.repo.save(this.repo.create({
      organizationId: orgId, refNo,
      category: dto.category.trim(),
      title: dto.title?.trim() || null,
      subject: dto.subject?.trim() || null,
      detail: dto.detail.trim(),
      reporterName: dto.reporterName?.trim() || null,
      reporterPhone: dto.reporterPhone?.trim() || null,
      location: dto.location?.trim() || null,
      villageNo, geo, answers,
      photoUrl, status: 'new',
    }));
    await this.notifyNewReport(orgId, row.refNo, row.id, row.category);
    return { refNo: row.refNo, id: row.id, status: row.status };
  }

  /** เอนจินฟอร์ม: บันทึกคำร้องจาก config ฟอร์มใด ๆ (คำตอบ jsonb + ไฟล์หลายช่อง + พิกัด GPS) */
  async createSubmission(body: any, uploaded?: Express.Multer.File[]) {
    const orgId = await this.resolveOrg(body.org);
    let answers: Record<string, any> = {};
    try { answers = body.answers ? JSON.parse(body.answers) : {}; } catch { throw new BadRequestException('ข้อมูลฟอร์มไม่ถูกต้อง'); }
    const formTitle = (body.formTitle || 'คำร้อง').toString().slice(0, 200);
    const files: { field: string; name: string; url: string }[] = [];
    for (const f of uploaded || []) {
      const url = await this.storage.storeCitizenAttachment(f.buffer, f.mimetype, f.originalname, 'citizen-forms');
      files.push({ field: f.fieldname, name: f.originalname, url });
    }
    const geo = body.geoLat && body.geoLng ? { lat: Number(body.geoLat), lng: Number(body.geoLng) } : null;
    const name = (body.reporterName || answers.fullName || answers.name || '').toString().trim().slice(0, 150) || null;
    const phone = (body.reporterPhone || answers.phone || answers.tel || '').toString().trim().slice(0, 30) || null;
    const summary = (answers.detail || answers.problem || answers.note ||
      Object.values(answers).find((v) => typeof v === 'string' && v.length > 8) || formTitle).toString().slice(0, 500);
    const refNo = await this.nextRef(orgId);
    const row = await this.repo.save(this.repo.create({
      organizationId: orgId, refNo,
      formKey: (body.formKey ? String(body.formKey).slice(0, 60) : null),
      formTitle, category: formTitle, detail: summary,
      answers, files, geo,
      reporterName: name, reporterPhone: phone,
      location: (answers.location ? String(answers.location).slice(0, 500) : (answers.address ? String(answers.address).slice(0, 500) : null)),
      photoUrl: files[0]?.url || null, status: 'new',
    }));
    await this.notifyNewReport(orgId, row.refNo, row.id, formTitle);
    return { refNo: row.refNo, id: row.id, status: row.status };
  }

  private digits(s?: string | null): string { return (s || '').replace(/\D/g, ''); }

  /** เช็กสถานะด้วยเลขอ้างอิง + เบอร์ (กันไล่สุ่มดูของคนอื่น) — เทียบเบอร์แบบตัวเลขล้วน ไม่สนขีด/เว้นวรรค */
  async statusByRef(refNo: string, phone: string, org?: string) {
    const orgId = await this.resolveOrg(org);
    const row = await this.repo.findOne({ where: { organizationId: orgId, refNo: (refNo || '').trim().toUpperCase() } });
    if (!row) throw new NotFoundException('เลขอ้างอิงหรือเบอร์ไม่ถูกต้อง');
    if (row.reporterPhone && this.digits(row.reporterPhone) !== this.digits(phone)) {
      throw new NotFoundException('เลขอ้างอิงหรือเบอร์ไม่ถูกต้อง');
    }
    return { refNo: row.refNo, category: row.category, status: row.status, staffNote: row.staffNote, createdAt: row.createdAt };
  }

  /**
   * ลืมเลขอ้างอิง → ค้นเรื่องของตัวเองด้วยชื่ออย่างเดียว (ตามที่ตกลงกัน — ไม่บังคับเบอร์แล้ว)
   * ชื่อเทียบว่า "มีคำที่กรอกอยู่ในชื่อผู้แจ้ง" (ใช้ strpos ไม่ใช้ ILIKE กัน % _ ที่ผู้ใช้พิมพ์มา)
   */
  async listMine(name: string, org?: string) {
    const n = (name || '').trim().replace(/\s+/g, ' ');
    if (n.length < 2) throw new BadRequestException('กรุณากรอกชื่อ-สกุล');
    const orgId = await this.resolveOrg(org);
    const rows = await this.repo.query(
      `SELECT ref_no AS "refNo", category, status, staff_note AS "staffNote", created_at AS "createdAt"
         FROM citizen_reports
        WHERE organization_id = $1
          AND strpos(lower(regexp_replace(COALESCE(reporter_name, ''), '[[:space:]]+', ' ', 'g')), lower($2)) > 0
        ORDER BY created_at DESC
        LIMIT 20`, [orgId, n]);
    if (!rows.length) throw new NotFoundException('ไม่พบเรื่องที่ตรงกับชื่อนี้');
    return rows;
  }

  /**
   * signed URL แบบ relative (ตัด scheme+host ทิ้ง เหลือ /v1/storage/files/...)
   * → เบราว์เซอร์โหลด same-origin เสมอผ่าน nginx ไม่ผูกกับ APP_URL ของ backend
   * (กันเคส prod ที่ APP_URL ไม่ได้ตั้ง แล้วรูปกลายเป็น http://localhost:4000/... โหลดไม่ได้)
   */
  private signRel(u?: string | null): string | null {
    const s = this.storage.signUrlIfPrivate(u ?? null);
    if (!s) return s ?? null;
    const i = s.indexOf('/v1/storage/files/');
    return i >= 0 ? s.slice(i) : s;
  }

  // ─────────────────────────────── เจ้าหน้าที่ (คัดกรอง)
  async list(orgId: string, status?: string, page = 1, limit?: number) {
    // จำนวนต่อหน้าเลือกได้เฉพาะค่าที่หน้าเว็บมีให้ (กันขอทีละมาก ๆ) — ไม่ส่ง = 20 เหมือนเดิม
    const take = [10, 20, 50].includes(limit as number) ? (limit as number) : 20;
    const qb = this.repo.createQueryBuilder('r').leftJoinAndSelect('r.targetDept', 'targetDept').where('r.organizationId = :orgId', { orgId });
    if (status && (REPORT_STATUSES as readonly string[]).includes(status)) {
      qb.andWhere('r.status = :status', { status });
    } else {
      // ไม่ระบุสถานะ (แท็บ "ทั้งหมด") → ไม่เอาที่เสร็จแล้ว กันหน้ารก — เรื่องที่เสร็จแล้วดูที่แท็บ "เสร็จสิ้น"
      qb.andWhere("r.status != 'done'");
    }
    qb.orderBy('r.createdAt', 'DESC').take(take).skip((page - 1) * take);
    const [rows, total] = await qb.getManyAndCount();
    rows.forEach((r) => (r.photoUrl = this.signRel(r.photoUrl)));
    const countRows: { status: string; c: number }[] = await this.repo.query(
      `SELECT status, COUNT(*)::int AS c FROM citizen_reports WHERE organization_id = $1 GROUP BY status`, [orgId]);
    const counts: Record<string, number> = { all: 0 };
    for (const r of countRows) {
      counts[r.status] = r.c;
      if (r.status !== 'done') counts.all += r.c;
    }
    return { data: rows, meta: { total, page, limit: take, totalPages: Math.max(1, Math.ceil(total / take)), counts } };
  }

  /**
   * ตัวเลขบนเมนู
   * - unseen: เรื่องที่เข้ามาหลังเวลา `since` (= ครั้งล่าสุดที่เจ้าหน้าที่เปิดหน้านี้) · ไม่ส่ง since (ยังไม่เคยเปิด) = นับเรื่องสถานะ "ใหม่"
   * - new: เรื่องสถานะ "ใหม่" ที่รอจัดการทั้งหมด · today: เข้ามาวันนี้ (เวลาไทย)
   * - now: เวลาของเซิร์ฟเวอร์ ให้ฝั่งเว็บเก็บเป็น "ดูล่าสุด" (ไม่พึ่งนาฬิกาเครื่องผู้ใช้ กันเวลาเพี้ยน)
   */
  async newCount(orgId: string, since?: string) {
    const sinceDate = since && !Number.isNaN(Date.parse(since)) ? new Date(since) : null;
    const [r] = await this.repo.query(
      `SELECT COUNT(*) FILTER (WHERE CASE WHEN $2::timestamptz IS NULL THEN status = 'new' ELSE created_at > $2::timestamptz END)::int AS "unseen",
              COUNT(*) FILTER (WHERE status = 'new')::int AS "new",
              COUNT(*) FILTER (WHERE created_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Bangkok') AT TIME ZONE 'Asia/Bangkok'))::int AS "today",
              (date_trunc('milliseconds', now()) + interval '1 millisecond') AS "now"
         FROM citizen_reports WHERE organization_id = $1`, [orgId, sinceDate]);
    return { unseen: r?.unseen ?? 0, new: r?.new ?? 0, today: r?.today ?? 0, now: r?.now };
  }

  async detail(id: string, orgId: string) {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId }, relations: ['targetDept'] });
    if (!row) throw new NotFoundException('ไม่พบเรื่อง');
    row.photoUrl = this.signRel(row.photoUrl);
    if (Array.isArray(row.files)) row.files = row.files.map((f) => ({ ...f, url: this.signRel(f.url) }));
    return row;
  }

  async update(id: string, dto: UpdateReportDto, orgId: string, userId: string, roles: string[] = []) {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('ไม่พบเรื่อง');
    if (dto.status !== undefined) {
      if (!(REPORT_STATUSES as readonly string[]).includes(dto.status)) throw new BadRequestException('สถานะไม่ถูกต้อง');
      // ปิดเรื่องเป็น "เสร็จสิ้น" ได้เฉพาะนายก/รองนายก — คนอื่นทำได้แค่ "กำลังดำเนินการ"/"ปฏิเสธ" หรือผ่านขั้นตอนอนุมัติ 3 ผู้เซ็น
      if (dto.status === 'done' && !roles.includes('MAYOR') && !roles.includes('DEPUTY_MAYOR')) {
        throw new ForbiddenException('ปิดเรื่องเป็น "เสร็จสิ้น" ได้เฉพาะนายก/รองนายกเท่านั้น');
      }
      row.status = dto.status;
    }
    if (dto.staffNote !== undefined) row.staffNote = dto.staffNote?.trim() || null;
    // ─── แก้ไขข้อมูลเอกสารก่อนพิมพ์ (เหมือนสารบรรณที่แก้ subject/body ได้) ───
    if (dto.subject !== undefined) row.subject = dto.subject?.trim() || null;
    if (dto.detail !== undefined) row.detail = dto.detail.trim();
    if (dto.reporterName !== undefined) row.reporterName = dto.reporterName?.trim() || null;
    if (dto.reporterPhone !== undefined) row.reporterPhone = dto.reporterPhone?.trim() || null;
    if (dto.location !== undefined) row.location = dto.location?.trim() || null;
    if (dto.villageNo !== undefined) row.villageNo = dto.villageNo?.trim() ? Number(dto.villageNo) : null;
    if (dto.answers !== undefined) row.answers = { ...(row.answers || {}), ...dto.answers };
    if (dto.petitionChecked) row.petitionCheckedAt = new Date();
    row.handledBy = userId;
    await this.repo.save(row);
    return this.detail(id, orgId);
  }

  /**
   * นายก/รองนายกปิดเรื่องเป็น "เสร็จสิ้น" ตรง ๆ (ไม่ผ่านการส่งไปกอง) — endpoint แยกจาก update() เพราะ
   * MAYOR/DEPUTY_MAYOR มีแค่สิทธิ์ complaint:read:Report ไม่มี complaint:manage:Report ตาม role เริ่มต้น
   */
  async closeAsMayor(id: string, orgId: string, roles: string[] = []) {
    if (!roles.includes('MAYOR') && !roles.includes('DEPUTY_MAYOR')) {
      throw new ForbiddenException('ปิดเรื่องเป็น "เสร็จสิ้น" ได้เฉพาะนายก/รองนายกเท่านั้น');
    }
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('ไม่พบเรื่อง');
    if (row.targetDeptId) throw new BadRequestException('เรื่องนี้ส่งไปกองแล้ว ต้องปิดผ่านขั้นตอนอนุมัติ 3 ผู้เซ็น');
    row.status = 'done';
    await this.repo.save(row);
    return this.detail(id, orgId);
  }

  async remove(id: string, orgId: string) {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('ไม่พบเรื่อง');
    await this.repo.remove(row);
    return { deleted: true };
  }

  // ─────────── ขั้นตอนอนุมัติ 3 ผู้เซ็น (ผอ.กอง → ปลัด → นายก) — คนละกลไกกับสารบรรณทั้งหมด ───────────

  /** admin กลาง "ส่งไปกองเพื่ออนุมัติ" — เลือกกอง ผอ.กองผู้เซ็นขั้นแรก resolve อัตโนมัติจาก department.headUserId */
  async routeToDept(id: string, targetDeptId: string, orgId: string) {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!row) throw new NotFoundException('ไม่พบเรื่อง');
    const dept = await this.deptRepo.findOne({ where: { id: targetDeptId, organizationId: orgId } });
    if (!dept) throw new BadRequestException('กองไม่ถูกต้อง');
    row.targetDeptId = dept.id;
    if (row.status === 'new') row.status = 'in_progress';
    await this.repo.save(row);
    return this.detail(id, orgId);
  }

  /**
   * เซ็น/อนุมัติขั้นที่ถึงตาปัจจุบัน — endpoint เดียวใช้ร่วมทั้ง 3 ขั้น
   * หา "ขั้นปัจจุบัน" จากคอลัมน์ signed_at ที่ยังว่าง (ไม่เก็บ stage แยก กัน inconsistent state)
   */
  async approveStep(id: string, orgId: string, user: ReportActorUser, signatureImage?: string) {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId }, relations: ['targetDept'] });
    if (!row) throw new NotFoundException('ไม่พบเรื่อง');
    if (!row.targetDeptId) throw new BadRequestException('ยังไม่ได้ส่งไปกอง');
    // เซ็นด้วยการลาก "ลายเซ็นของฉัน" ไปวางบนเอกสารที่อัปโหลด — ต้องวางอย่างน้อย 1 เอกสารก่อนส่งต่อ
    const withDocs = await this.repo.createQueryBuilder('r').addSelect('r.docLayout').where('r.id = :id', { id }).getOne();
    const docs = withDocs?.docLayout?.docs && typeof withDocs.docLayout.docs === 'object' ? Object.values(withDocs.docLayout.docs) : [];
    const signed = docs.some((l: any) => Array.isArray(l?.items) && l.items.some((it: any) => it?.type === 'signature' && it.props?.ownerId === user.id));
    if (!signed) throw new BadRequestException('กรุณาเปิดเอกสารแล้ววางลายเซ็นของคุณอย่างน้อย 1 เอกสารก่อนส่งต่อ');
    const roles = user.roles || [];
    const now = new Date();
    // ตรวจชนิดไฟล์จริง (data:image เท่านั้น) กัน injection ผ่านช่องลายเซ็น — ไม่บังคับแนบ
    // ไม่แนบตอนอนุมัติ = คงรูปเดิมที่แนบไว้จากหน้ากรอกเอกสาร (ไม่ลบทิ้ง)
    const sig = PdfService.safeDataImage(signatureImage) || null;
    // ADMIN/SUPER_ADMIN อนุมัติแทนได้ทุกขั้น — แต่บันทึกผู้ลงนามเป็น "เจ้าของตำแหน่งจริง" (ไม่งั้นชื่อ admin ไปโผล่ในเอกสาร)
    // หาเจ้าของตำแหน่งไม่เจอค่อย fallback เป็น admin เอง
    const isAdmin = this.isAdmin(roles);
    if (!row.deptHeadSignedAt) {
      if (!isAdmin && user.id !== row.targetDept?.headUserId) throw new ForbiddenException('คุณไม่ใช่หัวหน้ากองที่ถูกมอบหมายเรื่องนี้');
      row.deptHeadSignedBy = isAdmin ? (row.targetDept?.headUserId || user.id) : user.id;
      row.deptHeadSignedAt = now;
      if (sig) row.deptHeadSignature = sig;
    } else if (!row.clerkSignedAt) {
      if (!isAdmin && !roles.includes('CLERK') && !roles.includes('DEPUTY_CLERK')) throw new ForbiddenException('ต้องมีบทบาทปลัดจึงจะดำเนินการขั้นนี้ได้');
      row.clerkSignedBy = isAdmin ? ((await this.findRoleHolder(orgId, ['CLERK', 'DEPUTY_CLERK'])) || user.id) : user.id;
      row.clerkSignedAt = now;
      if (sig) row.clerkSignature = sig;
    } else if (!row.mayorSignedAt) {
      if (!isAdmin && !roles.includes('MAYOR') && !roles.includes('DEPUTY_MAYOR')) throw new ForbiddenException('ต้องมีบทบาทนายกจึงจะดำเนินการขั้นนี้ได้');
      row.mayorSignedBy = isAdmin ? ((await this.findRoleHolder(orgId, ['MAYOR', 'DEPUTY_MAYOR'])) || user.id) : user.id;
      row.mayorSignedAt = now;
      if (sig) row.mayorSignature = sig;
      row.status = 'done';
    } else {
      throw new BadRequestException('เรื่องนี้อนุมัติครบทุกขั้นแล้ว');
    }
    await this.repo.save(row);
    return this.detail(id, orgId);
  }

  private isAdmin(roles: string[] = []) {
    return roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  }

  /** ผู้ใช้ที่ active ใน org ที่ถือ role ตามลำดับที่ให้ (ตัวหลักก่อนรอง เช่น MAYOR ก่อน DEPUTY_MAYOR) */
  private async findRoleHolder(orgId: string, roleNames: string[]): Promise<string | null> {
    const [r] = await this.repo.query(
      `SELECT u.id FROM users u
         JOIN user_roles ur ON ur.user_id = u.id AND (ur.expires_at IS NULL OR ur.expires_at > now())
         JOIN roles ro ON ro.id = ur.role_id
        WHERE u.organization_id = $1 AND u.is_active = true AND ro.name = ANY($2)
        ORDER BY array_position($2::text[], ro.name::text), u.created_at
        LIMIT 1`, [orgId, roleNames]);
    return r?.id ?? null;
  }

  /**
   * แนบ/ลบรูปลายเซ็นจากหน้ากรอก/แก้ไขเอกสาร — แต่ละช่องแนบได้เฉพาะเจ้าของตำแหน่ง (เกณฑ์เดียวกับ approveStep):
   * ผอ.กอง = headUserId ของกองที่ส่งไป / ปลัด = CLERK,DEPUTY_CLERK / นายก = MAYOR,DEPUTY_MAYOR
   * ADMIN/SUPER_ADMIN แนบแทนได้ทุกช่อง (ไว้ตรวจเอกสาร/แนบลายเซ็นที่สแกนจากกระดาษ)
   * ไม่แตะ signed_at — แค่รูปที่จะพิมพ์ลงเอกสาร
   */
  async attachSignature(id: string, orgId: string, user: ReportActorUser, slot: SignatureSlot, signatureImage: string) {
    const row = await this.repo.findOne({ where: { id, organizationId: orgId }, relations: ['targetDept'] });
    if (!row) throw new NotFoundException('ไม่พบเรื่อง');
    const roles = user.roles || [];
    if (this.isAdmin(roles)) {
      // ข้ามการตรวจตำแหน่ง
    } else if (slot === 'deptHead') {
      if (!row.targetDeptId) throw new BadRequestException('ยังไม่ได้ส่งไปกอง — ยังไม่มีหัวหน้ากองผู้เซ็น');
      if (user.id !== row.targetDept?.headUserId) throw new ForbiddenException('แนบลายเซ็นช่องนี้ได้เฉพาะหัวหน้ากองที่ถูกมอบหมาย');
    } else if (slot === 'clerk') {
      if (!roles.includes('CLERK') && !roles.includes('DEPUTY_CLERK')) throw new ForbiddenException('แนบลายเซ็นช่องนี้ได้เฉพาะปลัด/รองปลัด');
    } else if (!roles.includes('MAYOR') && !roles.includes('DEPUTY_MAYOR')) {
      throw new ForbiddenException('แนบลายเซ็นช่องนี้ได้เฉพาะนายก/รองนายก');
    }
    let sig: string | null = null;
    if (signatureImage.trim()) {
      // ตรวจชนิดไฟล์จริง (data:image เท่านั้น) กัน injection ลง PDF
      sig = PdfService.safeDataImage(signatureImage) || null;
      if (!sig) throw new BadRequestException('รูปลายเซ็นไม่ถูกต้อง (รองรับ PNG/JPG/GIF/WEBP)');
    }
    if (slot === 'deptHead') row.deptHeadSignature = sig;
    else if (slot === 'clerk') row.clerkSignature = sig;
    else row.mayorSignature = sig;
    await this.repo.save(row);
    return this.detail(id, orgId);
  }

  /**
   * ข้อมูลสำหรับพิมพ์ "คำร้องทั่วไป" (PDF) — ดึงชื่อ+ตำแหน่งผู้เซ็นจริงจาก users (ไม่ฮาร์ดโค้ด)
   * คนที่ยังไม่เซ็น คอลัมน์ signed_by เป็น null → join ไม่เจอ ก็แค่ชื่อว่าง (แสดงเป็น "รอดำเนินการ" ที่ pdf.service)
   */
  async petitionPdfData(id: string, orgId: string) {
    const report = await this.detail(id, orgId);
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    // ยังไม่เซ็น = พิมพ์ชื่อเจ้าของตำแหน่งปัจจุบันไว้ล่วงหน้า (ตามแบบฟอร์มกระดาษ) — เซ็นแล้ว = ชื่อคนที่เซ็นจริง
    const [clerkId, mayorId] = await Promise.all([
      this.findRoleHolder(orgId, ['CLERK', 'DEPUTY_CLERK']),
      this.findRoleHolder(orgId, ['MAYOR', 'DEPUTY_MAYOR']),
    ]);
    const [signers] = await this.repo.query(
      `SELECT dh.full_name_th AS "deptHeadName", dh.position_name AS "deptHeadPos",
              cl.full_name_th AS "clerkName", my.full_name_th AS "mayorName"
         FROM citizen_reports r
         LEFT JOIN departments d ON d.id = r.target_dept_id
         LEFT JOIN users dh ON dh.id = COALESCE(r.dept_head_signed_by, d.head_user_id)
         LEFT JOIN users cl ON cl.id = COALESCE(r.clerk_signed_by, $2::uuid)
         LEFT JOIN users my ON my.id = COALESCE(r.mayor_signed_by, $3::uuid)
        WHERE r.id = $1`, [id, clerkId, mayorId]);
    return { report, org, signers: signers || {} };
  }

  /** แท็บ "รอฉันเซ็น" — เรื่องที่ถึงตา user คนนี้พอดี (หัวหน้ากองเป้าหมาย / บทบาทปลัด / บทบาทนายก) */
  /**
   * ภาพรวมผู้บริหาร (หน้าหลักนายก) — เรื่องที่ยังไม่ปิดอยู่ขั้นไหน (ใช้เกณฑ์ signed_at เดียวกับ approveStep)
   * + คิวรอนายก · เสร็จเดือนนี้นับจาก mayor_signed_at / updated_at ของเรื่องที่ done
   */
  async overview(orgId: string) {
    const rows: any[] = await this.repo.query(
      `SELECT r.id, r.ref_no AS "refNo", r.category, r.title, r.subject, r.detail, r.status, r.target_dept_id AS "deptId",
              d.name_th AS "deptName", r.dept_head_signed_at AS "deptHeadSignedAt", r.clerk_signed_at AS "clerkSignedAt",
              COALESCE(r.clerk_signed_at, r.dept_head_signed_at, r.created_at) AS since
         FROM citizen_reports r
         LEFT JOIN departments d ON d.id = r.target_dept_id
        WHERE r.organization_id = $1 AND r.status IN ('new','in_progress')`, [orgId]);
    const now = Date.now();
    const days = (d: any) => Math.max(0, Math.floor((now - new Date(d).getTime()) / 86400000));
    let fresh = 0, clerk = 0, mayor = 0, stale7 = 0;
    const deptMap = new Map<string, number>();
    const mayorQueue: any[] = [];
    const items: any[] = []; // ทุกเรื่องที่ยังไม่ปิด + ขั้นที่อยู่ (หน้ารายการ "งานที่ยังไม่เสร็จ" / "ค้างเกิน 7 วัน")
    const titleOf = (r: any) => r.subject || r.title || r.category || (r.detail || '').slice(0, 80);
    for (const r of rows) {
      const dd = days(r.since);
      if (dd > 7) stale7++;
      let stage: string;
      if (!r.deptId) { fresh++; stage = 'เรื่องใหม่ (ยังไม่ส่งกอง)'; }
      else if (!r.deptHeadSignedAt) { deptMap.set(r.deptName || '-', (deptMap.get(r.deptName || '-') || 0) + 1); stage = `รอ ผอ.${r.deptName || 'กอง'}`; }
      else if (!r.clerkSignedAt) { clerk++; stage = 'รอปลัด'; }
      else {
        mayor++; stage = 'รอนายก';
        mayorQueue.push({ id: r.id, refNo: r.refNo, subject: titleOf(r), days: dd, since: r.since });
      }
      items.push({ id: r.id, refNo: r.refNo, subject: titleOf(r), detail: r.detail, deptName: r.deptName, stage, days: dd, since: r.since });
    }
    const done: any[] = await this.repo.query(
      `SELECT r.id, r.ref_no AS "refNo", COALESCE(r.subject, r.title, r.category) AS subject, r.detail, d.name_th AS "deptName",
              COALESCE(r.mayor_signed_at, r.updated_at) AS "doneAt"
         FROM citizen_reports r
         LEFT JOIN departments d ON d.id = r.target_dept_id
        WHERE r.organization_id = $1 AND r.status = 'done'
          AND date_trunc('month', COALESCE(r.mayor_signed_at, r.updated_at) AT TIME ZONE 'Asia/Bangkok') = date_trunc('month', now() AT TIME ZONE 'Asia/Bangkok')
        ORDER BY "doneAt" DESC`, [orgId]);
    return {
      total: rows.length, stale7,
      byStep: {
        new: fresh, clerk, mayor, doneThisMonth: done.length,
        deptHead: [...deptMap.entries()].map(([dept, count]) => ({ dept, count })).sort((a, b) => b.count - a.count),
      },
      mayorQueue: mayorQueue.sort((a, b) => b.days - a.days),
      items: items.sort((a, b) => b.days - a.days),
      done,
    };
  }

  async myQueue(orgId: string, user: ReportActorUser) {
    const roles = user.roles || [];
    const isClerk = roles.includes('CLERK') || roles.includes('DEPUTY_CLERK');
    const isMayor = roles.includes('MAYOR') || roles.includes('DEPUTY_MAYOR');
    const isAdmin = this.isAdmin(roles); // admin อนุมัติแทนได้ทุกขั้น → เห็นทุกเรื่องที่ยังเซ็นไม่ครบ
    const rows = await this.repo.query(
      `SELECT r.id, r.ref_no AS "refNo", r.category, r.detail, r.status, r.created_at AS "createdAt",
              r.village_no AS "villageNo", r.location, d.name_th AS "targetDeptName",
              r.dept_head_signed_at AS "deptHeadSignedAt", r.clerk_signed_at AS "clerkSignedAt", r.mayor_signed_at AS "mayorSignedAt"
         FROM citizen_reports r
         JOIN departments d ON d.id = r.target_dept_id
        WHERE r.organization_id = $1
          AND (
            (r.mayor_signed_at IS NULL AND $5::boolean)
            OR (r.dept_head_signed_at IS NULL AND d.head_user_id = $2)
            OR (r.dept_head_signed_at IS NOT NULL AND r.clerk_signed_at IS NULL AND $3::boolean)
            OR (r.clerk_signed_at IS NOT NULL AND r.mayor_signed_at IS NULL AND $4::boolean)
          )
        ORDER BY r.created_at ASC`,
      [orgId, user.id, isClerk, isMayor, isAdmin],
    );
    return rows;
  }
}
