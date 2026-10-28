import { DataSource } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { Department } from '../entities/department.entity';
import { User } from '../entities/user.entity';
import { CorrespondenceTicket, TicketStatus } from '../entities/correspondence-ticket.entity';
import { CorrespondenceTicketDepartment, TicketDeptStatus } from '../entities/correspondence-ticket-department.entity';
import { DocumentWorkflowLog } from '../entities/document-workflow-log.entity';
import { Project } from '../entities/project.entity';
import { ProjectPlan, PlanChangeType } from '../entities/project-plan.entity';
import { getCurrentThaiYear } from '../../common/utils/date.util';

const DEPT_PREFIX: Record<string, string> = {
  ADMIN: 'สป', FINANCE: 'กค', ENGINEERING: 'กช', EDUCATION: 'กศ', HEALTH: 'สธ', WELFARE: 'สก',
};

async function genNo(ds: DataSource, orgId: string, dept: Department): Promise<string> {
  const prefix = DEPT_PREFIX[dept.code] || dept.code.slice(0, 2).toUpperCase();
  const rows = await ds.query(
    `INSERT INTO document_number_sequences (organization_id, doc_type, year, prefix, current_number)
     VALUES ($1, $2, 0, $3, 1)
     ON CONFLICT (organization_id, doc_type, year)
     DO UPDATE SET current_number = document_number_sequences.current_number + 1, updated_at = NOW()
     RETURNING current_number, prefix`,
    [orgId, `TICKET:${dept.id}`, prefix],
  );
  return `${rows[0].prefix}${String(rows[0].current_number).padStart(5, '0')}`;
}

/** สร้างข้อมูลตัวอย่างสำหรับทดสอบ (สารบรรณ + โครงการ) — ข้ามถ้ามีข้อมูลอยู่แล้ว */
export async function seedDemoData(ds: DataSource): Promise<void> {
  const orgRepo = ds.getRepository(Organization);
  const deptRepo = ds.getRepository(Department);
  const userRepo = ds.getRepository(User);
  const ticketRepo = ds.getRepository(CorrespondenceTicket);
  const tdRepo = ds.getRepository(CorrespondenceTicketDepartment);
  const logRepo = ds.getRepository(DocumentWorkflowLog);
  const projRepo = ds.getRepository(Project);
  const planRepo = ds.getRepository(ProjectPlan);

  const org = await orgRepo.findOne({ where: { code: 'ABT-DEMO' } });
  if (!org) return;
  if ((await ticketRepo.count({ where: { organizationId: org.id } })) > 0) {
    console.log('  มีข้อมูลตัวอย่างแล้ว — ข้าม');
    return;
  }

  const depts = await deptRepo.find({ where: { organizationId: org.id } });
  const byCode = (c: string) => depts.find((d) => d.code === c)!;
  const userBy = async (username: string) => userRepo.findOne({ where: { username } });

  const eng = byCode('ENGINEERING'), admin = byCode('ADMIN'), fin = byCode('FINANCE');
  const offCivil = await userBy('off_civil');
  const headAdmin = await userBy('head_admin');
  const offFinance = await userBy('off_finance');
  const clerk = await userBy('clerk');
  const mayor = await userBy('mayor');

  const log = (ticketId: string, action: string, actorId?: string, note?: string, toStatus?: string) =>
    logRepo.save({ docType: 'TICKET', documentId: ticketId, stepNumber: 0, stepName: action, actorId: actorId!, action, toStatus, note });

  // 1) สารบรรณเสร็จสิ้น (กองช่าง) — ผ่านครบทุกขั้น
  if (eng && offCivil && clerk && mayor) {
    const t = await ticketRepo.save(ticketRepo.create({
      organizationId: org.id, ticketNumber: await genNo(ds, org.id, eng),
      externalDocNumber: 'นผ 51001/120', subject: 'ขออนุมัติซ่อมไฟฟ้าสาธารณะ หมู่ 3',
      body: 'ไฟฟ้าส่องสว่างชำรุด 8 จุด', urgencyLevel: 'ด่วน', ownerDeptId: eng.id,
      responsibleUserId: offCivil.id, status: TicketStatus.COMPLETED,
      clerkSignedBy: clerk.id, clerkSignedAt: new Date(), mayorSignedBy: mayor.id, mayorSignedAt: new Date(),
      completedAt: new Date(), createdBy: offCivil.id,
    }));
    await tdRepo.save(tdRepo.create({ ticketId: t.id, departmentId: eng.id, assignedUserId: offCivil.id, status: TicketDeptStatus.SUBMITTED, signedBy: offCivil.id, signedAt: new Date() }));
    await log(t.id, 'สร้าง', offCivil.id, undefined, 'รอดำเนินการ');
    await log(t.id, 'เซ็นรับรองกอง', offCivil.id, 'ดำเนินการแล้ว', 'รอปลัด');
    await log(t.id, 'ปลัดเซ็นอนุมัติ', clerk.id, undefined, 'รอนายก');
    await log(t.id, 'นายกเซ็นอนุมัติปิดงาน', mayor.id, 'อนุมัติ', 'เสร็จสิ้น');
  }

  // 2) สารบรรณรอนายก (สำนักปลัด)
  if (admin && headAdmin && clerk) {
    const t = await ticketRepo.save(ticketRepo.create({
      organizationId: org.id, ticketNumber: await genNo(ds, org.id, admin),
      subject: 'ขอความเห็นชอบแผนจัดอบรมบุคลากร', urgencyLevel: 'ปกติ', ownerDeptId: admin.id,
      responsibleUserId: headAdmin.id, status: TicketStatus.PENDING_MAYOR,
      clerkSignedBy: clerk.id, clerkSignedAt: new Date(), createdBy: headAdmin.id,
    }));
    await tdRepo.save(tdRepo.create({ ticketId: t.id, departmentId: admin.id, assignedUserId: headAdmin.id, status: TicketDeptStatus.SUBMITTED, signedBy: headAdmin.id, signedAt: new Date() }));
    await log(t.id, 'สร้าง', headAdmin.id, undefined, 'รอดำเนินการ');
    await log(t.id, 'เซ็นรับรองกอง', headAdmin.id, undefined, 'รอปลัด');
    await log(t.id, 'ปลัดเซ็นอนุมัติ', clerk.id, undefined, 'รอนายก');
  }

  // 3) สารบรรณรอดำเนินการ (กองคลัง)
  if (fin && offFinance) {
    const t = await ticketRepo.save(ticketRepo.create({
      organizationId: org.id, ticketNumber: await genNo(ds, org.id, fin),
      externalDocNumber: 'กค 0808/ว.45', subject: 'แจ้งแนวทางการเบิกจ่ายงบประมาณ',
      urgencyLevel: 'ด่วนมาก', ownerDeptId: fin.id, responsibleUserId: offFinance.id,
      status: TicketStatus.ASSIGNED, createdBy: offFinance.id,
    }));
    await tdRepo.save(tdRepo.create({ ticketId: t.id, departmentId: fin.id, assignedUserId: offFinance.id, status: TicketDeptStatus.ASSIGNED }));
    await log(t.id, 'สร้าง', offFinance.id, undefined, 'รอดำเนินการ');
  }
  console.log('  สารบรรณตัวอย่าง 3 รายการ');

  // โครงการตัวอย่าง + ประวัติแผน
  const year = getCurrentThaiYear();
  const adminUser = await userBy('admin');
  const mkProject = async (n: number, title: string, budget: number, plans: Array<{ change: PlanChangeType; planNo: number; rev: number; desc: string; pct: number; budget: number }>) => {
    const last = plans[plans.length - 1];
    const p = await projRepo.save(projRepo.create({
      organizationId: org.id, projectNumber: `PJ-${year}-${String(n).padStart(4, '0')}`,
      title, fiscalYear: year, deptId: eng?.id, budgetAmount: last.budget, actualAmount: 0,
      progressPct: last.pct, status: 'ดำเนินการ', createdById: adminUser?.id,
    }));
    for (const pl of plans) {
      await planRepo.save(planRepo.create({
        organizationId: org.id, projectId: p.id, planNo: pl.planNo, revisionNo: pl.rev,
        changeType: pl.change, title: pl.change === PlanChangeType.NEW_PLAN ? `แผนที่ ${pl.planNo}` : undefined,
        description: pl.desc, budgetAmount: pl.budget, progressPct: pl.pct, status: 'ดำเนินการ', createdById: adminUser?.id,
      }));
    }
  };
  await mkProject(1, 'โครงการก่อสร้างถนน คสล. สายหนองไผ่', 2500000, [
    { change: PlanChangeType.NEW_PLAN, planNo: 1, rev: 0, desc: 'เปิดโครงการ', pct: 0, budget: 2500000 },
    { change: PlanChangeType.UPDATE, planNo: 1, rev: 1, desc: 'จัดซื้อจัดจ้างเสร็จ', pct: 40, budget: 2500000 },
  ]);
  await mkProject(2, 'โครงการขุดลอกคลองส่งน้ำ หมู่ 5', 800000, [
    { change: PlanChangeType.NEW_PLAN, planNo: 1, rev: 0, desc: 'เปิดโครงการ', pct: 0, budget: 800000 },
    { change: PlanChangeType.NEW_PLAN, planNo: 2, rev: 0, desc: 'ปรับขอบเขตเพิ่มประตูระบายน้ำ', pct: 0, budget: 950000 },
    { change: PlanChangeType.UPDATE, planNo: 2, rev: 1, desc: 'ดำเนินการขุดลอก', pct: 55, budget: 950000 },
  ]);
  console.log('  โครงการตัวอย่าง 2 รายการ');
}
