import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { IncomingDocument } from '../../database/entities/incoming-document.entity';
import { OutgoingDocument } from '../../database/entities/outgoing-document.entity';
import { DocumentWorkflowLog } from '../../database/entities/document-workflow-log.entity';
import { DocumentNumberSequence } from '../../database/entities/document-number-sequence.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import {
  CreateIncomingDocDto, AssignDocDto, ActionNoteDto,
  CreateOutgoingDocDto, CorrespondenceQueryDto,
} from './dto/correspondence.dto';
import { paginate } from '../../common/dto/pagination.dto';
import { getCurrentThaiYear } from '../../common/utils/date.util';
import { assertCanModify } from '../../common/utils/ownership.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CorrespondenceService {
  constructor(
    @InjectRepository(IncomingDocument) private incomingRepo: Repository<IncomingDocument>,
    @InjectRepository(OutgoingDocument) private outgoingRepo: Repository<OutgoingDocument>,
    @InjectRepository(DocumentWorkflowLog) private workflowRepo: Repository<DocumentWorkflowLog>,
    @InjectRepository(DocumentNumberSequence) private seqRepo: Repository<DocumentNumberSequence>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private notificationsService: NotificationsService,
  ) {}

  async findAllIncoming(orgId: string, dto: CorrespondenceQueryDto, userId: string) {
    const base: FindOptionsWhere<IncomingDocument> = { organizationId: orgId };
    if (dto.status) base.status = dto.status;
    if (dto.urgencyLevel) base.urgencyLevel = dto.urgencyLevel;
    if (dto.deptId) base.receiverDeptId = dto.deptId;

    const where: FindOptionsWhere<IncomingDocument>[] | FindOptionsWhere<IncomingDocument> = dto.search
      ? [
          { ...base, subject: ILike(`%${dto.search}%`) },
          { ...base, receiveNumber: ILike(`%${dto.search}%`) },
          { ...base, senderOrg: ILike(`%${dto.search}%`) },
        ]
      : base;

    const [data, total] = await this.incomingRepo.findAndCount({
      where,
      relations: ['receiverDept'],
      skip: dto.skip,
      take: dto.limit,
      order: { receivedAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async findOneIncoming(id: string, orgId: string) {
    const doc = await this.incomingRepo.findOne({
      where: { id, organizationId: orgId },
      relations: ['creator', 'receiverDept', 'assignedUser', 'organization'],
    });
    if (!doc) throw new NotFoundException('ไม่พบหนังสือเข้า');
    return doc;
  }

  async createIncoming(dto: CreateIncomingDocDto, orgId: string, userId: string) {
    const receiveNumber = await this.generateDocNumber(orgId, 'INCOMING');
    const doc = this.incomingRepo.create({
      ...dto,
      organizationId: orgId,
      receiveNumber,
      receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
      createdBy: userId,
      status: 'รับแล้ว',
    });
    const saved = await this.incomingRepo.save(doc);

    await this.workflowRepo.save({
      docType: 'INCOMING',
      documentId: saved.id,
      stepNumber: 1,
      stepName: 'รับหนังสือ',
      actorId: userId,
      action: 'รับ',
      toStatus: 'รับแล้ว',
    });

    await this.audit(orgId, userId, 'CREATE', 'correspondence', saved.id, saved.subject);
    return saved;
  }

  async assignIncoming(id: string, dto: AssignDocDto, orgId: string, userId: string) {
    const doc = await this.findOneIncoming(id, orgId);
    const fromStatus = doc.status;

    await this.incomingRepo.update(id, {
      assignedTo: dto.assignedTo,
      actionNote: dto.note,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      status: 'ดำเนินการ',
    });

    await this.workflowRepo.save({
      docType: 'INCOMING', documentId: id,
      stepNumber: doc.currentStep + 1, stepName: 'มอบหมายงาน',
      actorId: userId, action: 'ส่งต่อ',
      fromStatus, toStatus: 'ดำเนินการ', note: dto.note,
    });

    // แจ้งเตือนผู้ได้รับมอบหมาย
    if (dto.assignedTo && dto.assignedTo !== userId) {
      await this.notificationsService.createNotification({
        organizationId: orgId,
        recipientId: dto.assignedTo,
        type: 'correspondence:assigned',
        title: 'คุณได้รับมอบหมายหนังสือ',
        body: `${doc.receiveNumber} — ${doc.subject}`,
        refType: 'incoming_document', refId: id,
        actionUrl: `/correspondence/${id}`,
      });
    }

    return { message: 'มอบหมายงานสำเร็จ' };
  }

  async addActionNote(id: string, dto: ActionNoteDto, orgId: string, userId: string) {
    const doc = await this.findOneIncoming(id, orgId);
    const fromStatus = doc.status;

    await this.incomingRepo.update(id, {
      actionNote: dto.actionNote,
      assignedTo: dto.assignedTo || doc.assignedTo,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : doc.dueDate,
      status: 'ดำเนินการ',
    });

    await this.workflowRepo.save({
      docType: 'INCOMING', documentId: id,
      stepNumber: doc.currentStep + 1, stepName: 'สั่งการ',
      actorId: userId, action: 'สั่งการ',
      fromStatus, toStatus: 'ดำเนินการ', note: dto.actionNote,
    });

    // แจ้งเตือนผู้รับผิดชอบ (ถ้ามีการระบุผู้รับมอบหมาย)
    const assignee = dto.assignedTo || doc.assignedTo;
    if (assignee && assignee !== userId) {
      await this.notificationsService.createNotification({
        organizationId: orgId,
        recipientId: assignee,
        type: 'correspondence:assigned',
        title: 'มีคำสั่งการในหนังสือที่คุณรับผิดชอบ',
        body: `${doc.receiveNumber} — ${doc.subject}`,
        refType: 'incoming_document', refId: id,
        actionUrl: `/correspondence/${id}`,
      });
    }

    return { message: 'บันทึกคำสั่งการสำเร็จ' };
  }

  async closeIncoming(id: string, orgId: string, userId: string, note?: string) {
    const doc = await this.findOneIncoming(id, orgId);

    await this.incomingRepo.update(id, {
      status: 'เสร็จสิ้น',
      completedAt: new Date(),
    });

    await this.workflowRepo.save({
      docType: 'INCOMING', documentId: id,
      stepNumber: doc.currentStep + 1, stepName: 'ปิดงาน',
      actorId: userId, action: 'ปิด',
      fromStatus: doc.status, toStatus: 'เสร็จสิ้น', note,
    });

    return { message: 'ปิดงานสำเร็จ' };
  }

  async removeIncoming(id: string, orgId: string, user: any) {
    const doc = await this.findOneIncoming(id, orgId);
    assertCanModify(doc, user, 'correspondence:delete:IncomingDocument');
    await this.incomingRepo.softDelete(id);
    await this.audit(orgId, user.id, 'DELETE', 'correspondence', id, doc.subject);
    return { message: 'ลบหนังสือเข้าสำเร็จ' };
  }

  async removeOutgoing(id: string, orgId: string, user: any) {
    const doc = await this.findOneOutgoing(id, orgId);
    assertCanModify(doc, user, 'correspondence:delete:OutgoingDocument');
    await this.outgoingRepo.softDelete(id);
    await this.audit(orgId, user.id, 'DELETE', 'correspondence', id, doc.subject);
    return { message: 'ลบหนังสือส่งสำเร็จ' };
  }

  async getWorkflowHistory(id: string, docType: string) {
    return this.workflowRepo.find({
      where: { documentId: id, docType },
      relations: ['actor'],
      order: { actedAt: 'ASC' },
    });
  }

  async getStats(orgId: string) {
    const [total, pending, inProgress, completed] = await Promise.all([
      this.incomingRepo.count({ where: { organizationId: orgId } }),
      this.incomingRepo.count({ where: { organizationId: orgId, status: 'รอรับ' } }),
      this.incomingRepo.count({ where: { organizationId: orgId, status: 'ดำเนินการ' } }),
      this.incomingRepo.count({ where: { organizationId: orgId, status: 'เสร็จสิ้น' } }),
    ]);
    return { total, pending, inProgress, completed };
  }

  async findAllOutgoing(orgId: string, dto: CorrespondenceQueryDto) {
    const base: FindOptionsWhere<OutgoingDocument> = { organizationId: orgId };
    if (dto.status) base.status = dto.status;

    const where: FindOptionsWhere<OutgoingDocument>[] | FindOptionsWhere<OutgoingDocument> = dto.search
      ? [
          { ...base, subject: ILike(`%${dto.search}%`) },
          { ...base, docNumber: ILike(`%${dto.search}%`) },
          { ...base, recipientName: ILike(`%${dto.search}%`) },
        ]
      : base;

    const [data, total] = await this.outgoingRepo.findAndCount({
      where,
      relations: ['department'],
      skip: dto.skip,
      take: dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async findOneOutgoing(id: string, orgId: string) {
    const doc = await this.outgoingRepo.findOne({
      where: { id, organizationId: orgId },
      relations: ['department'],
    });
    if (!doc) throw new NotFoundException('ไม่พบหนังสือส่ง');
    return doc;
  }

  async createOutgoing(dto: CreateOutgoingDocDto, orgId: string, userId: string) {
    const docNumber = await this.generateDocNumber(orgId, 'OUTGOING');
    const doc = this.outgoingRepo.create({
      ...dto,
      organizationId: orgId,
      docNumber,
      docDate: new Date(),
      createdBy: userId,
    });
    const saved = await this.outgoingRepo.save(doc);
    await this.audit(orgId, userId, 'CREATE', 'correspondence', saved.id, saved.subject);
    return saved;
  }

  async sendOutgoing(id: string, orgId: string, userId: string) {
    const doc = await this.outgoingRepo.findOne({ where: { id, organizationId: orgId } });
    if (!doc) throw new NotFoundException('ไม่พบหนังสือส่ง');
    await this.outgoingRepo.update(id, { status: 'ส่งแล้ว' });
    return { message: 'ส่งหนังสือสำเร็จ' };
  }

  private async generateDocNumber(orgId: string, docType: string): Promise<string> {
    const year = getCurrentThaiYear();
    // จองเลขแบบ atomic (INSERT ... ON CONFLICT ... +1 RETURNING) — กัน read-modify-write
    // race ที่ทำให้เลขรับ/ส่งซ้ำเมื่อสร้างพร้อมกัน
    const rows = await this.seqRepo.query(
      `INSERT INTO document_number_sequences (organization_id, doc_type, year, current_number)
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (organization_id, doc_type, year)
       DO UPDATE SET current_number = document_number_sequences.current_number + 1, updated_at = NOW()
       RETURNING current_number`,
      [orgId, docType, year],
    );
    const newNumber = rows[0].current_number as number;
    const prefix = docType === 'INCOMING' ? `รับ ${year}/` : `ส่ง ${year}/`;
    return `${prefix}${String(newNumber).padStart(4, '0')}`;
  }

  /** บันทึกประวัติกิจกรรม — ต้องใส่ organizationId เสมอ ไม่งั้นไม่โผล่ในหน้าประวัติกิจกรรม (ดู audit.service.findAll) */
  private async audit(orgId: string, userId: string, action: string, module: string, resourceId: string, title: string) {
    await this.auditRepo.save({
      organizationId: orgId, userId, action, module, resourceType: 'document', resourceId, resourceTitle: title,
    });
  }
}
