import { Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { IncomingDocument } from '../../database/entities/incoming-document.entity';
import { ApprovalRequest, ApprovalStatus } from '../../database/entities/approval-request.entity';
import { LeaveRequest } from '../../database/entities/leave-request.entity';
import { Complaint } from '../../database/entities/complaint.entity';
import { Meeting } from '../../database/entities/meeting.entity';
import { Budget } from '../../database/entities/budget.entity';
import { Project } from '../../database/entities/project.entity';
import { WelfareRecipient } from '../../database/entities/welfare.entity';
import { getCurrentThaiYear } from '../../common/utils/date.util';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(IncomingDocument) private incomingRepo: Repository<IncomingDocument>,
    @InjectRepository(ApprovalRequest) private approvalRepo: Repository<ApprovalRequest>,
    @InjectRepository(LeaveRequest) private leaveRepo: Repository<LeaveRequest>,
    @InjectRepository(Complaint) private complaintRepo: Repository<Complaint>,
    @InjectRepository(Meeting) private meetingRepo: Repository<Meeting>,
    @InjectRepository(Budget) private budgetRepo: Repository<Budget>,
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(WelfareRecipient) private welfareRepo: Repository<WelfareRecipient>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async getSummary(orgId: string, userId: string, roles: string[]) {
    const [
      pendingDocuments, pendingApprovals, pendingLeave,
      openComplaints, upcomingMeetings,
    ] = await Promise.all([
      this.incomingRepo.count({ where: { organizationId: orgId, status: 'รอรับ' } }),
      this.approvalRepo.count({ where: { organizationId: orgId, currentApproverId: userId } }),
      this.leaveRepo.count({ where: { organizationId: orgId, status: In(['รอการอนุมัติ', 'อยู่ระหว่างพิจารณา']) } }),
      this.complaintRepo.count({ where: { organizationId: orgId, status: 'รับเรื่องแล้ว' } }),
      this.meetingRepo.count({ where: { organizationId: orgId, status: 'กำหนดการ' } }),
    ]);

    const year = getCurrentThaiYear();
    const budgets = await this.budgetRepo.find({ where: { organizationId: orgId, fiscalYear: year } });
    const totalBudget = budgets.reduce((s, b) => s + Number(b.allocatedAmount), 0);
    const usedBudget = budgets.reduce((s, b) => s + Number(b.usedAmount), 0);
    const budgetUsagePct = totalBudget > 0 ? Math.round((usedBudget / totalBudget) * 100) : 0;

    const activeProjects = await this.projectRepo.count({ where: { organizationId: orgId, fiscalYear: year, status: 'ดำเนินการ' } });
    const welfareActive = await this.welfareRepo.count({ where: { organizationId: orgId, status: 'ใช้งาน' } });

    return {
      pendingDocuments, pendingApprovals, pendingLeave, openComplaints, upcomingMeetings,
      totalBudget, usedBudget, budgetUsagePct, activeProjects, welfareActive,
    };
  }

  async getChartData(orgId: string) {
    const [monthlyDocs, complaintsByStatus, approvalsByStatus, leaveByType] = await Promise.all([
      // หนังสือเข้าราย 6 เดือน
      this.dataSource.query(`
        SELECT TO_CHAR(DATE_TRUNC('month', received_at), 'YYYY-MM') AS month,
               COUNT(*)::int AS count
        FROM incoming_documents
        WHERE organization_id = $1
          AND received_at >= NOW() - INTERVAL '6 months'
          AND deleted_at IS NULL
        GROUP BY DATE_TRUNC('month', received_at)
        ORDER BY DATE_TRUNC('month', received_at) ASC
      `, [orgId]),

      // สถานะร้องเรียน
      this.dataSource.query(`
        SELECT status, COUNT(*)::int AS count
        FROM complaints
        WHERE organization_id = $1
        GROUP BY status
        ORDER BY count DESC
      `, [orgId]),

      // สถานะอนุมัติ
      this.dataSource.query(`
        SELECT status, COUNT(*)::int AS count
        FROM approval_requests
        WHERE organization_id = $1
          AND deleted_at IS NULL
        GROUP BY status
        ORDER BY count DESC
      `, [orgId]),

      // ลาตามประเภท (เดือนปัจจุบัน)
      this.dataSource.query(`
        SELECT lt.name_th AS name, COUNT(lr.id)::int AS count
        FROM leave_requests lr
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.organization_id = $1
          AND DATE_TRUNC('month', lr.created_at) = DATE_TRUNC('month', NOW())
        GROUP BY lt.name_th
        ORDER BY count DESC
      `, [orgId]),
    ]);

    return { monthlyDocs, complaintsByStatus, approvalsByStatus, leaveByType };
  }

  async getMayorDashboard(orgId: string) {
    const [docsToSign, complaints, pendingApprovals] = await Promise.all([
      this.approvalRepo.count({ where: { organizationId: orgId, status: In([ApprovalStatus.WAITING, ApprovalStatus.IN_PROGRESS, ApprovalStatus.REVIEWING]) } }),
      this.complaintRepo.findAndCount({
        where: { organizationId: orgId, status: 'รับเรื่องแล้ว' },
        take: 5,
        order: { createdAt: 'DESC' },
      }),
      this.approvalRepo.findAndCount({
        where: { organizationId: orgId, status: In([ApprovalStatus.WAITING, ApprovalStatus.IN_PROGRESS, ApprovalStatus.REVIEWING]) },
        take: 5,
        order: { submittedAt: 'DESC' },
        relations: ['requester', 'type'],
      }),
    ]);

    return {
      docsToSign,
      recentComplaints: { data: complaints[0], total: complaints[1] },
      pendingApprovals: { data: pendingApprovals[0], total: pendingApprovals[1] },
    };
  }

  async getClerkDashboard(orgId: string) {
    const [pendingIncoming, pendingApprovals] = await Promise.all([
      this.incomingRepo.findAndCount({
        where: { organizationId: orgId, status: 'รอรับ' },
        take: 10,
        order: { receivedAt: 'DESC' },
      }),
      this.approvalRepo.findAndCount({
        where: { organizationId: orgId, status: In([ApprovalStatus.WAITING, ApprovalStatus.IN_PROGRESS, ApprovalStatus.REVIEWING]) },
        take: 10,
        order: { submittedAt: 'DESC' },
        relations: ['requester', 'type'],
      }),
    ]);

    return {
      pendingIncoming: { data: pendingIncoming[0], total: pendingIncoming[1] },
      pendingApprovals: { data: pendingApprovals[0], total: pendingApprovals[1] },
    };
  }

  async getOfficerDashboard(orgId: string, userId: string) {
    const [myApprovals, incomingAssigned] = await Promise.all([
      this.approvalRepo.findAndCount({
        where: { organizationId: orgId, requesterId: userId },
        take: 5,
        order: { createdAt: 'DESC' },
        relations: ['type'],
      }),
      this.incomingRepo.findAndCount({
        where: { organizationId: orgId, assignedTo: userId, status: 'ดำเนินการ' },
        take: 5,
        order: { receivedAt: 'DESC' },
      }),
    ]);

    return {
      myApprovals: { data: myApprovals[0], total: myApprovals[1] },
      assignedDocuments: { data: incomingAssigned[0], total: incomingAssigned[1] },
    };
  }
}
