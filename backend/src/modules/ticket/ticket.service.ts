import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, In } from 'typeorm';
import {
  CorrespondenceTicket, TicketStatus, TicketUrgency,
  TicketConfidentiality, CONFIDENTIALITY_RANK,
  RegisterBook, REGISTER_BOOKS, TicketDirection, SarabanStep,
} from '../../database/entities/correspondence-ticket.entity';
import {
  CorrespondenceTicketDepartment, TicketDeptStatus,
} from '../../database/entities/correspondence-ticket-department.entity';
import { DocumentWorkflowLog } from '../../database/entities/document-workflow-log.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Department } from '../../database/entities/department.entity';
import { User } from '../../database/entities/user.entity';
import { CreateTicketDto, TicketQueryDto, UpdateTicketDto } from './dto/ticket.dto';
import {
  CreateTicketV4Dto, UpdateTicketV4Dto, TicketActionV4Dto, TicketActionType, ReturnV4Dto,
} from './dto/ticket-v4.dto';
import { paginate } from '../../common/dto/pagination.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { StorageService } from '../storage/storage.service';
import { AttachmentAccessRegistry } from '../storage/attachment-access.registry';
import { PdfService } from '../pdf/pdf.service';
import { isAdmin } from '../../common/utils/ownership.util';
import {
  AuthUser, isPrivileged, canSeeConfidential, applyConfidentiality, buildVisibleQuery, applyTicketFilters,
} from './ticket-visibility';
import { assertLayout, hasSignatureBy, signatureItems } from '../doc-editor/layout-validate';

/** fromStep ของทอดแรก (ผู้ลงรับส่งตอนสร้างเรื่อง) — ใน route_trail / step_signatures */
const CREATED_HOP = 'CREATED';

@Injectable()
export class TicketService implements OnModuleInit {
  constructor(
    @InjectRepository(CorrespondenceTicket) private ticketRepo: Repository<CorrespondenceTicket>,
    @InjectRepository(CorrespondenceTicketDepartment) private tdRepo: Repository<CorrespondenceTicketDepartment>,
    @InjectRepository(DocumentWorkflowLog) private workflowRepo: Repository<DocumentWorkflowLog>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    @InjectRepository(Department) private deptRepo: Repository<Department>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private notifications: NotificationsService,
    private storage: StorageService,
    private accessRegistry: AttachmentAccessRegistry,
    private pdf: PdfService,
  ) {}

  /** ลงทะเบียนตัวตรวจสิทธิ์ไฟล์แนบสารบรรณ (กันดูไฟล์แนบเรื่องที่ไม่มีสิทธิ์เห็น รวมชั้นความลับ) */
  onModuleInit() {
    this.accessRegistry.register('ticket', (refId, user) => this.canAccessTicket(refId, user));
  }

  /** ผู้ใช้มีสิทธิ์เห็นสารบรรณเรื่องนี้ (และไฟล์แนบ) หรือไม่ — logic เดียวกับ findOne */
  async canAccessTicket(refId: string, user: AuthUser): Promise<boolean> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: refId },
      relations: ['ownerDept', 'ticketDepartments', 'ticketDepartments.department', 'ticketDepartments.assignedUser'],
    });
    if (!ticket) return false;
    if (isPrivileged(user)) return true;
    const inMyDept = ticket.ownerDeptId === user.departmentId
      || (ticket.ticketDepartments?.some((td) => td.departmentId === user.departmentId) ?? false);
    if (ticket.createdBy !== user.id && !inMyDept && ticket.currentHolderUserId !== user.id) return false;
    return canSeeConfidential(ticket, user);
  }

  // ─────────────────────────────────────────── เลขสารบรรณ
  /** ปี พ.ศ. ปัจจุบัน (ใช้เป็นค่าเริ่มต้นปีงบเมื่อ DTO ไม่ระบุ) */
  private currentBuddhistYear(): number {
    return new Date().getFullYear() + 543;
  }

  private async usersByRole(orgId: string, roleName: string): Promise<string[]> {
    const rows = await this.ticketRepo.query(
      `SELECT u.id FROM users u
       JOIN user_roles ur ON ur.user_id = u.id
       JOIN roles r ON r.id = ur.role_id
       WHERE u.organization_id = $1 AND r.name = $2 AND u.is_active = true AND u.deleted_at IS NULL`,
      [orgId, roleName],
    );
    return rows.map((r: any) => r.id);
  }

  private async userRoleNames(userId: string): Promise<string[]> {
    const rows = await this.ticketRepo.query(
      `SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1`,
      [userId],
    );
    return rows.map((r: any) => r.name);
  }

  private async log(
    ticketId: string, stepName: string, actorId: string, action: string,
    fromStatus?: string, toStatus?: string, note?: string, signatureImage?: string,
  ) {
    await this.workflowRepo.save({
      docType: 'TICKET', documentId: ticketId, stepNumber: 0,
      stepName, actorId, action, fromStatus, toStatus, note, signatureImage,
    });
  }

  /**
   * บันทึกประวัติกิจกรรม — ต้องใส่ organizationId เสมอ
   * (audit.service.findAll กรอง `organization_id = :orgId` แถวที่เป็น null จะไม่โผล่ในหน้าประวัติกิจกรรมเลย)
   */
  private async audit(user: AuthUser, action: string, ticketId: string, title: string) {
    await this.auditRepo.save({
      organizationId: user.organizationId, userId: user.id, action, module: 'correspondence',
      resourceType: 'ticket', resourceId: ticketId, resourceTitle: title,
    });
  }

  private async notify(orgId: string, recipientIds: string[], type: string, title: string, body: string, ticketId: string) {
    const unique = [...new Set(recipientIds.filter(Boolean))];
    await Promise.all(
      unique.map((rid) =>
        this.notifications.createNotification({
          organizationId: orgId, recipientId: rid, type, title, body,
          refType: 'ticket', refId: ticketId, actionUrl: `/correspondence/tickets/${ticketId}`,
        }),
      ),
    );
  }

  // ─────────────────────────────────────────── สร้างสารบรรณ
  async create(dto: CreateTicketDto, user: AuthUser) {
    const orgId = user.organizationId;
    const ownerDept = dto.ownerDeptId
      ? await this.deptRepo.findOne({ where: { id: dto.ownerDeptId, organizationId: orgId } })
      : user.departmentId
        ? await this.deptRepo.findOne({ where: { id: user.departmentId } })
        : null;

    // ตรวจว่าทุกกองที่มอบหมายอยู่ในองค์กรเดียวกัน (ก่อนสร้าง กัน orphan + ออกเลขทิ้ง)
    const deptIds = [...new Set(dto.departmentIds)];
    const depts = await this.deptRepo.find({ where: { id: In(deptIds), organizationId: orgId } });
    if (depts.length !== deptIds.length) {
      throw new BadRequestException('มีกองที่เลือกไม่ถูกต้อง');
    }

    // ผู้รับผิดชอบต่อกอง (tree view) — หลายคนต่อกอง; คนแรกโดยรวม = responsible (compat/แจ้งเตือน/ชั้นความลับ)
    const assigneesMap = new Map<string, string[]>();
    for (const a of dto.assignees || []) {
      if (deptIds.includes(a.departmentId)) assigneesMap.set(a.departmentId, [...new Set(a.userIds || [])]);
    }
    const allAssignedUserIds = [...new Set([...assigneesMap.values()].flat())];
    const primaryResponsible = dto.responsibleUserId || allAssignedUserIds[0] || null;

    // เลือกสมุดทะเบียน (ข้อ 1) — ค่าเริ่มต้น "รับทั่วไป"; เล่มความลับยกระดับชั้นความลับอัตโนมัติ
    const book = (dto.registerBook as RegisterBook) && REGISTER_BOOKS[dto.registerBook as RegisterBook]
      ? (dto.registerBook as RegisterBook)
      : RegisterBook.R_MAIN;
    const meta = REGISTER_BOOKS[book];
    const year = dto.fiscalYear ?? this.currentBuddhistYear();
    // เลขทะเบียนรับ (กรอกเอง) = เลขหลักของสารบรรณ → ใช้เป็น ticketNumber ด้วย (rework v20000: เลิก auto-gen)
    // uq_ticket_org_book_year_number กันซ้ำ "ต่อสมุด ต่อปีงบ" (เฉพาะที่ยังไม่ลบ) ให้อยู่แล้ว
    // pre-check ที่นี่เพื่อ error ที่อ่านง่าย — เงื่อนไขต้องตรงกับ index ไม่งั้นแนะนำเลขที่บันทึกไม่ได้
    const ticketNumber = (dto.receiveRegNumber || '').trim();
    if (!ticketNumber) throw new BadRequestException('กรุณากรอกเลขทะเบียนรับ');
    const dup = await this.ticketRepo.findOne({
      where: { organizationId: orgId, registerBook: book, fiscalYear: year, ticketNumber },
    });
    if (dup) throw new BadRequestException(`เลขทะเบียนรับ "${ticketNumber}" ถูกใช้แล้วในสมุดทะเบียนนี้ (ปีงบ ${year})`);
    const confidentiality = meta.secret && (CONFIDENTIALITY_RANK[dto.confidentiality || ''] || 0) === 0
      ? TicketConfidentiality.CONFIDENTIAL
      : (dto.confidentiality || TicketConfidentiality.NORMAL);

    const ticket = await this.ticketRepo.save(
      this.ticketRepo.create({
        organizationId: orgId,
        ticketNumber,
        registerBook: book,
        direction: meta.direction,
        isCircular: !!meta.circular,
        circularRecipients: meta.circular && dto.circularRecipients?.length ? dto.circularRecipients : null,
        externalDocNumber: dto.externalDocNumber,
        fiscalYear: year,
        receivedDate: dto.receivedDate ? new Date(dto.receivedDate)
          : (meta.direction === TicketDirection.RECEIVE ? new Date() : null),
        receivedTime: dto.receivedTime || null,
        docDate: dto.docDate ? new Date(dto.docDate) : null,
        sentDate: dto.sentDate ? new Date(dto.sentDate) : null,
        sentTime: dto.sentTime || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        subject: dto.subject,
        body: dto.body,
        // หน่วยงานต้นทาง / ผู้ส่ง
        sourceOrg: dto.sourceOrg || null,
        senderName: dto.senderName || null,
        senderPosition: dto.senderPosition || null,
        recipient: dto.recipient || null,
        // ข้อมูลหนังสือ
        keywords: dto.keywords || null,
        docCategory: dto.docCategory || null,
        docType: dto.docType || null,
        confidentiality,
        purpose: dto.purpose || null,
        purposeOther: dto.purposeOther || null,
        refDocNumber: dto.refDocNumber || null,
        refDocDetail: dto.refDocDetail || null,
        enclosures: dto.enclosures?.length ? dto.enclosures : null,
        urgencyLevel: dto.urgencyLevel || TicketUrgency.NORMAL,
        ownerDeptId: ownerDept?.id || null,
        responsibleUserId: primaryResponsible,
        note: dto.note,
        status: TicketStatus.ASSIGNED,
        // เลขทะเบียนรับ = เลขหลักที่กรอกเอง (ลงรับทันทีตอนสร้าง ไม่ต้องกด "บันทึกการรับ" แยก)
        receivedBy: user.id,
        receivedRecordAt: new Date(),
        receiveRegNumber: ticketNumber,
        createdBy: user.id,
      }),
    );

    // มอบหมายกอง + ผู้รับผิดชอบต่อกอง (หลายคน)
    for (const deptId of deptIds) {
      const userIds = assigneesMap.get(deptId) || [];
      await this.tdRepo.save(
        this.tdRepo.create({
          ticketId: ticket.id,
          departmentId: deptId,
          assignedUserId: userIds[0] || (deptId === ownerDept?.id ? dto.responsibleUserId : null) || null,
          assignedUserIds: userIds.length ? userIds : null,
          status: TicketDeptStatus.ASSIGNED,
        }),
      );
    }

    await this.log(ticket.id, 'สร้างสารบรรณ', user.id, 'สร้าง', null, TicketStatus.ASSIGNED, dto.note);
    await this.audit(user, 'CREATE', ticket.id, ticket.subject);

    // แจ้งเตือนหัวหน้ากอง + ผู้รับผิดชอบ
    const recipients = [
      ...depts.map((d) => d.headUserId),
      ...allAssignedUserIds,
    ].filter((id) => id && id !== user.id) as string[];
    await this.notify(orgId, recipients, 'ticket:assigned', 'มีสารบรรณมอบหมายให้กองของท่าน',
      `${ticket.ticketNumber} — ${ticket.subject}`, ticket.id);

    return this.findOne(ticket.id, user);
  }

  // ═══════════════════════════ v4 workflow engine (rework/saraban-v4) ═══════════════════════════

  /** เวลาปัจจุบัน HH:mm (frontend เติมหน่วย " น.") */
  private nowHm(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  /** label สถานะ v4 เติมชื่อกอง dynamic (ตาม spec — คำนวณตอนอ่าน ไม่เก็บลง status varchar(50)) */
  private stepLabel(step: string, ownerDeptName?: string, relatedDeptName?: string, holderName?: string): string {
    const o = ownerDeptName || 'กองเจ้าของ';
    const r = relatedDeptName || 'กองที่เกี่ยวข้อง';
    switch (step) {
      case SarabanStep.PENDING_PERSON: return `รอ${holderName || 'ผู้รับ'} ดำเนินการ`;
      case SarabanStep.PENDING_OWNER_HEAD: return `รอผู้อำนวยการ${o} พิจารณา`;
      case SarabanStep.PENDING_OWNER_CLERK: return `รอธุรการ${o} ดำเนินการ`;
      case SarabanStep.PENDING_RELATED_HEAD: return `รอผู้อำนวยการ${r} ดำเนินการ`;
      case SarabanStep.PENDING_RELATED_CLERK: return `รอธุรการ${r} ลงรับดำเนินการ`;
      case SarabanStep.PENDING_CLERK: return 'รอปลัด ดำเนินการ';
      case SarabanStep.PENDING_MAYOR: return 'รอนายก ดำเนินการ';
      case SarabanStep.COMPLETED: return 'เสร็จสิ้น';
      case SarabanStep.RETURNED: return 'ตีกลับ';
      case SarabanStep.CANCELLED: return 'ยกเลิก';
      default: return step;
    }
  }

  /** map step v4 → สถานะหยาบ (status varchar(50)) เพื่อ dashboard/รายการเดิมยังทำงาน */
  private mapStepToStatus(step: string): string {
    switch (step) {
      case SarabanStep.PENDING_CLERK: return TicketStatus.PENDING_CLERK;
      case SarabanStep.PENDING_MAYOR: return TicketStatus.PENDING_MAYOR;
      case SarabanStep.COMPLETED: return TicketStatus.COMPLETED;
      case SarabanStep.RETURNED: return TicketStatus.RETURNED;
      case SarabanStep.CANCELLED: return TicketStatus.CANCELLED;
      default: return TicketStatus.IN_PROGRESS; // OWNER/RELATED head+clerk steps
    }
  }

  private pushStepSig(ticket: CorrespondenceTicket, step: string, userId: string) {
    const arr = Array.isArray(ticket.stepSignatures) ? ticket.stepSignatures : [];
    arr.push({ step, userId, signedAt: new Date().toISOString() });
    ticket.stepSignatures = arr;
  }

  /** findOne + statusLabel + related dept (สำหรับหน้ารายละเอียด v4; ticket เก่าที่ไม่มี currentStep → statusLabel = status เดิม) */
  async findOneV4(id: string, user: AuthUser) {
    const t: any = await this.findOne(id, user);
    let relatedDept: Department | null = null;
    if (t.relatedDeptId) {
      relatedDept = await this.deptRepo.findOne({ where: { id: t.relatedDeptId } });
      t.relatedDept = relatedDept;
    }
    if (t.currentHolderUserId) {
      const h = await this.userRepo.findOne({
        where: { id: t.currentHolderUserId },
        select: ['id', 'titleTh', 'fullNameTh', 'positionName', 'departmentId'],
      });
      const hDept = h?.departmentId ? await this.deptRepo.findOne({ where: { id: h.departmentId }, select: ['id', 'nameTh'] }) : null;
      t.currentHolder = h ? { id: h.id, titleTh: h.titleTh, fullNameTh: h.fullNameTh, positionName: h.positionName, departmentName: hDept?.nameTh ?? null } : null;
    }
    t.statusLabel = t.currentStep
      ? this.stepLabel(t.currentStep, t.ownerDept?.nameTh, relatedDept?.nameTh, t.currentHolder?.fullNameTh)
      : t.status;
    // ปุ่มตีกลับ: บอกว่าจะคืนให้ใคร (ผู้ส่งทอดล่าสุด · ทอดแรก = ผู้ลงรับ)
    const lastHop = Array.isArray(t.routeTrail) && t.routeTrail.length ? t.routeTrail[t.routeTrail.length - 1] : null;
    const backId = lastHop && lastHop.fromStep !== CREATED_HOP ? lastHop.fromUserId : t.createdBy;
    if (backId) {
      const b = await this.userRepo.findOne({ where: { id: backId }, select: ['id', 'titleTh', 'fullNameTh'] });
      t.returnTo = b ? { id: b.id, name: `${b.titleTh || ''}${b.fullNameTh}`, isCreator: backId === t.createdBy && (!lastHop || lastHop.fromStep === CREATED_HOP) } : null;
    }
    t.canEditDoc = this.canEditDoc(t, user);
    // เปิดดูรายละเอียด = อ่านแล้ว (fire-and-forget ไม่บล็อกการตอบกลับ)
    void this.markRead(id, user).catch(() => {});
    return t;
  }

  /**
   * วางลายเซ็น/แก้เอกสารได้เฉพาะ "ผู้ถือเรื่อง" ขั้นปัจจุบัน — คนอื่นดูอย่างเดียว · เสร็จสิ้นแล้วแก้ไม่ได้
   * PENDING_PERSON = ผู้ถือเรื่อง · PENDING_CLERK = บทบาทปลัด · PENDING_MAYOR = บทบาทนายก · ผู้ดูแลแก้ได้ทุกขั้นที่ยังไม่จบ
   */
  canEditDoc(t: { currentStep?: string | null; currentHolderUserId?: string | null }, user: AuthUser): boolean {
    const step = t.currentStep;
    if (!step || step === SarabanStep.COMPLETED || step === SarabanStep.CANCELLED) return false;
    if (isAdmin(user)) return true;
    const roles = user.roles || [];
    if (step === SarabanStep.PENDING_CLERK) return roles.includes('CLERK') || roles.includes('DEPUTY_CLERK');
    if (step === SarabanStep.PENDING_MAYOR) return roles.includes('MAYOR') || roles.includes('DEPUTY_MAYOR');
    return t.currentHolderUserId === user.id;
  }

  // ─────────────────────────────────────────── สร้างสารบรรณ v4
  async createV4(dto: CreateTicketV4Dto, user: AuthUser) {
    const orgId = user.organizationId;
    const rawTo = dto.toUserId || dto.assignedHeadUserId || null;
    if (!dto.toClerk && !rawTo) throw new BadRequestException('กรุณาเลือกผู้รับ (คน/กอง) หรือส่งปลัด');
    if (dto.toClerk && rawTo) throw new BadRequestException('เลือกผู้รับได้ทางเดียว — คน/กอง หรือ ปลัด');
    // ตรวจ/แปลงผู้รับก่อน save — ถ้าไม่ผ่านจะได้ไม่มีเรื่องค้างครึ่งทาง
    const rcpt = await this.normalizeRecipient(user, { toUserId: rawTo, toClerk: !!dto.toClerk });
    const toUserId = rcpt.toUserId;
    // ต้องเซ็นทุกขั้น — ผู้ลงรับลาก "ลายเซ็นของฉัน" ไปวางบนเอกสารก่อนส่ง
    if (!dto.overlayLayout) throw new BadRequestException('กรุณาเซ็นเอกสาร (ลากลายเซ็นของคุณไปวาง) ก่อนบันทึก');
    assertLayout(dto.overlayLayout);
    if (!hasSignatureBy(dto.overlayLayout, user.id)) throw new BadRequestException('กรุณาลากลายเซ็นของคุณไปวางบนเอกสารก่อนบันทึก');

    // กองเจ้าของ = กองของคนรับคนแรก (ส่งปลัดตรง = กองของผู้ลงรับ)
    let ownerDeptId: string | null = user.departmentId || null;
    if (toUserId) {
      const target = await this.findRecipient(orgId, toUserId);
      ownerDeptId = target.departmentId || ownerDeptId;
    }

    const book = (dto.registerBook as RegisterBook) && REGISTER_BOOKS[dto.registerBook as RegisterBook]
      ? (dto.registerBook as RegisterBook) : RegisterBook.R_MAIN;
    const meta = REGISTER_BOOKS[book];
    const year = dto.fiscalYear ?? this.currentBuddhistYear();
    const ticketNumber = (dto.receiveRegNumber || '').trim();
    if (!ticketNumber) throw new BadRequestException('กรุณากรอกเลขทะเบียนรับ');
    const dup = await this.ticketRepo.findOne({
      where: { organizationId: orgId, registerBook: book, fiscalYear: year, ticketNumber },
    });
    if (dup) throw new BadRequestException(`เลขทะเบียนรับ "${ticketNumber}" ถูกใช้แล้วในสมุดทะเบียนนี้ (ปีงบ ${year})`);

    const confidentiality = meta.secret && (CONFIDENTIALITY_RANK[dto.confidentiality || ''] || 0) === 0
      ? TicketConfidentiality.CONFIDENTIAL
      : (dto.confidentiality || TicketConfidentiality.NORMAL);
    const purpose = dto.purposes?.length ? dto.purposes.join(', ') : null;

    const ticket = await this.ticketRepo.save(this.ticketRepo.create({
      organizationId: orgId,
      ticketNumber,
      registerBook: book,
      direction: meta.direction,
      fiscalYear: year,
      // รับวันที่ = auto (วันเวลาที่สร้าง)
      receivedDate: new Date(),
      receivedTime: this.nowHm(),
      externalDocNumber: dto.externalDocNumber,
      docDate: dto.docDate ? new Date(dto.docDate) : null,
      sourceOrg: dto.sourceOrg,
      subject: dto.subject,
      recipient: dto.recipient || null,
      body: dto.body || null,
      urgencyLevel: dto.urgencyLevel || TicketUrgency.NORMAL,
      confidentiality,
      purpose,
      purposeOther: dto.purposeOther || null,
      ownerDeptId,
      responsibleUserId: toUserId || user.id,
      assignedHeadUserId: toUserId,
      stepSignatures: [],
      routeTrail: [],
      overlayLayout: dto.overlayLayout,
      status: TicketStatus.IN_PROGRESS,
      receivedBy: user.id,
      receivedRecordAt: new Date(),
      receiveRegNumber: ticketNumber,
      createdBy: user.id,
    }));

    // ผู้ลงรับเซ็น แล้วส่งต่อทอดแรก
    this.pushStepSig(ticket, CREATED_HOP, user.id);
    const recips = await this.routeTo(ticket, user, CREATED_HOP, { toUserId, toClerk: rcpt.toClerk, note: dto.body || null });
    ticket.status = this.mapStepToStatus(ticket.currentStep);
    await this.ticketRepo.save(ticket);

    await this.log(ticket.id, 'สร้างสารบรรณ', user.id, 'สร้าง + ประทับเซ็น + ส่งดำเนินการ', null, ticket.currentStep, dto.body || null, dto.signatureImage);
    await this.audit(user, 'CREATE', ticket.id, ticket.subject);
    await this.notify(orgId, recips, 'ticket:assigned', 'มีสารบรรณส่งถึงท่าน', `${ticketNumber} — ${ticket.subject}`, ticket.id);
    return this.findOneV4(ticket.id, user);
  }

  /**
   * ตรวจผู้รับก่อนบันทึกอะไรลง DB (กันเรื่องค้างครึ่งทางเมื่อ validate ไม่ผ่าน)
   * เลือก "ตัวคน" ที่เป็นปลัด (เช่น เลือกกอง "ปลัด อบต.") → เข้าขั้นปลัด · เลือกนายกตรง → ไม่ได้ (ส่งนายกได้เฉพาะปลัด)
   */
  private async normalizeRecipient(user: AuthUser, opts: { toUserId?: string | null; toClerk?: boolean }) {
    if (opts.toClerk) return { toUserId: null, toClerk: true };
    if (!opts.toUserId) throw new BadRequestException('กรุณาเลือกผู้รับ');
    if (opts.toUserId === user.id) throw new BadRequestException('ส่งต่อให้ตัวเองไม่ได้');
    await this.findRecipient(user.organizationId, opts.toUserId);
    const roles = await this.userRoleNames(opts.toUserId);
    const isClerk = roles.some((r) => r === 'CLERK' || r === 'DEPUTY_CLERK');
    if (isClerk) return { toUserId: null, toClerk: true };
    if (roles.some((r) => r === 'MAYOR' || r === 'DEPUTY_MAYOR')) {
      throw new BadRequestException('ส่งถึงนายกได้เฉพาะปลัด — กรุณาเลือก "ส่งปลัด"');
    }
    return { toUserId: opts.toUserId, toClerk: false };
  }

  /** ผู้รับต้องเป็นผู้ใช้ที่ active ในองค์กรเดียวกัน */
  private async findRecipient(orgId: string, userId: string): Promise<User> {
    const u = await this.userRepo.findOne({
      where: { id: userId, organizationId: orgId },
      select: ['id', 'departmentId', 'fullNameTh', 'isActive'],
    });
    if (!u || u.isActive === false) throw new BadRequestException('ไม่พบผู้รับที่เลือก หรือบัญชีถูกปิดใช้งาน');
    return u;
  }

  /**
   * ส่งต่อ 1 ทอด — ตั้งผู้ถือเรื่อง/ขั้น, บันทึกเส้นทาง, ให้กองของผู้รับเห็นเรื่อง (ticket_departments)
   * คืนรายชื่อผู้ที่ต้องแจ้งเตือน (ยังไม่ save ticket — ผู้เรียก save เอง)
   */
  private async routeTo(
    t: CorrespondenceTicket, user: AuthUser, fromStep: string,
    opts: { toUserId?: string | null; toClerk?: boolean; toMayor?: boolean; note?: string | null },
  ): Promise<string[]> {
    let toStep: SarabanStep;
    let toUserId: string | null = null;
    let toDeptId: string | null = null;
    let recips: string[];
    if (!opts.toMayor) opts = { ...opts, ...await this.normalizeRecipient(user, opts) };
    if (opts.toMayor) {
      toStep = SarabanStep.PENDING_MAYOR;
      recips = [
        ...await this.usersByRole(user.organizationId, 'MAYOR'),
        ...await this.usersByRole(user.organizationId, 'DEPUTY_MAYOR'),
      ];
    } else if (opts.toClerk) {
      toStep = SarabanStep.PENDING_CLERK;
      recips = [
        ...await this.usersByRole(user.organizationId, 'CLERK'),
        ...await this.usersByRole(user.organizationId, 'DEPUTY_CLERK'),
      ];
    } else {
      if (!opts.toUserId) throw new BadRequestException('กรุณาเลือกผู้รับ');
      if (opts.toUserId === user.id) throw new BadRequestException('ส่งต่อให้ตัวเองไม่ได้');
      const target = await this.findRecipient(user.organizationId, opts.toUserId);
      toStep = SarabanStep.PENDING_PERSON;
      toUserId = target.id;
      toDeptId = target.departmentId || null;
      recips = [target.id];
      // ให้ผู้รับ (และกองของผู้รับ) เห็นเรื่อง — รวมเรื่องชั้นลับ (assigned_user_ids)
      if (toDeptId) {
        const td = await this.tdRepo.findOne({ where: { ticketId: t.id, departmentId: toDeptId } });
        if (td) {
          const ids = new Set([...(td.assignedUserIds || []), ...(td.assignedUserId ? [td.assignedUserId] : []), target.id]);
          td.assignedUserIds = [...ids];
          if (!td.assignedUserId) td.assignedUserId = target.id;
          await this.tdRepo.save(td);
        } else {
          await this.tdRepo.save(this.tdRepo.create({
            ticketId: t.id, departmentId: toDeptId,
            assignedUserId: target.id, assignedUserIds: [target.id],
            status: TicketDeptStatus.ASSIGNED,
          }));
        }
      }
    }
    t.currentStep = toStep;
    t.currentHolderUserId = toUserId;
    t.routeTrail = [...(Array.isArray(t.routeTrail) ? t.routeTrail : []), {
      fromUserId: user.id, fromStep, toUserId, toStep, toDeptId, at: new Date().toISOString(), note: opts.note ?? null,
    }];
    return recips;
  }

  // ─────────────────────────────────────────── ดำเนินการ 1 step v4
  async actionV4(id: string, dto: TicketActionV4Dto, user: AuthUser) {
    const t = await this.ticketRepo.findOne({
      where: { id, organizationId: user.organizationId },
      relations: ['ownerDept', 'relatedDept'],
    });
    if (!t) throw new NotFoundException('ไม่พบสารบรรณ');
    if (!t.currentStep) throw new BadRequestException('สารบรรณนี้ไม่ได้ใช้ workflow v4');
    const step = t.currentStep;
    const isAdminUser = isAdmin(user);
    const assertActor = (ok: boolean) => {
      if (!ok && !isAdminUser) throw new ForbiddenException('คุณไม่ใช่ผู้ที่ต้องดำเนินการในขั้นนี้');
    };
    const requireSig = () => {
      if (!dto.signatureImage) throw new BadRequestException('กรุณาประทับลายเซ็นก่อนส่ง');
      // ต้องลาก "ลายเซ็นของฉัน" ไปวางบนเอกสารแล้วเท่านั้น
      if (!hasSignatureBy(t.overlayLayout, user.id)) throw new BadRequestException('กรุณาเปิดเอกสาร (ดูเอกสาร / เซ็น) แล้ววางลายเซ็นของคุณก่อนส่ง');
    };
    const roles = user.roles || [];
    let stepName = this.stepLabel(step, t.ownerDept?.nameTh, t.relatedDept?.nameTh);
    let nextRecipients: string[] = [];
    let notifyTitle = 'มีสารบรรณรอท่านดำเนินการ';

    switch (dto.type) {
      case TicketActionType.FORWARD: {
        // ผู้ถือเรื่องเซ็นแล้วส่งต่อให้ใครก็ได้ / ปลัด (ส่งนายกตรงไม่ได้ — ต้องผ่านปลัด)
        if (step !== SarabanStep.PENDING_PERSON) throw new BadRequestException('ขั้นตอนนี้ส่งต่อแบบเลือกผู้รับไม่ได้');
        assertActor(user.id === t.currentHolderUserId);
        requireSig();
        if (!dto.toClerk && !dto.toUserId) throw new BadRequestException('กรุณาเลือกผู้รับ (คน/กอง) หรือส่งปลัด');
        if (dto.toClerk && dto.toUserId) throw new BadRequestException('เลือกผู้รับได้ทางเดียว — คน/กอง หรือ ปลัด');
        if (dto.deptRegNumber?.trim()) { t.deptRegNumber = dto.deptRegNumber.trim(); t.deptRegAt = new Date(); }
        this.pushStepSig(t, step, user.id);
        nextRecipients = await this.routeTo(t, user, step, { toUserId: dto.toUserId, toClerk: !!dto.toClerk, note: dto.note });
        break;
      }
      case TicketActionType.SIGN_SEND: {
        requireSig();
        if (step === SarabanStep.PENDING_CLERK) {
          // ปลัด — ใครก็ได้ที่มี role ปลัด · ส่งต่อได้ทางเดียวคือนายก
          assertActor(roles.includes('CLERK') || roles.includes('DEPUTY_CLERK'));
          this.pushStepSig(t, step, user.id);
          t.clerkSignedBy = user.id; t.clerkSignedAt = new Date();
          nextRecipients = await this.routeTo(t, user, step, { toMayor: true, note: dto.note });
        } else if (step === SarabanStep.PENDING_MAYOR) {
          assertActor(roles.includes('MAYOR') || roles.includes('DEPUTY_MAYOR'));
          this.pushStepSig(t, step, user.id);
          t.mayorSignedBy = user.id; t.mayorSignedAt = new Date();
          t.currentStep = SarabanStep.COMPLETED;
          t.currentHolderUserId = null;
          t.completedAt = new Date();
          nextRecipients = [t.createdBy, t.assignedHeadUserId].filter(Boolean) as string[];
          notifyTitle = 'สารบรรณเสร็จสิ้น (นายกลงนามปิดงานแล้ว)';
        } else {
          throw new BadRequestException('ขั้นตอนไม่ถูกต้องสำหรับการประทับเซ็น');
        }
        break;
      }
      default:
        throw new BadRequestException('ประเภทการดำเนินการไม่ถูกต้อง');
    }

    t.status = this.mapStepToStatus(t.currentStep);
    await this.ticketRepo.save(t);
    let action = 'ประทับเซ็น + ส่งดำเนินการ';
    if (t.currentStep === SarabanStep.COMPLETED) action = 'ลงนามปิดงาน';
    else if (t.currentStep === SarabanStep.PENDING_CLERK) action = 'ประทับเซ็น + ส่งถึงปลัด';
    else if (t.currentStep === SarabanStep.PENDING_MAYOR) action = 'ประทับเซ็น + ส่งถึงนายก';
    else if (t.currentStep === SarabanStep.PENDING_PERSON && t.currentHolderUserId) {
      const h = await this.userRepo.findOne({ where: { id: t.currentHolderUserId }, select: ['id', 'titleTh', 'fullNameTh'] });
      if (h) action = `ประทับเซ็น + ส่งถึง ${h.titleTh || ''}${h.fullNameTh}`;
    }
    await this.log(id, stepName, user.id, action, step, t.currentStep, dto.note, dto.signatureImage);
    await this.audit(user, dto.type.toUpperCase(), id, t.subject);
    if (nextRecipients.length) {
      const notifyType = t.currentStep === SarabanStep.COMPLETED ? 'ticket:completed' : 'ticket:step';
      await this.notify(user.organizationId, nextRecipients, notifyType,
        notifyTitle, `${t.ticketNumber} — ${t.subject}`, id);
    }
    return this.findOneV4(id, user);
  }

  // ─────────────────────────────────────────── ตีกลับ v4
  async returnV4(id: string, dto: ReturnV4Dto, user: AuthUser) {
    const t = await this.ticketRepo.findOne({
      where: { id, organizationId: user.organizationId },
      relations: ['ownerDept', 'relatedDept'],
    });
    if (!t) throw new NotFoundException('ไม่พบสารบรรณ');
    if (!t.currentStep) throw new BadRequestException('สารบรรณนี้ไม่ได้ใช้ workflow v4');
    if (t.currentStep === SarabanStep.COMPLETED) throw new BadRequestException('สารบรรณเสร็จสิ้นแล้ว ตีกลับไม่ได้');

    const fromStep = t.currentStep;
    // ตีกลับได้เฉพาะคนที่ถือเรื่องอยู่ (ปลัด/นายกในขั้นของตัวเอง) หรือผู้ดูแล
    const roles = user.roles || [];
    const isActor = fromStep === SarabanStep.PENDING_CLERK ? (roles.includes('CLERK') || roles.includes('DEPUTY_CLERK'))
      : fromStep === SarabanStep.PENDING_MAYOR ? (roles.includes('MAYOR') || roles.includes('DEPUTY_MAYOR'))
        : t.currentHolderUserId === user.id;
    if (!isActor && !isAdmin(user)) throw new ForbiddenException('ตีกลับได้เฉพาะผู้ที่ถือเรื่องอยู่ในขั้นนี้');

    const trail = Array.isArray(t.routeTrail) ? [...t.routeTrail] : [];
    let toStep: SarabanStep;
    let holder: string | null;
    let recips: string[];
    // ปลัด/นายก ตีกลับได้แค่ผู้ส่งก่อนหน้า — ผู้ถือเรื่องทั่วไปเลือกส่งกลับผู้ลงรับได้
    const toCreator = dto.toCreator && fromStep === SarabanStep.PENDING_PERSON;
    const last = toCreator ? null : trail.pop();
    if (!last || !last.fromUserId || last.fromStep === CREATED_HOP || toCreator) {
      // ทอดแรก (ผู้ลงรับส่งมา) หรือเลือกส่งกลับผู้ลงรับ
      toStep = SarabanStep.PENDING_PERSON;
      holder = t.createdBy;
      recips = [t.createdBy];
      if (toCreator) trail.length = 0;
    } else if (last.fromStep === SarabanStep.PENDING_CLERK) {
      toStep = SarabanStep.PENDING_CLERK; // นายกตีกลับ → ปลัด
      holder = null;
      recips = [last.fromUserId];
      t.clerkSignedBy = null as any; t.clerkSignedAt = null as any;
    } else {
      toStep = SarabanStep.PENDING_PERSON;
      holder = last.fromUserId;
      recips = [last.fromUserId];
    }
    t.routeTrail = trail;
    t.currentStep = toStep;
    t.currentHolderUserId = holder;
    t.status = this.mapStepToStatus(toStep);
    await this.ticketRepo.save(t);

    const stepName = this.stepLabel(fromStep, t.ownerDept?.nameTh, t.relatedDept?.nameTh);
    await this.log(id, stepName, user.id, 'ตีกลับ', fromStep, toStep, dto.note);
    await this.audit(user, 'RETURN', id, t.subject);
    recips = [...new Set(recips.filter(Boolean))];
    if (recips.length) {
      await this.notify(user.organizationId, recips, 'ticket:returned', 'สารบรรณถูกตีกลับให้ท่าน',
        `${t.ticketNumber} — ${t.subject}\nเหตุผล: ${dto.note}`, id);
    }
    return this.findOneV4(id, user);
  }

  /** ขอแก้ไขเอกสาร v4 — คนสร้างแก้ได้ทุกช่องจนกว่านายกปิด + แจ้งเตือนทุกคนที่ทำแล้ว */
  async editV4(id: string, dto: UpdateTicketV4Dto, user: AuthUser) {
    const t = await this.ticketRepo.findOne({ where: { id, organizationId: user.organizationId } });
    if (!t) throw new NotFoundException('ไม่พบสารบรรณ');
    if (!t.currentStep) throw new BadRequestException('สารบรรณนี้ไม่ได้ใช้ workflow v4');
    const canEdit = isPrivileged(user) || t.createdBy === user.id;
    if (!canEdit) throw new ForbiddenException('เฉพาะผู้ลงรับ (ผู้สร้าง) หรือผู้ดูแลเท่านั้นที่แก้ไขได้');
    if (t.currentStep === SarabanStep.COMPLETED) throw new BadRequestException('นายกลงนามปิดงานแล้ว แก้ไขไม่ได้');

    if (dto.subject !== undefined) t.subject = dto.subject;
    if (dto.externalDocNumber !== undefined) t.externalDocNumber = dto.externalDocNumber;
    if (dto.docDate !== undefined) t.docDate = dto.docDate ? new Date(dto.docDate) : null;
    if (dto.sourceOrg !== undefined) t.sourceOrg = dto.sourceOrg;
    if (dto.recipient !== undefined) t.recipient = dto.recipient;
    if (dto.body !== undefined) t.body = dto.body;
    if (dto.urgencyLevel !== undefined) t.urgencyLevel = dto.urgencyLevel;
    if (dto.confidentiality !== undefined) t.confidentiality = dto.confidentiality;
    if (dto.purposes !== undefined) t.purpose = dto.purposes?.length ? dto.purposes.join(', ') : null;
    if (dto.purposeOther !== undefined) t.purposeOther = dto.purposeOther;
    await this.ticketRepo.save(t);

    await this.log(id, 'แก้ไขเอกสาร', user.id, 'แก้ไข', t.currentStep, t.currentStep, null);
    await this.audit(user, 'EDIT', id, t.subject);
    // แจ้งเตือนทุกคนที่ทำแล้ว (มีใน stepSignatures) + ผู้ปฏิบัติปัจจุบัน
    const done = (t.stepSignatures || []).map((s) => s.userId);
    const recips = [...new Set([...done, t.assignedHeadUserId, t.ownerClerkUserId, t.relatedHeadUserId, t.relatedClerkUserId]
      .filter((u) => u && u !== user.id))] as string[];
    if (recips.length) {
      await this.notify(user.organizationId, recips, 'ticket:edited', 'มีการแก้ไขเอกสารสารบรรณที่ท่านเกี่ยวข้อง',
        `${t.ticketNumber} — ${t.subject}`, id);
    }
    return this.findOneV4(id, user);
  }

  /** บันทึกตำแหน่ง overlay (ตรา+ลายเซ็น) บน PDF — ผู้ที่เข้าถึงเรื่องได้ */
  async saveOverlayV4(id: string, layout: any, user: AuthUser) {
    const t = await this.ticketRepo.findOne({ where: { id, organizationId: user.organizationId } });
    if (!t) throw new NotFoundException('ไม่พบสารบรรณ');
    if (!this.canEditDoc(t, user)) throw new ForbiddenException('แก้เอกสารได้เฉพาะผู้ที่ถือเรื่องอยู่ในขั้นนี้');
    if (layout) assertLayout(layout);
    // ห้ามลบลายเซ็นของคนอื่น (หน้าเว็บกันไว้แล้ว — ตรวจซ้ำฝั่งเซิร์ฟเวอร์)
    const keep = new Set(signatureItems(layout).map((x) => x.id));
    const removed = signatureItems(t.overlayLayout).filter((x) => x.ownerId !== user.id && !keep.has(x.id));
    if (removed.length) throw new BadRequestException('ลบลายเซ็นของผู้อื่นไม่ได้');
    t.overlayLayout = layout ?? null;
    await this.ticketRepo.save(t);
    return { ok: true };
  }

  // ─────────────────────────────────────────── แก้ไขเอกสาร (ข้อมูลหนังสือ)
  /**
   * แก้ไขข้อมูลหนังสือ — เฉพาะผู้สร้าง/กองเจ้าของ/หัวหน้ากองที่เกี่ยว/admin
   * แก้ได้เฉพาะตอนยังไม่ปิดงาน/ยกเลิก · ไม่แตะเลขทะเบียน/สมุด/ทิศทาง/สถานะ/ลายเซ็น
   */
  async update(id: string, dto: UpdateTicketDto, user: AuthUser) {
    const ticket = await this.findOne(id, user); // บังคับสิทธิ์มองเห็น (รวมชั้นความลับ)
    // แก้ไขได้เฉพาะ "ผู้สร้าง / กองเจ้าของเรื่อง / ผู้ดูแล" เท่านั้น
    // กองอื่นที่แค่ได้รับมอบหมาย (ไม่ใช่เจ้าของเรื่อง) → แก้ตรงไม่ได้ ให้ใช้ "ร้องขอแก้ไข" แทน
    const canEdit = ticket.createdBy === user.id
      || ticket.ownerDeptId === user.departmentId
      || ticket.ownerDept?.headUserId === user.id;
    if (!canEdit && !isAdmin(user)) {
      throw new ForbiddenException('เฉพาะผู้สร้าง/กองเจ้าของเรื่อง/ผู้ดูแลเท่านั้นที่แก้ไขได้ — กองอื่นให้ใช้ "ร้องขอแก้ไข"');
    }
    if ([TicketStatus.COMPLETED, TicketStatus.CANCELLED].includes(ticket.status as TicketStatus)) {
      throw new BadRequestException('เรื่องที่เสร็จสิ้น/ยกเลิกแล้ว ไม่สามารถแก้ไขได้');
    }

    // ฟิลด์ที่อนุญาตให้แก้ (ไม่รวมเลขทะเบียน/สมุด/ทิศทาง/สถานะ/ลายเซ็น)
    const patch: any = {};
    const assign = (k: string, v: any) => { if (v !== undefined) patch[k] = v; };
    assign('subject', dto.subject);
    assign('body', dto.body);
    assign('externalDocNumber', dto.externalDocNumber);
    assign('sourceOrg', dto.sourceOrg);
    assign('senderName', dto.senderName);
    assign('senderPosition', dto.senderPosition);
    assign('recipient', dto.recipient);
    assign('keywords', dto.keywords);
    assign('docType', dto.docType);
    assign('purpose', dto.purpose);
    assign('purposeOther', dto.purposeOther);
    assign('refDocNumber', dto.refDocNumber);
    assign('refDocDetail', dto.refDocDetail);
    assign('urgencyLevel', dto.urgencyLevel);
    assign('confidentiality', dto.confidentiality);
    assign('note', dto.note);
    assign('responsibleUserId', dto.responsibleUserId);
    if (dto.enclosures !== undefined) patch.enclosures = dto.enclosures?.length ? dto.enclosures : null;
    if (dto.circularRecipients !== undefined) {
      patch.circularRecipients = ticket.isCircular && dto.circularRecipients?.length ? dto.circularRecipients : null;
    }
    if (dto.docDate !== undefined) patch.docDate = dto.docDate ? new Date(dto.docDate) : null;
    if (dto.sentDate !== undefined) patch.sentDate = dto.sentDate ? new Date(dto.sentDate) : null;
    if (dto.sentTime !== undefined) patch.sentTime = dto.sentTime || null;
    if (dto.dueDate !== undefined) patch.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.receivedDate !== undefined) patch.receivedDate = dto.receivedDate ? new Date(dto.receivedDate) : null;
    if (dto.receivedTime !== undefined) patch.receivedTime = dto.receivedTime || null;

    // sync การมอบหมาย (กอง + ผู้รับผิดชอบหลายคน) — เฉพาะช่วงก่อนเข้าสายเซ็น เพื่อกันกระทบ workflow/ลายเซ็น
    const canEditAssignment = [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.RETURNED].includes(ticket.status as TicketStatus);
    if (dto.departmentIds !== undefined && canEditAssignment) {
      const newDeptIds = [...new Set(dto.departmentIds)];
      if (newDeptIds.length === 0) throw new BadRequestException('ต้องมีกองที่มอบหมายอย่างน้อย 1 กอง');
      const depts = await this.deptRepo.find({ where: { id: In(newDeptIds), organizationId: user.organizationId } });
      if (depts.length !== newDeptIds.length) throw new BadRequestException('มีกองที่เลือกไม่ถูกต้อง');
      const assigneesMap = new Map<string, string[]>();
      for (const a of dto.assignees || []) if (newDeptIds.includes(a.departmentId)) assigneesMap.set(a.departmentId, [...new Set(a.userIds || [])]);
      const currentTds = await this.tdRepo.find({ where: { ticketId: id } });
      const byDept = new Map(currentTds.map((td) => [td.departmentId, td]));
      for (const deptId of newDeptIds) {
        const uids = assigneesMap.get(deptId) || [];
        const ex = byDept.get(deptId);
        if (ex) await this.tdRepo.update(ex.id, { assignedUserIds: uids.length ? uids : null, assignedUserId: uids[0] || ex.assignedUserId || null, isActive: true });
        else await this.tdRepo.save(this.tdRepo.create({ ticketId: id, departmentId: deptId, status: TicketDeptStatus.ASSIGNED, assignedUserId: uids[0] || null, assignedUserIds: uids.length ? uids : null }));
      }
      // ลบกองที่ถูกเอาออก — เฉพาะที่ยังไม่เซ็น (กันลบลายเซ็น/ประวัติ)
      for (const td of currentTds) if (!newDeptIds.includes(td.departmentId) && !td.signedAt) await this.tdRepo.delete(td.id);
      const firstAssigned = [...new Set([...assigneesMap.values()].flat())][0];
      if (firstAssigned) patch.responsibleUserId = firstAssigned;
    }

    await this.ticketRepo.update(id, patch);
    await this.log(id, 'แก้ไขเอกสาร', user.id, 'แก้ไขข้อมูลหนังสือ', ticket.status, ticket.status, dto.note);
    await this.audit(user, 'UPDATE', id, dto.subject || ticket.subject);
    return this.findOne(id, user);
  }

  // ─────────────────────────────────────────── รายการ (กรองตามสิทธิ์)
  async findAll(dto: TicketQueryDto, user: AuthUser) {
    const qb = buildVisibleQuery(this.ticketRepo, user);
    applyTicketFilters(qb, dto);
    qb.orderBy('t.createdAt', 'DESC').skip(dto.skip).take(dto.limit);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data, total, dto);
  }

  /** เงื่อนไข "เรื่องที่รอฉันดำเนินการอยู่ตอนนี้" (กองฉันต้องทำ / รอฉันเซ็น) — ใช้ทั้ง todo (บวก) และ doing (นิเสธ) */
  private waitingOnMeCond(user: AuthUser): { sql: string; params: Record<string, any> } {
    const roles = user.roles || [];
    // ไดนามิก: รอฉัน = ฉันเป็นผู้ถือเรื่อง · ปลัด/นายก (รวมรอง) ตามขั้น
    const parts: string[] = [`(t.current_step = :wmPerson AND t.current_holder_user_id = :wmMe)`];
    const params: Record<string, any> = { wmPerson: SarabanStep.PENDING_PERSON, wmMe: user.id };
    if (user.departmentId) {
      // สารบรรณเก่าที่ไม่ใช้ workflow v4 (current_step ว่าง) — คงกติกาเดิมตามกอง
      parts.push(`(t.current_step IS NULL AND t.status IN (:...wmDp) AND EXISTS (SELECT 1 FROM correspondence_ticket_departments td
        WHERE td.ticket_id = t.id AND td.department_id = :wmDept AND td.is_active = true AND td.status <> :wmSub))`);
      params.wmDp = [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.RETURNED];
      params.wmDept = user.departmentId;
      params.wmSub = TicketDeptStatus.SUBMITTED;
    }
    if (roles.includes('CLERK') || roles.includes('DEPUTY_CLERK')) { parts.push('t.status = :wmPc'); params.wmPc = TicketStatus.PENDING_CLERK; }
    if (roles.includes('MAYOR') || roles.includes('DEPUTY_MAYOR')) { parts.push('t.status = :wmPm'); params.wmPm = TicketStatus.PENDING_MAYOR; }
    return { sql: `(${parts.join(' OR ')})`, params };
  }

  /**
   * [v4] กล่องงานตามบทบาทของเรื่องต่อผู้ใช้ (หน้ารายการสารบรรณ 4 แท็บ):
   *  - todo    = รอฉันดำเนินการ/เซ็น + ตีกลับถึงฉัน (พอทำแล้วหลุด)
   *  - doing   = ฉันเคยดำเนินการไปแล้ว + ยังไม่เสร็จ + ไม่ได้รอฉันอยู่
   *  - done    = เสร็จสิ้น + ฉันเกี่ยวข้อง (สร้าง/เคยทำ/กองฉัน)
   *  - created = ฉันเป็นคนสร้าง (ลงรับ)
   * แนบ isRead (อ่านแล้ว/ยังไม่อ่าน) ต่อผู้ใช้
   */
  async inbox(user: AuthUser, box: string, dto: TicketQueryDto) {
    const me = user.id;
    const qb = buildVisibleQuery(this.ticketRepo, user);
    const actedSql = `EXISTS (SELECT 1 FROM document_workflow_logs w
      WHERE w.doc_type = 'TICKET' AND w.document_id = t.id AND w.actor_id = :me AND w.action <> 'สร้าง')`;
    const wm = this.waitingOnMeCond(user);
    const closed = [TicketStatus.COMPLETED, TicketStatus.CANCELLED];

    if (box === 'created') {
      qb.andWhere('t.created_by = :me', { me });
    } else if (box === 'done') {
      qb.andWhere('t.status = :doneSt', { doneSt: TicketStatus.COMPLETED });
      qb.andWhere(new Brackets((w) => {
        w.where('t.created_by = :me', { me }).orWhere(actedSql, { me });
        if (user.departmentId) {
          w.orWhere(
            `(t.owner_dept_id = :doneDept OR EXISTS (SELECT 1 FROM correspondence_ticket_departments td3
              WHERE td3.ticket_id = t.id AND td3.department_id = :doneDept))`,
            { doneDept: user.departmentId },
          );
        }
      }));
    } else if (box === 'doing') {
      qb.andWhere('t.status NOT IN (:...closed)', { closed })
        .andWhere(actedSql, { me })
        .andWhere(`NOT ${wm.sql}`, wm.params);
    } else { // todo (default)
      qb.andWhere('t.status NOT IN (:...closed)', { closed })
        .andWhere(wm.sql, wm.params);
    }

    applyTicketFilters(qb, dto);
    qb.orderBy('t.createdAt', 'DESC').skip(dto.skip).take(dto.limit);
    const [data, total] = await qb.getManyAndCount();

    // แนบสถานะอ่านแล้ว (เฉพาะเรื่องในหน้านี้)
    const ids = data.map((t) => t.id);
    const readRows: { ticket_id: string }[] = ids.length
      ? await this.ticketRepo.query(
          `SELECT ticket_id FROM correspondence_ticket_reads WHERE user_id = $1 AND ticket_id = ANY($2::uuid[])`,
          [me, ids],
        )
      : [];
    const readSet = new Set(readRows.map((r) => r.ticket_id));
    const items = data.map((t) => ({ ...t, isRead: readSet.has(t.id) }));
    return paginate(items, total, dto);
  }

  /** บันทึกว่าผู้ใช้เปิดอ่านเรื่องนี้แล้ว (idempotent) */
  async markRead(ticketId: string, user: AuthUser) {
    await this.ticketRepo.query(
      `INSERT INTO correspondence_ticket_reads (user_id, ticket_id) VALUES ($1, $2)
       ON CONFLICT (user_id, ticket_id) DO NOTHING`,
      [user.id, ticketId],
    );
  }

  /**
   * ค่าที่เคยใช้ในช่อง "จาก"(sourceOrg) และ "เรียน"(recipient) — สำหรับ autocomplete กรอกเร็ว
   * (อิง brm preset ช่องจาก/เรียน) — คืนค่าไม่ซ้ำ เรียงตามที่ใช้บ่อย/ล่าสุด
   */
  async fieldSuggestions(user: AuthUser) {
    const distinct = async (col: 'source_org' | 'recipient') => {
      const rows = await this.ticketRepo.query(
        `SELECT ${col} AS v FROM correspondence_tickets
         WHERE organization_id = $1 AND ${col} IS NOT NULL AND ${col} <> '' AND deleted_at IS NULL
         GROUP BY ${col} ORDER BY COUNT(*) DESC, MAX(created_at) DESC LIMIT 100`,
        [user.organizationId],
      );
      return rows.map((r: any) => r.v as string);
    };
    const [sources, recipients] = await Promise.all([distinct('source_org'), distinct('recipient')]);
    return { sources, recipients };
  }


  /** C1 — งานที่รอ "ฉัน" ดำเนินการ (กองฉันต้องทำ / รอฉันเซ็น) */
  async myTasks(user: AuthUser) {
    const qb = this.ticketRepo.createQueryBuilder('t')
      .leftJoinAndSelect('t.ownerDept', 'ownerDept')
      .where('t.organization_id = :org', { org: user.organizationId })
      .andWhere('t.status NOT IN (:...done)', { done: [TicketStatus.COMPLETED, TicketStatus.CANCELLED] });

    // งานที่รอฉัน — เงื่อนไขเดียวกับกล่องงาน "รอฉัน" (ผู้ถือเรื่อง / ปลัด / นายก)
    const wm = this.waitingOnMeCond(user);
    qb.andWhere(wm.sql, wm.params);

    applyConfidentiality(qb, user);
    qb.orderBy('t.dueDate', 'ASC', 'NULLS LAST').addOrderBy('t.createdAt', 'DESC').take(50);
    return qb.getMany();
  }

  // ─────────────────────────────────────────── รายละเอียด
  async findOne(id: string, user: AuthUser) {
    const ticket = await this.ticketRepo.findOne({
      where: { id, organizationId: user.organizationId },
      relations: ['organization', 'ownerDept', 'responsibleUser', 'creator', 'clerkSigner', 'mayorSigner', 'receiver',
        'ticketDepartments', 'ticketDepartments.department', 'ticketDepartments.assignedUser', 'ticketDepartments.signer'],
    });
    if (!ticket) throw new NotFoundException('ไม่พบสารบรรณ');

    // ตรวจสิทธิ์การมองเห็น
    if (!isPrivileged(user)) {
      const inMyDept = ticket.ownerDeptId === user.departmentId
        || ticket.ticketDepartments?.some((td) => td.departmentId === user.departmentId);
      if (ticket.createdBy !== user.id && !inMyDept && ticket.currentHolderUserId !== user.id) {
        throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงสารบรรณนี้');
      }
      // เรื่องชั้นความลับ — เฉพาะผู้เกี่ยวข้องโดยตรงเท่านั้น
      if (!canSeeConfidential(ticket, user)) {
        throw new ForbiddenException('เอกสารชั้นความลับ — ไม่มีสิทธิ์เข้าถึง');
      }
    }

    const [timeline, attachments] = await Promise.all([
      this.workflowRepo.find({ where: { documentId: id, docType: 'TICKET' }, relations: ['actor'], order: { actedAt: 'ASC' } }),
      this.storage.getFilesByRef('ticket', id),
    ]);

    // resolve ผู้รับผิดชอบหลายคนต่อกอง (assignedUserIds) → assignedUsers สำหรับหน้ารายละเอียด
    const allAssignedIds = [...new Set((ticket.ticketDepartments || []).flatMap((td) => td.assignedUserIds || []))];
    if (allAssignedIds.length) {
      const users = await this.userRepo.find({
        where: { id: In(allAssignedIds) },
        select: ['id', 'titleTh', 'fullNameTh', 'positionName', 'departmentId'],
      });
      const byId = new Map(users.map((u) => [u.id, u]));
      for (const td of ticket.ticketDepartments || []) {
        td.assignedUsers = ((td.assignedUserIds || []).map((uid) => byId.get(uid)).filter(Boolean)) as User[];
      }
    }

    // ฟิลด์อ่อนไหวของ user (passwordHash ฯลฯ) ถูกกันที่ entity ด้วย select:false แล้ว
    return { ...ticket, timeline, attachments };
  }

  /** ประวัติการลงนามทั้งหมด (ลายเซ็นที่วาดสด) — สำหรับโมดูลลายเซ็นดิจิทัล */
  async getSigningHistory(orgId: string) {
    return this.workflowRepo.query(
      `SELECT w.id, w.action, w.acted_at AS "signedAt", w.signature_image AS "signatureImage",
              t.id AS "ticketId", t.ticket_number AS "ticketNumber", t.subject,
              u.full_name_th AS "actorName", u.position_name AS "actorPosition"
       FROM document_workflow_logs w
       JOIN correspondence_tickets t ON t.id = w.document_id AND t.organization_id = $1
       LEFT JOIN users u ON u.id = w.actor_id
       WHERE w.doc_type = 'TICKET' AND w.signature_image IS NOT NULL
       ORDER BY w.acted_at DESC LIMIT 200`,
      [orgId],
    );
  }

  /** ประวัติการลงนามของ "ฉัน" — โปรไฟล์ (filter actor_id) */
  async getMySigningHistory(orgId: string, userId: string) {
    return this.workflowRepo.query(
      `SELECT w.id, w.action, w.acted_at AS "signedAt",
              t.id AS "ticketId", t.ticket_number AS "ticketNumber", t.subject
       FROM document_workflow_logs w
       JOIN correspondence_tickets t ON t.id = w.document_id AND t.organization_id = $1
       WHERE w.doc_type = 'TICKET' AND w.signature_image IS NOT NULL AND w.actor_id = $2
       ORDER BY w.acted_at DESC LIMIT 30`,
      [orgId, userId],
    );
  }

  async getTimeline(id: string) {
    return this.workflowRepo.find({
      where: { documentId: id, docType: 'TICKET' },
      relations: ['actor'], order: { actedAt: 'ASC' },
    });
  }

  async getAttachments(id: string, user: AuthUser) {
    return this.storage.getFilesByRef('ticket', id, user);
  }

  // ─────────────────────────────────────────── ข้อ 6: หนังสือตีกลับ (inbox แยก)
  /** กล่องหนังสือตีกลับ — แยกตามทิศทาง (รับ/ส่ง) ตามที่ brm ทำ */
  async returnedInbox(user: AuthUser) {
    const qb = buildVisibleQuery(this.ticketRepo, user)
      .andWhere('t.status = :st', { st: TicketStatus.RETURNED })
      .orderBy('t.updatedAt', 'DESC')
      .take(200);
    const rows = await qb.getMany();
    const receive = rows.filter((r) => r.direction === TicketDirection.RECEIVE);
    const send = rows.filter((r) => r.direction === TicketDirection.SEND);
    return { total: rows.length, receive, send };
  }

  async remove(id: string, user: AuthUser) {
    const ticket = await this.loadTicket(id, user.organizationId);
    if (!isAdmin(user) && ticket.createdBy !== user.id) {
      throw new ForbiddenException('เฉพาะผู้สร้างหรือผู้ดูแลระบบเท่านั้นที่ลบได้');
    }
    await this.ticketRepo.softDelete(id);
    await this.audit(user, 'DELETE', id, ticket.subject);
    return { message: 'ลบสารบรรณสำเร็จ' };
  }

  private async loadTicket(id: string, orgId: string): Promise<CorrespondenceTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id, organizationId: orgId } });
    if (!ticket) throw new NotFoundException('ไม่พบสารบรรณ');
    return ticket;
  }
}
