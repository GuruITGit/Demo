import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../database/entities/organization.entity';
import { Department } from '../../database/entities/department.entity';
import { Division } from '../../database/entities/division.entity';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';
import { hashPassword } from '../../common/utils/hash.util';
import { ModuleAccessService } from '../../common/modules/module-access.service';
import { TOGGLEABLE_MODULES, isToggleableKey } from '../../common/modules/module-registry';
import type { OnboardOrgDto } from './dto/organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization) private orgRepo: Repository<Organization>,
    @InjectRepository(Department) private deptRepo: Repository<Department>,
    @InjectRepository(Division) private divRepo: Repository<Division>,
    private moduleAccess: ModuleAccessService,
  ) {}

  /** SUPER_ADMIN เห็นทุกหน่วยงาน · คนอื่นเห็นเฉพาะหน่วยงานตัวเอง (กันข้อมูลข้าม อบต. รั่ว) */
  async findAll(orgId?: string, isSuper = false) {
    if (isSuper) return this.orgRepo.find({ where: { isActive: true }, order: { nameTh: 'ASC' } });
    if (!orgId) return [];
    return this.orgRepo.find({ where: { id: orgId, isActive: true } });
  }

  async findOne(id: string, orgId?: string, isSuper = false) {
    if (!isSuper && orgId && id !== orgId) throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงข้อมูลหน่วยงานอื่น');
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('ไม่พบหน่วยงาน');
    return org;
  }

  async create(dto: any) {
    const existing = await this.orgRepo.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException('รหัสหน่วยงานนี้มีในระบบแล้ว');
    return this.orgRepo.save(dto);
  }

  /**
   * เปิดใช้งาน อบต. ใหม่ในคลิกเดียว (SUPER_ADMIN) — สร้างหน่วยงาน + ผู้ดูแลคนแรก + ผูกบทบาท ADMIN
   * ทำใน transaction เดียว (ล้มเหลว = ไม่สร้างอะไรค้าง) · บทบาท ADMIN เป็น global (ใช้ร่วมทุก org)
   * การแยกข้อมูลอยู่ที่ user.organizationId — admin ใหม่เห็นเฉพาะ อบต. ตัวเอง
   */
  async onboard(dto: OnboardOrgDto) {
    return this.orgRepo.manager.transaction(async (em) => {
      // 1) หน่วยงาน — รหัส + โดเมนต้องไม่ซ้ำ
      if (await em.findOne(Organization, { where: { code: dto.code.trim() } }))
        throw new ConflictException(`รหัสหน่วยงาน "${dto.code}" มีในระบบแล้ว`);
      const hosts = (dto.hostnames || []).map((h) => h.toLowerCase().split(':')[0].replace(/^www\./, '').trim()).filter(Boolean);
      for (const h of hosts) {
        const [dup] = await em.query(`SELECT id FROM organizations WHERE $1 = ANY(hostnames) LIMIT 1`, [h]);
        if (dup) throw new ConflictException(`โดเมน "${h}" ถูกใช้กับหน่วยงานอื่นแล้ว`);
      }
      const { adminUsername, adminPassword, adminFullName, adminEmail, hostnames, ...orgFields } = dto;
      const org = await em.save(em.create(Organization, { ...orgFields, hostnames: hosts.length ? hosts : null, isActive: true }));

      // 2) ผู้ดูแลคนแรก (unique username/email ต่อ org — ตรวจโดย constraint)
      const email = adminEmail?.trim() || `${adminUsername.trim()}@${dto.code.trim().toLowerCase()}.local`;
      const user = await em.save(em.create(User, {
        organizationId: org.id, username: adminUsername.trim(), email,
        passwordHash: await hashPassword(adminPassword), fullNameTh: adminFullName.trim(), isActive: true,
      }));

      // 3) ผูกบทบาท ADMIN (global) ให้ผู้ดูแล
      const adminRole = await em.findOne(Role, { where: { name: 'ADMIN' } });
      if (!adminRole) throw new NotFoundException('ไม่พบบทบาท ADMIN — ยังไม่ได้ seed สิทธิ์ในระบบ (npm run seed:perms)');
      await em.save(em.create(UserRole, { userId: user.id, roleId: adminRole.id }));

      return {
        org: { id: org.id, code: org.code, nameTh: org.nameTh, hostnames: org.hostnames },
        admin: { username: user.username, email: user.email, fullNameTh: user.fullNameTh },
      };
    });
  }

  async update(id: string, dto: any) {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('ไม่พบหน่วยงาน');
    // โดเมน: normalize + กันซ้ำกับ อบต. อื่น
    if (dto.hostnames !== undefined) {
      const hosts = (dto.hostnames || [])
        .map((h: string) => OrganizationsService.normHost(h)).filter(Boolean);
      for (const h of hosts) {
        const [dup] = await this.orgRepo.query(
          `SELECT id FROM organizations WHERE $1 = ANY(hostnames) AND id <> $2 LIMIT 1`, [h, id]);
        if (dup) throw new ConflictException(`โดเมน "${h}" ถูกใช้กับหน่วยงานอื่นแล้ว`);
      }
      dto = { ...dto, hostnames: hosts.length ? hosts : null };
    }
    Object.assign(org, dto);
    const saved = await this.orgRepo.save(org);
    if (dto.metadata !== undefined) this.moduleAccess.invalidate(id); // เผื่อแก้ disabledModules ผ่าน PATCH
    return saved;
  }

  /** รายการโมดูลที่เปิด-ปิดได้ทั้งหมด (ให้หน้า HUB โชว์ปุ่ม) */
  moduleCatalog() {
    return TOGGLEABLE_MODULES.map((m) => ({ key: m.key, label: m.label, group: m.group }));
  }

  /** โมดูลที่เปิด/ปิดของหน่วยงานหนึ่ง (disabledModules จาก metadata) */
  async modulesOf(id: string) {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('ไม่พบหน่วยงาน');
    const disabled: string[] = Array.isArray(org.metadata?.disabledModules)
      ? org.metadata.disabledModules.filter(isToggleableKey) : [];
    return { disabledModules: disabled, catalog: this.moduleCatalog() };
  }

  /** โมดูลที่ปิดของหน่วยงานผู้ใช้ปัจจุบัน (ให้ frontend ซ่อนเมนู) */
  async currentModules(orgId?: string) {
    if (!orgId) return { disabledModules: [] as string[] };
    const disabled = await this.moduleAccess.disabledFor(orgId);
    return { disabledModules: [...disabled].filter(isToggleableKey) };
  }

  /** ตั้งค่าโมดูลที่ "ปิด" ของหน่วยงาน (SUPER_ADMIN) — merge ลง metadata + ล้าง cache ให้เห็นผลทันที */
  async setModules(id: string, disabledModules: string[]) {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('ไม่พบหน่วยงาน');
    const clean = [...new Set((disabledModules || []).filter(isToggleableKey))];
    org.metadata = { ...(org.metadata || {}), disabledModules: clean };
    await this.orgRepo.save(org);
    this.moduleAccess.invalidate(id);
    return { disabledModules: clean };
  }

  /**
   * HUB (SUPER_ADMIN): ทุก อบต. รวมที่ปิดใช้งาน + จำนวนข้อมูลจริงแต่ละหน่วยงาน
   * (ผู้ใช้/ทะเบียนน้ำ/สารบรรณ) — ใช้ตัดสินว่าลบได้ไหม + ดูภาพรวม
   */
  async hub() {
    const orgs = await this.orgRepo.find({ order: { createdAt: 'ASC' } });
    const counts: any[] = await this.orgRepo.manager.query(`
      SELECT o.id,
        (SELECT COUNT(*)::int FROM users u WHERE u.organization_id = o.id) AS users,
        (SELECT COUNT(*)::int FROM water_customers w WHERE w.organization_id = o.id) AS water,
        (SELECT COUNT(*)::int FROM correspondence_tickets t WHERE t.organization_id = o.id) AS tickets,
        (SELECT COUNT(*)::int FROM citizen_reports cr WHERE cr.organization_id = o.id) AS "citizenReports"
      FROM organizations o`);
    const cmap = new Map<string, any>(counts.map((c) => [c.id, c]));
    return orgs.map((o) => ({
      id: o.id, code: o.code, nameTh: o.nameTh, nameEn: o.nameEn, type: o.type,
      province: o.province, district: o.district, subDistrict: o.subDistrict,
      address: o.address, phone: o.phone, fax: o.fax, email: o.email, website: o.website,
      logoUrl: o.logoUrl, hostnames: o.hostnames || [], metadata: o.metadata || {},
      isActive: o.isActive, createdAt: o.createdAt,
      counts: {
        users: cmap.get(o.id)?.users ?? 0,
        water: cmap.get(o.id)?.water ?? 0,
        tickets: cmap.get(o.id)?.tickets ?? 0,
        citizenReports: cmap.get(o.id)?.citizenReports ?? 0,
      },
    }));
  }

  /** ผู้ใช้ในหน่วยงาน (สำหรับ HUB เลือกคนที่จะรีเซ็ตรหัส) — sanitize ไม่คืน passwordHash */
  async usersOf(id: string) {
    return this.orgRepo.manager.query(
      `SELECT u.id, u.username, u.email, u.full_name_th AS "fullNameTh", u.is_active AS "isActive",
              COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       LEFT JOIN roles r ON r.id = ur.role_id
       WHERE u.organization_id = $1
       GROUP BY u.id ORDER BY u.created_at`, [id]);
  }

  /**
   * รีเซ็ตรหัสผ่านผู้ใช้ในหน่วยงาน (SUPER_ADMIN) — ระบุ userId/username ได้
   * ไม่ระบุ = รีเซ็ตให้ admin คนแรกของหน่วยงาน
   */
  async resetAdminPassword(id: string, dto: { userId?: string; username?: string; password: string }) {
    if (!dto?.password || dto.password.length < 8)
      throw new BadRequestException('รหัสผ่านอย่างน้อย 8 ตัวอักษร');
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('ไม่พบหน่วยงาน');
    const em = this.orgRepo.manager;
    let target: any;
    if (dto.userId) {
      [target] = await em.query(`SELECT id, username FROM users WHERE id = $1 AND organization_id = $2`, [dto.userId, id]);
    } else if (dto.username) {
      [target] = await em.query(`SELECT id, username FROM users WHERE username = $1 AND organization_id = $2`, [dto.username, id]);
    } else {
      [target] = await em.query(
        `SELECT u.id, u.username FROM users u
         JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
         WHERE u.organization_id = $1 AND r.name IN ('ADMIN','SUPER_ADMIN')
         ORDER BY u.created_at LIMIT 1`, [id]);
      if (!target)
        [target] = await em.query(`SELECT id, username FROM users WHERE organization_id = $1 ORDER BY created_at LIMIT 1`, [id]);
    }
    if (!target) throw new NotFoundException('ไม่พบผู้ใช้ในหน่วยงานนี้');
    await em.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [await hashPassword(dto.password), target.id]);
    return { userId: target.id, username: target.username };
  }

  /**
   * ล้างเรื่องแจ้ง/ร้องเรียนทั้งหมดของหน่วยงาน (SUPER_ADMIN) — ใช้เคลียร์ข้อมูลทดสอบก่อนเปิดใช้จริง
   * citizen_reports ไม่มีตารางอื่นอ้างถึง ลบตารางเดียวพอ · ต้องพิมพ์รหัสหน่วยงานตรงเป๊ะ (กันลบผิดเจ้า)
   * เลขอ้างอิงนับจากจำนวนเรื่องที่มี → ล้างแล้วเรื่องถัดไปเริ่ม R..-00001 ใหม่เอง
   * ไฟล์รูปแนบบนดิสก์ไม่ลบ (ไม่มีลิงก์เหลือใน DB แล้ว เปิดไม่ได้) — กันลบไฟล์ผิดโฟลเดอร์บน production
   */
  async clearCitizenReports(id: string, confirm: string) {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('ไม่พบหน่วยงาน');
    if (String(confirm || '').trim() !== org.code) throw new BadRequestException(`รหัสยืนยันไม่ตรง — ต้องพิมพ์ "${org.code}"`);
    // ความเห็นภายใน + เอกสารที่เจ้าหน้าที่อัปโหลดมาเซ็น ลบตามไปด้วย (ไม่ให้เหลือแถวค้างที่อ้างถึงเรื่องที่ลบแล้ว)
    await this.orgRepo.manager.query(`DELETE FROM citizen_report_comments WHERE report_id IN (SELECT id FROM citizen_reports WHERE organization_id = $1)`, [id]);
    await this.orgRepo.manager.query(`DELETE FROM file_uploads WHERE ref_type = 'citizen-report' AND ref_id IN (SELECT id FROM citizen_reports WHERE organization_id = $1)`, [id]);
    const res = await this.orgRepo.manager.query(`DELETE FROM citizen_reports WHERE organization_id = $1`, [id]);
    // pg driver ผ่าน TypeORM คืน [rows, rowCount]
    const deleted = Array.isArray(res) && typeof res[1] === 'number' ? res[1] : 0;
    return { deleted, code: org.code, nameTh: org.nameTh };
  }

  /**
   * ลบหน่วยงาน (SUPER_ADMIN) — กันลบเจ้าที่มีข้อมูลใช้งานจริง (ให้ปิดใช้งานแทน)
   * ลบได้เฉพาะเจ้าว่าง (ไม่มีทะเบียนน้ำ/สารบรรณ/บุคลากร/ร้องเรียน) → เคลียร์ user + ทุกตารางที่ผูก org ใน transaction เดียว
   */
  async removeOrg(id: string) {
    const org = await this.orgRepo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('ไม่พบหน่วยงาน');
    const em = this.orgRepo.manager;
    const [c] = await em.query(`
      SELECT
        (SELECT COUNT(*)::int FROM water_customers WHERE organization_id = $1) AS water,
        (SELECT COUNT(*)::int FROM correspondence_tickets WHERE organization_id = $1) AS tickets,
        (SELECT COUNT(*)::int FROM employees WHERE organization_id = $1) AS employees,
        (SELECT COUNT(*)::int FROM complaints WHERE organization_id = $1) AS complaints`, [id]);
    const dataCount = (c.water || 0) + (c.tickets || 0) + (c.employees || 0) + (c.complaints || 0);
    if (dataCount > 0)
      throw new ConflictException(
        `ลบไม่ได้ — หน่วยงานนี้มีข้อมูลใช้งานแล้ว (ทะเบียนน้ำ ${c.water} · สารบรรณ ${c.tickets} · บุคลากร ${c.employees} · ร้องเรียน ${c.complaints}) กรุณาปิดใช้งานแทนการลบ`);
    return em.transaction(async (t) => {
      await t.query(`DELETE FROM user_roles ur USING users u WHERE ur.user_id = u.id AND u.organization_id = $1`, [id]);
      await t.query(`DELETE FROM user_permissions up USING users u WHERE up.user_id = u.id AND u.organization_id = $1`, [id]);
      await t.query(`DELETE FROM divisions d USING departments dp WHERE d.department_id = dp.id AND dp.organization_id = $1`, [id]);
      const tbls: any[] = await t.query(
        `SELECT table_name FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name = 'organization_id'
           AND table_name NOT IN ('organizations','users')`);
      for (const { table_name } of tbls) await t.query(`DELETE FROM "${table_name}" WHERE organization_id = $1`, [id]);
      await t.query(`DELETE FROM users WHERE organization_id = $1`, [id]);
      await t.query(`DELETE FROM organizations WHERE id = $1`, [id]);
      return { deleted: true, code: org.code, nameTh: org.nameTh };
    });
  }

  /** normalize host: ตัด port, พอร์ต, www., ตัวพิมพ์เล็ก */
  static normHost(host?: string): string {
    return String(host || '').toLowerCase().split(':')[0].replace(/^www\./, '').trim();
  }

  /** หา org จากโดเมนที่เข้ามา (Host header) — คืน id หรือ null ถ้าไม่ผูกโดเมนไหน */
  async orgIdByHost(host?: string): Promise<string | null> {
    const h = OrganizationsService.normHost(host);
    if (!h) return null;
    const [row] = await this.orgRepo.query(
      `SELECT id FROM organizations WHERE is_active = true AND $1 = ANY(hostnames) LIMIT 1`, [h]);
    return row?.id ?? null;
  }

  /** ช่องทางติดต่อสำหรับหน้าประชาชน (metadata.contact ตั้งที่หน้าตั้งค่าองค์กร) — ส่งเฉพาะช่องที่รู้จัก */
  static publicContact(meta: any) {
    const c = meta?.contact || {};
    const s = (v: unknown, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
    return { lineId: s(c.lineId, 60), lineUrl: s(c.lineUrl), facebookUrl: s(c.facebookUrl), mapUrl: s(c.mapUrl, 600), hours: s(c.hours, 120) };
  }

  /** ข้อมูลแบรนด์สาธารณะของ อบต. ตามโดเมน (ใช้ก่อนล็อกอิน — โชว์ชื่อ/โลโก้/รหัสองค์กรให้หน้า login) */
  async publicByHost(host?: string) {
    const id = await this.orgIdByHost(host);
    if (!id) return { found: false };
    const o = await this.orgRepo.findOne({ where: { id } });
    if (!o) return { found: false };
    return {
      found: true, code: o.code, nameTh: o.nameTh, nameEn: o.nameEn, logoUrl: o.logoUrl, province: o.province,
      phone: o.phone || null, address: o.address || null, email: o.email || null, website: o.website || null,
      contact: OrganizationsService.publicContact(o.metadata),
    };
  }

  async getDepartments(orgId: string, includeHidden = false) {
    const where: any = { organizationId: orgId, isActive: true, deletedAt: null };
    if (!includeHidden) where.hiddenFromForms = false;
    return this.deptRepo.find({
      where,
      order: { orderNo: 'ASC', nameTh: 'ASC' },
    });
  }

  async createDepartment(orgId: string, dto: any) {
    const existing = await this.deptRepo.findOne({
      where: { organizationId: orgId, code: dto.code },
    });
    if (existing) throw new ConflictException('รหัสกองนี้มีในระบบแล้ว');
    return this.deptRepo.save({ ...dto, organizationId: orgId });
  }

  async updateDepartment(id: string, dto: any) {
    const dept = await this.deptRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('ไม่พบกอง');
    Object.assign(dept, dto);
    return this.deptRepo.save(dept);
  }

  async deleteDepartment(id: string) {
    const dept = await this.deptRepo.findOne({ where: { id } });
    if (!dept) throw new NotFoundException('ไม่พบกอง');
    // กันลบถ้ายังมีบุคลากรสังกัดอยู่ (กัน orphan)
    const rows = await this.deptRepo.manager.query(
      `SELECT COUNT(*)::int AS c FROM users WHERE department_id = $1 AND is_active = true AND deleted_at IS NULL`,
      [id],
    );
    if ((rows[0]?.c || 0) > 0) {
      throw new ConflictException(`ยังมีบุคลากร ${rows[0].c} คนสังกัดกองนี้ — กรุณาย้ายออกก่อนลบ`);
    }
    await this.deptRepo.update(id, { isActive: false });
    return { message: 'ลบกองสำเร็จ' };
  }

  async getDivisions(deptId: string) {
    return this.divRepo.find({
      where: { departmentId: deptId, isActive: true, deletedAt: null },
      order: { orderNo: 'ASC', nameTh: 'ASC' },
    });
  }

  async createDivision(deptId: string, dto: any) {
    return this.divRepo.save({ ...dto, departmentId: deptId });
  }
}
