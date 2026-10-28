import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Project } from '../../database/entities/project.entity';
import { ProjectPlan, PlanChangeType } from '../../database/entities/project-plan.entity';
import { paginate, PaginationDto } from '../../common/dto/pagination.dto';
import { getCurrentThaiYear } from '../../common/utils/date.util';
import { isAdmin } from '../../common/utils/ownership.util';
import { SequenceService } from '../../common/services/sequence.service';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project) private repo: Repository<Project>,
    @InjectRepository(ProjectPlan) private planRepo: Repository<ProjectPlan>,
    private sequences: SequenceService,
  ) {}

  /** เฉพาะผู้ดูแลระบบเท่านั้นที่สร้าง/แก้ไข/ลบโครงการได้ (Rework 2.0) */
  private assertAdmin(user: any) {
    if (!isAdmin(user)) {
      throw new ForbiddenException('เฉพาะผู้ดูแลระบบเท่านั้นที่จัดการโครงการได้');
    }
  }

  async findAll(orgId: string, dto: PaginationDto & { status?: string; fiscalYear?: number }) {
    const base: any = { organizationId: orgId };
    if (dto.status) base.status = dto.status;
    if (dto.fiscalYear) base.fiscalYear = dto.fiscalYear;

    const where = dto.search
      ? [
          { ...base, title: ILike(`%${dto.search}%`) },
          { ...base, projectNumber: ILike(`%${dto.search}%`) },
          { ...base, strategy: ILike(`%${dto.search}%`) },
        ]
      : base;

    const [data, total] = await this.repo.findAndCount({
      where,
      relations: ['department', 'projectManager'],
      skip: dto.skip,
      take: dto.limit,
      order: { fiscalYear: 'DESC', createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async findOne(id: string, orgId: string) {
    const p = await this.repo.findOne({
      where: { id, organizationId: orgId },
      relations: ['department', 'projectManager', 'createdBy'],
    });
    if (!p) throw new NotFoundException('ไม่พบโครงการ');
    const plans = await this.getPlans(id);
    return { ...p, plans };
  }

  /** ประวัติแผนทั้งหมด เรียงตามลำดับเวลา (แสดงความเป็นมาของโครงการ) */
  async getPlans(projectId: string) {
    return this.planRepo.find({
      where: { projectId },
      relations: ['createdBy'],
      order: { planNo: 'ASC', revisionNo: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(dto: any, orgId: string, user: any) {
    this.assertAdmin(user);
    const year = dto.fiscalYear || getCurrentThaiYear();
    const seq = await this.sequences.next(orgId, 'PROJECT', { table: 'projects', column: 'project_number', fiscalYear: year });
    const projectNumber = `PJ-${year}-${String(seq).padStart(4, '0')}`;

    const project = await this.repo.save({
      ...dto,
      organizationId: orgId,
      createdById: user.id,
      projectNumber,
      fiscalYear: year,
      status: dto.status || 'แผน',
      progressPct: dto.progressPct || 0,
    });

    // เปิดแผนที่ 1 อัตโนมัติ
    await this.planRepo.save(
      this.planRepo.create({
        organizationId: orgId,
        projectId: project.id,
        planNo: 1,
        revisionNo: 0,
        changeType: PlanChangeType.NEW_PLAN,
        title: project.title,
        description: dto.planNote || 'เปิดโครงการ — แผนที่ 1',
        budgetAmount: project.budgetAmount,
        actualAmount: project.actualAmount,
        progressPct: project.progressPct,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        proposal: project.proposal,
        createdById: user.id,
      }),
    );

    return this.findOne(project.id, orgId);
  }

  /** แก้ไขข้อมูลโครงการ (เฉพาะ admin กรณีกรอกผิด) — ไม่สร้างเวอร์ชันใหม่ */
  async update(id: string, dto: any, orgId: string, user: any) {
    this.assertAdmin(user);
    await this.findOneRaw(id, orgId);
    await this.repo.update(id, dto);
    // แก้ proposal ในหน้าแก้ไข = แก้ให้ถูก ไม่สร้างเวอร์ชันใหม่ → sync เข้า snapshot เวอร์ชันล่าสุดให้ตรงกัน
    if (dto.proposal !== undefined) {
      const last = await this.planRepo.findOne({
        where: { projectId: id },
        order: { planNo: 'DESC', revisionNo: 'DESC' },
      });
      if (last) await this.planRepo.update(last.id, { proposal: dto.proposal });
    }
    return this.findOne(id, orgId);
  }

  async remove(id: string, orgId: string, user: any) {
    this.assertAdmin(user);
    await this.findOneRaw(id, orgId);
    await this.repo.delete(id);
    return { message: 'ลบโครงการสำเร็จ' };
  }

  /** อัปเดตความคืบหน้าในแผนเดิม (สร้างรายการ revision ใหม่ต่อท้าย) */
  async addUpdate(id: string, dto: any, orgId: string, user: any) {
    this.assertAdmin(user);
    const project = await this.findOneRaw(id, orgId);
    const last = await this.planRepo.findOne({
      where: { projectId: id },
      order: { planNo: 'DESC', revisionNo: 'DESC' },
    });
    const planNo = last?.planNo || 1;
    const revisionNo = (last?.revisionNo ?? -1) + 1;
    return this.appendPlan(project, dto, planNo, revisionNo, PlanChangeType.UPDATE, user.id);
  }

  /** เปลี่ยนแผนใหม่ (planNo + 1, revision 0) */
  async addNewPlan(id: string, dto: any, orgId: string, user: any) {
    this.assertAdmin(user);
    const project = await this.findOneRaw(id, orgId);
    const last = await this.planRepo.findOne({
      where: { projectId: id },
      order: { planNo: 'DESC' },
    });
    const planNo = (last?.planNo || 0) + 1;
    return this.appendPlan(project, dto, planNo, 0, PlanChangeType.NEW_PLAN, user.id);
  }

  private async appendPlan(
    project: Project, dto: any, planNo: number, revisionNo: number,
    changeType: PlanChangeType, userId: string,
  ) {
    const snapshot = {
      budgetAmount: dto.budgetAmount ?? project.budgetAmount,
      actualAmount: dto.actualAmount ?? project.actualAmount,
      progressPct: dto.progressPct ?? project.progressPct,
      status: dto.status ?? project.status,
      startDate: dto.startDate ?? project.startDate,
      endDate: dto.endDate ?? project.endDate,
      proposal: dto.proposal ?? project.proposal,
    };

    await this.planRepo.save(
      this.planRepo.create({
        organizationId: project.organizationId,
        projectId: project.id,
        planNo, revisionNo, changeType,
        title: dto.title || (changeType === PlanChangeType.NEW_PLAN ? `แผนที่ ${planNo}` : undefined),
        description: dto.description,
        ...snapshot,
        createdById: userId,
      }),
    );

    // sync ค่าล่าสุดกลับไปที่โครงการ เพื่อให้รายการ/สถิติแสดงค่าปัจจุบัน
    await this.repo.update(project.id, snapshot);
    return this.findOne(project.id, project.organizationId);
  }

  private async findOneRaw(id: string, orgId: string): Promise<Project> {
    const p = await this.repo.findOne({ where: { id, organizationId: orgId } });
    if (!p) throw new NotFoundException('ไม่พบโครงการ');
    return p;
  }

  async getStats(orgId: string, fiscalYear?: number) {
    const year = fiscalYear || getCurrentThaiYear();
    const [plan, active, done, cancel] = await Promise.all([
      this.repo.count({ where: { organizationId: orgId, fiscalYear: year, status: 'แผน' } }),
      this.repo.count({ where: { organizationId: orgId, fiscalYear: year, status: 'ดำเนินการ' } }),
      this.repo.count({ where: { organizationId: orgId, fiscalYear: year, status: 'เสร็จสิ้น' } }),
      this.repo.count({ where: { organizationId: orgId, fiscalYear: year, status: 'ยกเลิก' } }),
    ]);

    const all = await this.repo.find({ where: { organizationId: orgId, fiscalYear: year } });
    const totalBudget = all.reduce((s, p) => s + Number(p.budgetAmount), 0);
    const totalActual = all.reduce((s, p) => s + Number(p.actualAmount), 0);
    const avgProgress = all.length ? Math.round(all.reduce((s, p) => s + p.progressPct, 0) / all.length) : 0;

    return { plan, active, done, cancel, total: plan + active + done + cancel, totalBudget, totalActual, avgProgress };
  }
}
