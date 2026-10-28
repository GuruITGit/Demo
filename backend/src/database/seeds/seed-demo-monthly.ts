import { DataSource } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { Department } from '../entities/department.entity';
import { User } from '../entities/user.entity';
import {
  CorrespondenceTicket, TicketStatus, TicketUrgency, TicketConfidentiality,
  TicketDirection, RegisterBook,
} from '../entities/correspondence-ticket.entity';
import { DocumentWorkflowLog } from '../entities/document-workflow-log.entity';

/**
 * ข้อมูลตัวอย่างสำหรับ "รายงานสรุปประจำเดือน" (Summarize Report)
 * — สร้างสารบรรณย้อนหลังกระจายหลายเดือน/หลายปี ให้ลูกค้ากดดูรายงานได้จริง
 * — idempotent: ข้ามถ้าเคย seed แล้ว (ดูจาก keywords marker)
 * — ใช้ raw UPDATE ย้อน created_at เพราะ TypeORM ตั้งค่า CreateDateColumn เองตอน insert
 */

const MARKER = 'demo-monthly-report';

const DEPT_PREFIX: Record<string, string> = {
  ADMIN: 'สป', FINANCE: 'กค', ENGINEERING: 'กช', EDUCATION: 'กศ', HEALTH: 'สธ', WELFARE: 'สก',
};

// [หัวเรื่อง, ประเภทหนังสือ(docType), สมุดทะเบียน, ทิศทาง, ต้นทาง]
const TEMPLATES: [string, string, RegisterBook, TicketDirection, string][] = [
  ['ขอความอนุเคราะห์ประชาสัมพันธ์โครงการจังหวัด', 'ทั่วไป', RegisterBook.R_MAIN, TicketDirection.RECEIVE, 'ที่ว่าการอำเภอ'],
  ['แจ้งจัดสรรงบประมาณเงินอุดหนุนทั่วไป', 'ทั่วไป', RegisterBook.R_MAIN, TicketDirection.RECEIVE, 'กรมส่งเสริมการปกครองท้องถิ่น'],
  ['ขอเชิญประชุมหัวหน้าส่วนราชการประจำเดือน', 'ทั่วไป', RegisterBook.R_MAIN, TicketDirection.RECEIVE, 'ที่ว่าการอำเภอ'],
  ['ซักซ้อมแนวทางการจัดทำงบประมาณรายจ่ายประจำปี', 'ทั่วไป', RegisterBook.R_MAIN, TicketDirection.RECEIVE, 'จังหวัด'],
  ['ขออนุมัติจัดซื้อวัสดุสำนักงาน', 'บันทึกข้อความ', RegisterBook.R_MSG_MEMO, TicketDirection.RECEIVE, 'กองคลัง'],
  ['ขออนุมัติเดินทางไปราชการ', 'บันทึกข้อความ', RegisterBook.R_MSG_MEMO, TicketDirection.RECEIVE, 'สำนักปลัด'],
  ['รายงานผลการปฏิบัติงานประจำเดือน', 'บันทึกข้อความ', RegisterBook.R_MSG_MEMO, TicketDirection.RECEIVE, 'กองช่าง'],
  ['ร้องเรียนถนนชำรุดหมู่ที่ 3', 'ร้องเรียน-ร้องทุกข์', RegisterBook.R_COMPLAIN, TicketDirection.RECEIVE, 'ประชาชน'],
  ['ร้องเรียนน้ำประปาไม่ไหล หมู่ที่ 5', 'ร้องเรียน-ร้องทุกข์', RegisterBook.R_COMPLAIN, TicketDirection.RECEIVE, 'ประชาชน'],
  ['ขอความร่วมมือสำรวจข้อมูลผู้สูงอายุ', 'ทั่วไป', RegisterBook.S_NORMAL, TicketDirection.SEND, 'อบต.'],
  ['ส่งรายงานผลการดำเนินงานประจำไตรมาส', 'ทั่วไป', RegisterBook.S_NORMAL, TicketDirection.SEND, 'อบต.'],
  ['แจ้งเวียนแนวทางปฏิบัติการลงเวลาปฏิบัติราชการ', 'ทั่วไป', RegisterBook.S_VIAN, TicketDirection.SEND, 'สำนักปลัด'],
  ['คำสั่งแต่งตั้งคณะกรรมการตรวจรับพัสดุ', 'คำสั่ง', RegisterBook.S_DIRECTION, TicketDirection.SEND, 'อบต.'],
  ['คำสั่งมอบหมายงานในหน้าที่ราชการ', 'คำสั่ง', RegisterBook.S_DIRECTION, TicketDirection.SEND, 'อบต.'],
  ['ประกาศรับสมัครพนักงานจ้างทั่วไป', 'ประกาศ', RegisterBook.S_ANNOUNCE, TicketDirection.SEND, 'อบต.'],
];

export async function seedDemoMonthly(ds: DataSource): Promise<void> {
  const orgRepo = ds.getRepository(Organization);
  const deptRepo = ds.getRepository(Department);
  const userRepo = ds.getRepository(User);
  const ticketRepo = ds.getRepository(CorrespondenceTicket);
  const logRepo = ds.getRepository(DocumentWorkflowLog);

  const org = await orgRepo.createQueryBuilder('o').orderBy('o.created_at', 'ASC').getOne();
  if (!org) { console.log('  ไม่พบหน่วยงาน — ข้าม'); return; }

  const existing = await ticketRepo.count({ where: { organizationId: org.id, keywords: MARKER } });
  if (existing > 0) {
    console.log(`  มีข้อมูลตัวอย่างรายเดือนแล้ว (${existing} เรื่อง) — ข้าม`);
    return;
  }

  const depts = await deptRepo.find({ where: { organizationId: org.id } });
  const workDepts = depts.filter((d) => DEPT_PREFIX[d.code]);
  if (!workDepts.length) { console.log('  ไม่พบกอง — ข้าม'); return; }

  // ผู้สร้างเรื่อง: เจ้าหน้าที่ในระบบ (fallback = ใครก็ได้)
  const officers = await userRepo.find({ where: { organizationId: org.id, isActive: true } });
  const officerOf = (dept: Department) =>
    officers.find((u) => u.departmentId === dept.id) || officers[0];

  // เดือนที่จะสร้าง: ปีปัจจุบัน (ม.ค.–เดือนนี้) + ปีที่แล้วทั้งปี + ปลายปีก่อนหน้า
  const now = new Date();
  const months: { y: number; m: number }[] = [];
  for (let m = 1; m <= now.getMonth() + 1; m++) months.push({ y: now.getFullYear(), m });
  for (let m = 1; m <= 12; m++) months.push({ y: now.getFullYear() - 1, m });
  for (let m = 9; m <= 12; m++) months.push({ y: now.getFullYear() - 2, m });

  // สุ่มแบบ deterministic (ให้ผลเหมือนกันทุกครั้ง)
  let seedNum = 42;
  const rand = () => { seedNum = (seedNum * 9301 + 49297) % 233280; return seedNum / 233280; };
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  let running = 0;
  let created = 0;

  for (const { y, m } of months) {
    const thaiYear = y + 543;
    const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;
    const perMonth = 6 + Math.floor(rand() * 8); // 6-13 เรื่อง/เดือน

    for (let i = 0; i < perMonth; i++) {
      const [subject, docType, book, direction, sourceOrg] = pick(TEMPLATES);
      const dept = pick(workDepts);
      const creator = officerOf(dept);
      running++;

      // วันที่ภายในเดือน (วันที่ 1-27, เวลา 8:30-16:30)
      const day = 1 + Math.floor(rand() * 27);
      const when = new Date(y, m - 1, day, 8 + Math.floor(rand() * 8), Math.floor(rand() * 60));
      if (when > now) when.setTime(now.getTime() - 3600_000);

      // เดือนเก่าเกือบทั้งหมดเสร็จสิ้น เดือนปัจจุบันคละสถานะ
      const status = isCurrentMonth
        ? pick([TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_CLERK, TicketStatus.PENDING_MAYOR, TicketStatus.COMPLETED])
        : (rand() < 0.9 ? TicketStatus.COMPLETED : TicketStatus.CANCELLED);

      const urgency = rand() < 0.78 ? TicketUrgency.NORMAL
        : pick([TicketUrgency.URGENT, TicketUrgency.VERY_URGENT, TicketUrgency.MOST_URGENT]);
      const confidentiality = rand() < 0.93 ? TicketConfidentiality.NORMAL : TicketConfidentiality.CONFIDENTIAL;

      const prefix = DEPT_PREFIX[dept.code] || 'บล';
      const saved = await ticketRepo.save(ticketRepo.create({
        organizationId: org.id,
        ticketNumber: `${prefix} ${String(running).padStart(4, '0')}/${thaiYear}`,
        subject: `${subject} (ตัวอย่าง)`,
        docType,
        docCategory: direction,
        registerBook: book,
        direction,
        sourceOrg,
        recipient: 'นายกองค์การบริหารส่วนตำบล',
        urgencyLevel: urgency,
        confidentiality,
        status,
        ownerDeptId: dept.id,
        responsibleUserId: creator?.id,
        createdBy: creator?.id,
        fiscalYear: thaiYear,
        receivedDate: when,
        docDate: when,
        keywords: MARKER,
        ...(status === TicketStatus.COMPLETED ? { clerkSignedAt: when, mayorSignedAt: when, completedAt: when } : {}),
      } as Partial<CorrespondenceTicket>));

      // ย้อนวันที่สร้างให้อยู่ในเดือนนั้นจริง (CreateDateColumn ตั้งเป็น now ตอน insert)
      await ds.query(
        'UPDATE correspondence_tickets SET created_at = $1, updated_at = $1 WHERE id = $2',
        [when, saved.id],
      );

      // ไทม์ไลน์ขั้นแรกให้หน้ารายละเอียดไม่ว่าง
      const log = await logRepo.save(logRepo.create({
        docType: 'TICKET',
        documentId: saved.id,
        stepNumber: 0,
        stepName: 'ลงรับเอกสาร',
        actorId: creator?.id,
        action: 'ลงรับเอกสาร',
        toStatus: status,
        note: 'ข้อมูลตัวอย่างสำหรับสาธิตระบบ',
      } as Partial<DocumentWorkflowLog>));
      await ds.query('UPDATE document_workflow_logs SET acted_at = $1 WHERE id = $2', [when, log.id]);

      created++;
    }
  }

  console.log(`  สร้างสารบรรณตัวอย่าง ${created} เรื่อง กระจาย ${months.length} เดือน`);
}
