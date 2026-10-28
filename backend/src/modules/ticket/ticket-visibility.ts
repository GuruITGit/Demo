/**
 * กฎการมองเห็นสารบรรณ (สิทธิ์ตามกอง + ชั้นความลับ) — แยกจาก ticket.service.ts
 * เป็นฟังก์ชัน plain export (ไม่ใช่ @Injectable) ตามแพทเทิร์นที่โมดูล water ใช้:
 * รับ repository/พารามิเตอร์ที่ต้องใช้ตรง ๆ แทนการ inject service ข้าม sibling
 *
 * ใช้ร่วมกันโดย ticket.service.ts, ticket-numbering.service.ts, ticket-summary.service.ts
 */
import { Repository, Brackets, SelectQueryBuilder } from 'typeorm';
import {
  CorrespondenceTicket, TicketStatus, TicketConfidentiality, CONFIDENTIALITY_RANK,
} from '../../database/entities/correspondence-ticket.entity';
import { TicketQueryDto } from './dto/ticket.dto';

export interface AuthUser {
  id: string;
  organizationId: string;
  departmentId?: string;
  roles?: string[];
  permissions?: string[];
}

/** บทบาทที่เห็นสารบรรณได้ทุกเรื่อง (ปลัด/นายก/ผู้ดูแล) */
export const SEE_ALL_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MAYOR', 'DEPUTY_MAYOR', 'CLERK', 'DEPUTY_CLERK'];

export function isPrivileged(user: AuthUser): boolean {
  return !!user.roles?.some((r) => SEE_ALL_ROLES.includes(r));
}

/**
 * จำกัดการมองเห็นเรื่อง "ชั้นความลับ" (>= ลับ) เฉพาะผู้เกี่ยวข้องโดยตรง
 * (ผู้สร้าง / ผู้รับผิดชอบหลัก / ผู้รับผิดชอบในกอง / หัวหน้ากองที่เกี่ยวข้อง)
 * บทบาทสูง (ปลัด/นายก/admin) เห็นได้ทั้งหมดตามเดิม — ไม่กระทบ workflow
 */
export function applyConfidentiality(qb: SelectQueryBuilder<CorrespondenceTicket>, user: AuthUser) {
  if (isPrivileged(user)) return qb;
  qb.andWhere(
    new Brackets((w) => {
      w.where('t.confidentiality = :cfNormal', { cfNormal: TicketConfidentiality.NORMAL })
        .orWhere('t.created_by = :cfUid', { cfUid: user.id })
        .orWhere('t.responsible_user_id = :cfUid')
        .orWhere('t.current_holder_user_id = :cfUid')
        .orWhere(
          `EXISTS (SELECT 1 FROM correspondence_ticket_departments tdc
            WHERE tdc.ticket_id = t.id
              AND (tdc.assigned_user_id = :cfUid OR jsonb_exists(COALESCE(tdc.assigned_user_ids, '[]'::jsonb), :cfUid::text)))`,
        )
        .orWhere(
          `EXISTS (SELECT 1 FROM correspondence_ticket_departments tdh
            JOIN departments dh ON dh.id = tdh.department_id
            WHERE tdh.ticket_id = t.id AND dh.head_user_id = :cfUid)`,
        )
        .orWhere(
          `EXISTS (SELECT 1 FROM departments doh
            WHERE doh.id = t.owner_dept_id AND doh.head_user_id = :cfUid)`,
        );
    }),
  );
  return qb;
}

/** ตรวจว่าผู้ใช้เกี่ยวข้องโดยตรงกับเรื่องชั้นความลับนี้หรือไม่ (สำหรับ findOne) */
export function canSeeConfidential(ticket: CorrespondenceTicket, user: AuthUser): boolean {
  if ((CONFIDENTIALITY_RANK[ticket.confidentiality] || 0) === 0) return true;
  if (isPrivileged(user)) return true;
  return (
    ticket.createdBy === user.id ||
    ticket.responsibleUserId === user.id ||
    ticket.currentHolderUserId === user.id ||
    (ticket.ticketDepartments?.some((td) => td.assignedUserId === user.id || (td.assignedUserIds?.includes(user.id) ?? false)) ?? false) ||
    ticket.ownerDept?.headUserId === user.id ||
    (ticket.ticketDepartments?.some((td) => td.department?.headUserId === user.id) ?? false)
  );
}

/**
 * @param withUsers join ผู้รับผิดชอบ/ผู้สร้าง (เลือกเฉพาะคอลัมน์แสดงผล) —
 *                  ปิดได้สำหรับเส้นที่นับอย่างเดียว (stats/summary) จะได้ไม่จ่ายค่า join ฟรี
 */
export function buildVisibleQuery(
  ticketRepo: Repository<CorrespondenceTicket>, user: AuthUser, withUsers = true,
): SelectQueryBuilder<CorrespondenceTicket> {
  const userCols = (a: string) => [`${a}.id`, `${a}.titleTh`, `${a}.fullNameTh`, `${a}.positionName`, `${a}.avatarUrl`];
  const qb = ticketRepo.createQueryBuilder('t')
    .leftJoinAndSelect('t.ownerDept', 'ownerDept')
    .where('t.organization_id = :orgId', { orgId: user.organizationId });
  if (withUsers) {
    qb.leftJoin('t.responsibleUser', 'responsibleUser')
      .addSelect(userCols('responsibleUser'))
      .leftJoin('t.creator', 'creator')
      .addSelect(userCols('creator'))
      .leftJoin('t.currentHolder', 'currentHolder')
      .addSelect(userCols('currentHolder'));
  }

  if (!isPrivileged(user)) {
    // เจ้าหน้าที่/หัวหน้ากอง เห็นเฉพาะเรื่องของกองตนเอง หรือที่ตนเองสร้าง
    qb.andWhere(
      new Brackets((w) => {
        w.where('t.created_by = :uid', { uid: user.id })
          .orWhere('t.current_holder_user_id = :uid')
          .orWhere('t.owner_dept_id = :dept', { dept: user.departmentId || null })
          .orWhere(
            `EXISTS (SELECT 1 FROM correspondence_ticket_departments td
                     WHERE td.ticket_id = t.id AND td.department_id = :dept)`,
            { dept: user.departmentId || null },
          );
      }),
    );
  }
  // จำกัดเพิ่มสำหรับเรื่องชั้นความลับ
  applyConfidentiality(qb, user);
  return qb;
}

/** เงื่อนไขค้นหา/กรอง (ใช้ร่วมกันระหว่างรายการและ export) */
export function applyTicketFilters(qb: SelectQueryBuilder<CorrespondenceTicket>, dto: TicketQueryDto) {
  if (dto.status) {
    // "ที่ต้องทำ" = รอดำเนินการ + กำลังดำเนินการ (รวมส่งกลับแก้ไข) — ค่า default หน้าแรก
    if (dto.status === 'ACTIVE') {
      qb.andWhere('t.status IN (:...active)', { active: [TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS, TicketStatus.RETURNED] });
    } else if (dto.status === TicketStatus.IN_PROGRESS) {
      // "กำลังดำเนินการ" ครอบคลุมเรื่องที่ถูกส่งกลับแก้ไขด้วย
      qb.andWhere('t.status IN (:...st)', { st: [TicketStatus.IN_PROGRESS, TicketStatus.RETURNED] });
    } else {
      qb.andWhere('t.status = :status', { status: dto.status });
    }
  }
  if (dto.step) qb.andWhere('t.current_step = :step', { step: dto.step });
  if (dto.urgencyLevel) qb.andWhere('t.urgency_level = :u', { u: dto.urgencyLevel });
  if (dto.confidentiality) qb.andWhere('t.confidentiality = :cf', { cf: dto.confidentiality });
  if (dto.registerBook) qb.andWhere('t.register_book = :rb', { rb: dto.registerBook });
  if (dto.direction) qb.andWhere('t.direction = :dir', { dir: dto.direction });
  if (dto.fiscalYear) qb.andWhere('t.fiscal_year = :fy', { fy: dto.fiscalYear });
  if (dto.responsibleUserId) qb.andWhere('t.responsible_user_id = :ru', { ru: dto.responsibleUserId });
  if (dto.sourceOrg) qb.andWhere('t.source_org ILIKE :so', { so: `%${dto.sourceOrg}%` });
  if (dto.dateFrom) qb.andWhere('t.received_date >= :df', { df: dto.dateFrom });
  if (dto.dateTo) qb.andWhere('t.received_date <= :dt', { dt: dto.dateTo });
  if (dto.deptId) {
    qb.andWhere(
      `(t.owner_dept_id = :fdept OR EXISTS (SELECT 1 FROM correspondence_ticket_departments td2
        WHERE td2.ticket_id = t.id AND td2.department_id = :fdept))`,
      { fdept: dto.deptId },
    );
  }
  if (dto.search) {
    qb.andWhere(
      new Brackets((w) => {
        w.where('t.subject ILIKE :s', { s: `%${dto.search}%` })
          .orWhere('t.receive_reg_number ILIKE :s', { s: `%${dto.search}%` })
          .orWhere('t.ticket_number ILIKE :s', { s: `%${dto.search}%` })
          .orWhere('t.external_doc_number ILIKE :s', { s: `%${dto.search}%` })
          .orWhere('t.source_org ILIKE :s', { s: `%${dto.search}%` })
          .orWhere('t.keywords ILIKE :s', { s: `%${dto.search}%` });
      }),
    );
  }
  return qb;
}
