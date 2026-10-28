import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import { LeaveRequest } from '../../database/entities/leave-request.entity';
import { LeaveApprovalLog } from '../../database/entities/leave-approval-log.entity';
import { LeaveQuota } from '../../database/entities/leave-quota.entity';
import { LeaveType } from '../../database/entities/leave-type.entity';
import { Employee } from '../../database/entities/employee.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { getCurrentThaiYear } from '../../common/utils/date.util';
import { assertCanModify } from '../../common/utils/ownership.util';
import { SequenceService } from '../../common/services/sequence.service';

@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveRequest) private requestRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveApprovalLog) private logRepo: Repository<LeaveApprovalLog>,
    @InjectRepository(LeaveQuota) private quotaRepo: Repository<LeaveQuota>,
    @InjectRepository(LeaveType) private typeRepo: Repository<LeaveType>,
    @InjectRepository(Employee) private employeeRepo: Repository<Employee>,
    private notificationsService: NotificationsService,
    private sequences: SequenceService,
  ) {}

  async findAll(orgId: string, dto: PaginationDto & { status?: string }, userId: string, roles: string[]) {
    const isManager = roles.some(r => ['MAYOR', 'CLERK', 'ADMIN', 'SECTION_HEAD', 'DIRECTOR', 'SUPER_ADMIN'].includes(r));
    const base: FindOptionsWhere<LeaveRequest> = { organizationId: orgId };
    if (dto.status) base.status = dto.status;

    if (!isManager) {
      const emp = await this.employeeRepo.findOne({ where: { userId } });
      if (emp) base.employeeId = emp.id;
      else return paginate([], 0, dto);
    }

    const [data, total] = await this.requestRepo.findAndCount({
      where: base,
      relations: ['employee', 'leaveType'],
      skip: dto.skip,
      take: dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async findMyRequests(userId: string, dto: PaginationDto) {
    const emp = await this.employeeRepo.findOne({ where: { userId } });
    if (!emp) return paginate([], 0, dto);

    const [data, total] = await this.requestRepo.findAndCount({
      where: { employeeId: emp.id },
      relations: ['leaveType'],
      skip: dto.skip,
      take: dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async findOne(id: string, orgId: string) {
    const req = await this.requestRepo.findOne({
      where: { id, organizationId: orgId },
      relations: ['employee', 'leaveType', 'currentApprover', 'delegate'],
    });
    if (!req) throw new NotFoundException('ไม่พบคำขอลา');
    return req;
  }

  async createRequest(dto: any, orgId: string, userId: string) {
    const emp = await this.employeeRepo.findOne({ where: { userId, organizationId: orgId } });
    if (!emp) throw new NotFoundException('ไม่พบข้อมูลพนักงาน');

    const year = getCurrentThaiYear();
    const seq = await this.sequences.next(orgId, 'LEAVE', { table: 'leave_requests', column: 'request_number' });
    const requestNumber = `LV-${year}-${String(seq).padStart(5, '0')}`;

    // การลาไม่ต้องรออนุมัติ / ไม่หักโควตา — ผู้ลาบันทึกเข้าระบบแล้วมีผลทันที
    // (ในทางปฏิบัติผู้ลาแจ้งหัวหน้าทางโทร/ไลน์และตกลงกันเองอยู่แล้ว)
    const now = new Date();
    // รับเฉพาะฟิลด์ที่ผู้ใช้กรอกได้ (allowlist) — กัน mass assignment ผ่าน ...dto
    // (controller รับ @Body() dto: any ไม่ผ่าน class-validator เช่น inject id ทับ record คนอื่น)
    const saved = await this.requestRepo.save({
      leaveTypeId: dto.leaveTypeId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      totalDays: dto.totalDays,
      reason: dto.reason,
      contactDuring: dto.contactDuring ?? null,
      delegateId: dto.delegateId ?? null,
      employeeId: emp.id,
      organizationId: orgId,
      requestNumber,
      status: 'อนุมัติแล้ว',
      submittedAt: now,
      approvedAt: now,
    });

    // แจ้งเตือนหัวหน้าหน่วยงานเพื่อทราบ (ไม่ต้องอนุมัติ)
    try {
      if (emp.departmentId) {
        const rows = await this.requestRepo.manager.query(
          'SELECT head_user_id FROM departments WHERE id = $1', [emp.departmentId],
        );
        const headUserId = rows?.[0]?.head_user_id;
        if (headUserId && headUserId !== userId) {
          await this.notificationsService.createNotification({
            organizationId: orgId,
            recipientId: headUserId,
            type: 'leave:recorded',
            title: 'มีการบันทึกการลา',
            body: `${emp.firstNameTh} ${emp.lastNameTh} ลา ${dto.totalDays} วัน`,
            refType: 'leave_request', refId: saved.id,
            actionUrl: `/leave/${saved.id}`,
          });
        }
      }
    } catch {}

    return saved;
  }

  async submit(id: string, orgId: string, userId: string) {
    const req = await this.findOne(id, orgId);
    if (req.status !== 'รอการอนุมัติ') throw new BadRequestException('ไม่สามารถส่งคำขอนี้ได้');

    await this.requestRepo.update(id, { submittedAt: new Date(), status: 'อยู่ระหว่างพิจารณา' });
    return { message: 'ส่งคำขอลาสำเร็จ' };
  }

  async approve(id: string, orgId: string, userId: string, comment?: string) {
    const req = await this.findOne(id, orgId);
    // Rework 2.1: การลาอนุมัติทันทีตั้งแต่สร้าง — กันหักโควตา/บันทึกซ้ำ
    if (req.status === 'อนุมัติแล้ว') {
      return { message: 'คำขอลานี้ได้รับการอนุมัติแล้ว' };
    }
    await this.requestRepo.update(id, { status: 'อนุมัติแล้ว', approvedAt: new Date() });

    await this.logRepo.save({
      requestId: id, approverId: userId, level: 1,
      levelName: 'ผู้มีอำนาจอนุมัติ', action: 'อนุมัติ', comment,
    });

    // แจ้งผลการอนุมัติให้พนักงาน
    if (req.employee?.userId) {
      await this.notificationsService.createNotification({
        organizationId: orgId,
        recipientId: req.employee.userId,
        type: 'leave:result',
        title: 'คำขอลาได้รับการอนุมัติ',
        body: `ใบลา ${req.requestNumber} ได้รับการอนุมัติแล้ว`,
        refType: 'leave_request', refId: id,
        actionUrl: `/leave/${id}`,
      });
    }

    return { message: 'อนุมัติคำขอลาสำเร็จ' };
  }

  async reject(id: string, orgId: string, userId: string, comment: string) {
    const req = await this.findOne(id, orgId);
    if (['อนุมัติแล้ว', 'ไม่อนุมัติ', 'ยกเลิก'].includes(req.status)) {
      throw new BadRequestException('คำขอลานี้ดำเนินการเสร็จสิ้นแล้ว ไม่สามารถเปลี่ยนสถานะได้');
    }
    await this.requestRepo.update(id, { status: 'ไม่อนุมัติ' });
    await this.logRepo.save({ requestId: id, approverId: userId, level: 1, levelName: 'ผู้มีอำนาจอนุมัติ', action: 'ไม่อนุมัติ', comment });

    // แจ้งผลให้พนักงาน
    if (req.employee?.userId) {
      await this.notificationsService.createNotification({
        organizationId: orgId,
        recipientId: req.employee.userId,
        type: 'leave:result',
        title: 'คำขอลาไม่ได้รับการอนุมัติ',
        body: comment ? `ใบลา ${req.requestNumber}: ${comment}` : `ใบลา ${req.requestNumber} ไม่ได้รับการอนุมัติ`,
        refType: 'leave_request', refId: id,
        actionUrl: `/leave/${id}`,
      });
    }
    return { message: 'ไม่อนุมัติคำขอลา' };
  }

  async cancel(id: string, orgId: string, userId: string) {
    const req = await this.findOne(id, orgId);
    if (['อนุมัติแล้ว', 'ไม่อนุมัติ'].includes(req.status)) {
      throw new BadRequestException('ไม่สามารถยกเลิกคำขอที่ดำเนินการแล้ว');
    }
    await this.requestRepo.update(id, { status: 'ยกเลิก' });
    return { message: 'ยกเลิกคำขอลาสำเร็จ' };
  }

  async remove(id: string, orgId: string, user: any) {
    const req = await this.findOne(id, orgId);
    // เจ้าของใบลา (พนักงานผู้ยื่น) หรือผู้ดูแลระบบ ลบได้
    assertCanModify({ createdBy: req.employee?.userId }, user, 'leave:delete:LeaveRequest');

    await this.requestRepo.manager.query('DELETE FROM leave_approval_logs WHERE request_id = $1', [id]);
    await this.requestRepo.delete(id);
    return { message: 'ลบคำขอลาสำเร็จ' };
  }

  async getMyQuotas(userId: string, orgId: string) {
    const emp = await this.employeeRepo.findOne({ where: { userId, organizationId: orgId } });
    if (!emp) return [];

    const year = getCurrentThaiYear();
    return this.quotaRepo.find({
      where: { employeeId: emp.id, year },
      relations: ['leaveType'],
    });
  }

  async getLeaveTypes(orgId: string) {
    return this.typeRepo.find({
      where: [{ organizationId: orgId, isActive: true }, { organizationId: null, isActive: true }],
    });
  }
}
