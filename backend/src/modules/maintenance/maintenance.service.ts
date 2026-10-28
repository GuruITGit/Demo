import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { Organization } from '../../database/entities/organization.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { PurgeDto } from './dto/purge.dto';

interface ModuleSpec {
  parent: string;
  children: { table: string; fk: string }[];
  extras?: string[]; // ใช้ SUB แทน subquery ของ parent id
}

// โมดูลธุรกรรม → ตารางที่ต้องล้าง (child ก่อน parent) — ไม่แตะ master data
// ทุก parent มี organization_id → ลบเฉพาะของ อบต. ที่กด (child/extras ผูกผ่าน SUB ของ parent จึงถูก scope ตามไปด้วย)
const MODULE_SPECS: Record<string, ModuleSpec> = {
  correspondence: {
    parent: 'correspondence_tickets',
    children: [
      { table: 'correspondence_ticket_departments', fk: 'ticket_id' },
      { table: 'ticket_documents', fk: 'ticket_id' }, // เอกสารที่ร่างด้วยตัวแต่งเอกสาร
    ],
    extras: [
      // คอลัมน์จริงคือ document_id (ไม่ใช่ doc_id) — เดิมผิด → SQL error → ล้างสารบรรณไม่ได้
      "DELETE FROM document_workflow_logs WHERE doc_type='TICKET' AND document_id IN (SUB)",
      "DELETE FROM file_uploads WHERE ref_type='ticket' AND ref_id IN (SUB)",
    ],
  },
  projects: {
    parent: 'projects',
    children: [{ table: 'project_plans', fk: 'project_id' }],
  },
  meetings: {
    parent: 'meetings',
    children: [
      { table: 'meeting_agenda_items', fk: 'meeting_id' },
      { table: 'meeting_attendees', fk: 'meeting_id' },
      { table: 'meeting_resolutions', fk: 'meeting_id' },
    ],
    extras: ["DELETE FROM file_uploads WHERE ref_type='meeting' AND ref_id IN (SUB)"],
  },
  leave: {
    parent: 'leave_requests',
    children: [{ table: 'leave_approval_logs', fk: 'request_id' }],
    extras: ["DELETE FROM file_uploads WHERE ref_type='leave_request' AND ref_id IN (SUB)"],
  },
  dms: {
    parent: 'documents',
    children: [{ table: 'document_versions', fk: 'document_id' }],
    extras: ["DELETE FROM file_uploads WHERE ref_type='document' AND ref_id IN (SUB)"],
  },
  notifications: {
    parent: 'notifications',
    children: [],
  },
  // เรื่องแจ้ง/ร้องเรียน + ขอใช้บริการจากประชาชน — ความเห็นภายใน + เอกสารที่เจ้าหน้าที่อัปโหลดมาเซ็น
  citizen_reports: {
    parent: 'citizen_reports',
    children: [{ table: 'citizen_report_comments', fk: 'report_id' }],
    extras: ["DELETE FROM file_uploads WHERE ref_type='citizen-report' AND ref_id IN (SUB)"],
  },
};

const ALL_MODULES = Object.keys(MODULE_SPECS);

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private dataSource: DataSource,
  ) {}

  /** WHERE ของ parent: บังคับ organization_id เสมอ (กันลบข้าม อบต.) + ช่วงเวลา (ถ้ามี) */
  private buildDate(orgId: string, from?: string, to?: string): { where: string; params: any[] } {
    const conds: string[] = ['organization_id = $1'];
    const params: any[] = [orgId];
    if (from) { params.push(from); conds.push(`created_at >= $${params.length}`); }
    if (to) { params.push(to); conds.push(`created_at <= $${params.length}`); }
    return { where: conds.length ? ' WHERE ' + conds.join(' AND ') : '', params };
  }

  private async purgeModule(m: EntityManager, mod: string, orgId: string, from?: string, to?: string): Promise<number> {
    const spec = MODULE_SPECS[mod];
    if (!spec) return 0;
    const { where, params } = this.buildDate(orgId, from, to);
    const sub = `SELECT id FROM ${spec.parent}${where}`;

    // นับจำนวน parent ที่จะลบ (ไว้รายงานสรุป)
    const cnt = await m.query(`SELECT COUNT(*)::int AS c FROM ${spec.parent}${where}`, params);
    const affected = cnt?.[0]?.c ?? 0;

    for (const c of spec.children) {
      await m.query(`DELETE FROM ${c.table} WHERE ${c.fk} IN (${sub})`, params);
    }
    for (const extra of spec.extras ?? []) {
      await m.query(extra.replace('SUB', sub), params);
    }
    await m.query(`DELETE FROM ${spec.parent}${where}`, params);
    return affected;
  }

  /** ลบสารบรรณเฉพาะรายการที่เลือก (scope องค์กร กันลบข้ามองค์กร) — rework v20000 */
  private async purgeTicketsByIds(m: EntityManager, ids: string[], orgId: string): Promise<number> {
    const rows = await m.query(
      `SELECT id FROM correspondence_tickets WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
      [orgId, ids],
    );
    const validIds: string[] = rows.map((r: any) => r.id);
    if (!validIds.length) return 0;
    await m.query(`DELETE FROM correspondence_ticket_departments WHERE ticket_id = ANY($1::uuid[])`, [validIds]);
    await m.query(`DELETE FROM ticket_documents WHERE ticket_id = ANY($1::uuid[])`, [validIds]);
    await m.query(`DELETE FROM document_workflow_logs WHERE doc_type='TICKET' AND document_id = ANY($1::uuid[])`, [validIds]);
    await m.query(`DELETE FROM file_uploads WHERE ref_type='ticket' AND ref_id = ANY($1::uuid[])`, [validIds]);
    await m.query(`DELETE FROM correspondence_tickets WHERE id = ANY($1::uuid[])`, [validIds]);
    return validIds.length;
  }

  private async purgeUsers(m: EntityManager, ids: string[], actingUserId: string, orgId: string): Promise<{ deleted: number; skipped: number }> {
    // ผู้ใช้ที่ห้ามลบเสมอ: ตัวเอง + admin username + ทุกคนที่มีบทบาท SUPER_ADMIN/ADMIN
    const protectedRows = await m.query(
      `SELECT DISTINCT ur.user_id AS id FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE r.name IN ('SUPER_ADMIN','ADMIN')`,
    );
    const adminRows = await m.query(`SELECT id FROM users WHERE username = 'admin'`);
    const blocked = new Set<string>([actingUserId, ...protectedRows.map((x: any) => x.id), ...adminRows.map((x: any) => x.id)]);

    // ลบได้เฉพาะผู้ใช้ของ อบต. ตัวเอง
    const inOrg = new Set<string>((await m.query(`SELECT id FROM users WHERE organization_id = $1 AND id = ANY($2::uuid[])`, [orgId, ids])).map((x: any) => x.id));

    let deleted = 0, skipped = 0;
    for (const id of ids) {
      if (blocked.has(id) || !inOrg.has(id)) { skipped++; continue; }
      try {
        await m.query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);
        await m.query(`DELETE FROM user_permissions WHERE user_id = $1`, [id]);
        await m.query(`DELETE FROM notification_preferences WHERE user_id = $1`, [id]);
        await m.query(`DELETE FROM notifications WHERE user_id = $1`, [id]);
        await m.query(`DELETE FROM employees WHERE user_id = $1`, [id]);
        await m.query(`DELETE FROM users WHERE id = $1`, [id]);
        deleted++;
      } catch {
        // ลบไม่ได้เพราะยังมีข้อมูลอ้างอิง (เช่น เป็นเจ้าของสารบรรณ) → ข้าม
        skipped++;
      }
    }
    return { deleted, skipped };
  }

  /** สำรองข้อมูลธุรกรรม (JSON) ก่อนล้าง — ดาวน์โหลดเก็บไว้กู้เองได้ (rework v20000) */
  async exportBackup(actingUser: any) {
    // ตารางธุรกรรมที่ purge แตะ (ไม่รวม users/master data — ไม่หลุด passwordHash) — เฉพาะของ อบต. ตัวเอง
    const me = await this.userRepo.findOne({ where: { id: actingUser.id }, select: ['id', 'organizationId'] });
    const orgId = me?.organizationId;
    if (!orgId) throw new BadRequestException('ไม่พบองค์กรของผู้ใช้');
    const queries: Record<string, string> = {};
    for (const spec of Object.values(MODULE_SPECS)) {
      const sub = `SELECT id FROM ${spec.parent} WHERE organization_id = $1`;
      queries[spec.parent] = `SELECT * FROM ${spec.parent} WHERE organization_id = $1`;
      for (const c of spec.children) queries[c.table] = `SELECT * FROM ${c.table} WHERE ${c.fk} IN (${sub})`;
    }
    queries.document_workflow_logs = `SELECT * FROM document_workflow_logs WHERE doc_type='TICKET' AND document_id IN (SELECT id FROM correspondence_tickets WHERE organization_id = $1)`;
    queries.file_uploads = `SELECT * FROM file_uploads WHERE
      (ref_type='ticket' AND ref_id IN (SELECT id FROM correspondence_tickets WHERE organization_id = $1))
      OR (ref_type='meeting' AND ref_id IN (SELECT id FROM meetings WHERE organization_id = $1))
      OR (ref_type='leave_request' AND ref_id IN (SELECT id FROM leave_requests WHERE organization_id = $1))
      OR (ref_type='document' AND ref_id IN (SELECT id FROM documents WHERE organization_id = $1))
      OR (ref_type='citizen-report' AND ref_id IN (SELECT id FROM citizen_reports WHERE organization_id = $1))`;
    const dump: Record<string, any[]> = {};
    for (const [tbl, sql] of Object.entries(queries)) {
      try { dump[tbl] = await this.dataSource.query(sql, [orgId]); }
      catch { dump[tbl] = []; }
    }
    return {
      generatedAt: new Date().toISOString(),
      generatedBy: actingUser?.username || actingUser?.id,
      note: 'สำรองข้อมูลธุรกรรม SmartGov (ก่อนล้างข้อมูล) — เก็บไฟล์นี้ไว้กู้คืนเอง',
      counts: Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, v.length])),
      tables: dump,
    };
  }

  async purge(dto: PurgeDto, actingUser: any) {
    // ── ยืนยันชั้นที่ 2: รหัสผ่านของผู้ทำรายการ ──
    const me = await this.userRepo.findOne({ where: { id: actingUser.id }, select: ['id', 'passwordHash', 'organizationId'] });
    const pwOk = me?.passwordHash && await bcrypt.compare(dto.password || '', me.passwordHash);
    if (!pwOk) throw new UnauthorizedException('รหัสผ่านไม่ถูกต้อง');

    // ── ยืนยันชั้นที่ 1: พิมพ์ชื่อองค์กรให้ตรง ──
    const org = me?.organizationId ? await this.orgRepo.findOne({ where: { id: me.organizationId } }) : null;
    if (!org || (dto.confirmText || '').trim() !== (org.nameTh || '').trim()) {
      throw new BadRequestException('ข้อความยืนยันไม่ตรงกับชื่อองค์กร');
    }

    const modules = dto.resetAll ? ALL_MODULES : (dto.modules ?? []).filter((mo) => MODULE_SPECS[mo]);
    const summary: Record<string, any> = {};

    await this.dataSource.transaction(async (m) => {
      for (const mod of modules) {
        summary[mod] = await this.purgeModule(m, mod, org.id, dto.dateFrom, dto.dateTo);
      }
      if (dto.resetSequences || dto.resetAll) {
        await m.query('DELETE FROM document_number_sequences WHERE organization_id = $1', [org.id]);
        summary['sequences'] = 'reset';
      }
      if (dto.deleteTicketIds?.length) {
        summary['correspondenceTickets'] = await this.purgeTicketsByIds(m, dto.deleteTicketIds, org.id);
      }
      if (dto.deleteUserIds?.length) {
        summary['users'] = await this.purgeUsers(m, dto.deleteUserIds, actingUser.id, org.id);
      }
    });

    await this.auditRepo.save(this.auditRepo.create({
      organizationId: org.id,
      userId: actingUser.id,
      userName: actingUser.fullNameTh || actingUser.username,
      action: 'purge',
      module: 'maintenance',
      resourceTitle: 'ล้างข้อมูล demo',
      newValues: {
        resetAll: !!dto.resetAll, modules, dateFrom: dto.dateFrom, dateTo: dto.dateTo,
        deleteUserIds: dto.deleteUserIds, resetSequences: !!dto.resetSequences, summary,
      },
      status: 'success',
    }));

    return { message: 'ล้างข้อมูลสำเร็จ', summary };
  }
}
