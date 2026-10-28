import {
  Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { Role } from '../../database/entities/role.entity';
import { Permission } from '../../database/entities/permission.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { Employee } from '../../database/entities/employee.entity';
import { LeaveType } from '../../database/entities/leave-type.entity';
import { LeaveQuota } from '../../database/entities/leave-quota.entity';
import { CreateUserDto, UpdateUserDto, UserQueryDto } from './dto/user.dto';
import { paginate } from '../../common/dto/pagination.dto';
import { hashPassword, generateTempPassword } from '../../common/utils/hash.util';
import { getCurrentThaiYear } from '../../common/utils/date.util';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(UserRole) private userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
    @InjectRepository(UserPermission) private userPermRepo: Repository<UserPermission>,
    @InjectRepository(RolePermission) private rolePermRepo: Repository<RolePermission>,
  ) {}

  async findAll(orgId: string, dto: UserQueryDto) {
    // ใช้ชื่อ property (camelCase) กับ where/orderBy — TypeORM ต้อง map เป็นคอลัมน์ให้ตอน paginate (skip/take + join)
    const qb = this.userRepo.createQueryBuilder('u')
      .leftJoinAndSelect('u.department', 'department')
      .leftJoinAndSelect('u.division', 'division')
      .where('u.organizationId = :orgId', { orgId })
      .andWhere('u.deletedAt IS NULL');

    if (dto.search) {
      qb.andWhere('(u.fullNameTh ILIKE :s OR u.username ILIKE :s OR u.positionName ILIKE :s)', { s: `%${dto.search}%` });
    }
    if (dto.deptId) qb.andWhere('u.departmentId = :dept', { dept: dto.deptId });
    if (dto.roleId) {
      qb.andWhere('EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role_id = :roleId)', { roleId: dto.roleId });
    }
    if (dto.status === 'active') qb.andWhere('u.isActive = true AND (u.lockedUntil IS NULL OR u.lockedUntil <= NOW())');
    else if (dto.status === 'suspended') qb.andWhere('u.isActive = false');
    else if (dto.status === 'locked') qb.andWhere('u.lockedUntil IS NOT NULL AND u.lockedUntil > NOW()');

    qb.orderBy('u.createdAt', 'DESC').skip(dto.skip).take(dto.limit);
    const [data, total] = await qb.getManyAndCount();
    return paginate(data.map(this.sanitize), total, dto);
  }

  /** รายชื่อผู้ใช้แบบย่อสำหรับเลือก (ประธาน/เลขาฯ/ผู้อนุมัติ/ผู้รับมอบหมาย) — ผู้ใช้ทุกคนเรียกได้ */
  async findSelectable(orgId: string) {
    return this.userRepo.find({
      where: { organizationId: orgId, isActive: true, deletedAt: null },
      select: ['id', 'username', 'fullNameTh', 'titleTh', 'positionName', 'departmentId'],
      order: { fullNameTh: 'ASC' },
    });
  }

  /**
   * โครงสร้างองค์กรแบบ Tree สำหรับ People Picker:
   * ฝ่าย/กลุ่ม (group) → กอง (department) → งาน (division) → บุคลากร
   */
  async findOrgTree(orgId: string) {
    const [depts, divs, users] = await Promise.all([
      this.userRepo.manager.query(
        // ไม่เอากองที่ตั้งค่าให้ซ่อนจากหน้าบุคลากร (เช่น กองที่พักบัญชีระบบ) — ดู hidden_from_directory
        `SELECT id, code, name_th AS "nameTh", group_label AS "groupLabel", dept_type AS "deptType", order_no AS "orderNo"
         FROM departments
          WHERE organization_id = $1 AND deleted_at IS NULL AND is_active = true AND hidden_from_directory = false
          ORDER BY order_no, name_th`, [orgId]),
      this.userRepo.manager.query(
        `SELECT id, code, name_th AS "nameTh", department_id AS "departmentId", order_no AS "orderNo"
         FROM divisions WHERE deleted_at IS NULL ORDER BY order_no, name_th`),
      this.userRepo.find({
        where: { organizationId: orgId, isActive: true, deletedAt: null },
        select: ['id', 'fullNameTh', 'titleTh', 'positionName', 'avatarUrl', 'departmentId', 'divisionId'],
        order: { fullNameTh: 'ASC' },
      }),
    ]);

    const usersByDept = new Map<string, any[]>();
    const usersByDiv = new Map<string, any[]>();
    for (const u of users) {
      if (u.divisionId) {
        if (!usersByDiv.has(u.divisionId)) usersByDiv.set(u.divisionId, []);
        usersByDiv.get(u.divisionId)!.push(u);
      } else if (u.departmentId) {
        if (!usersByDept.has(u.departmentId)) usersByDept.set(u.departmentId, []);
        usersByDept.get(u.departmentId)!.push(u);
      }
    }

    const groups = new Map<string, any>();
    for (const d of depts) {
      const groupName = d.groupLabel || 'อื่นๆ';
      if (!groups.has(groupName)) groups.set(groupName, { group: groupName, departments: [] });
      groups.get(groupName).departments.push({
        id: d.id, code: d.code, nameTh: d.nameTh, deptType: d.deptType,
        divisions: divs
          .filter((v: any) => v.departmentId === d.id)
          .map((v: any) => ({ id: v.id, code: v.code, nameTh: v.nameTh, users: usersByDiv.get(v.id) || [] })),
        users: usersByDept.get(d.id) || [],
      });
    }
    return Array.from(groups.values());
  }

  /**
   * ไดเรกทอรีบุคลากร (แบบโฟลเดอร์) + สถานะวันนี้ของแต่ละคน:
   *   ลา = มีใบลาอนุมัติครอบคลุมวันนี้, ประชุม = มีประชุมวันนี้, ไม่งั้น = มา
   */
  async findDirectory(orgId: string) {
    const tree = await this.findOrgTree(orgId);
    const onLeave = new Set<string>();
    const inMeeting = new Set<string>();
    try {
      const lv = await this.userRepo.manager.query(
        `SELECT DISTINCT e.user_id AS id FROM leave_requests lr
         JOIN employees e ON e.id = lr.employee_id
         WHERE lr.organization_id = $1 AND lr.status = 'อนุมัติแล้ว'
           AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date AND e.user_id IS NOT NULL`, [orgId]);
      lv.forEach((r: any) => onLeave.add(r.id));
    } catch { /* ไม่มีข้อมูลลา */ }
    try {
      const mt = await this.userRepo.manager.query(
        `SELECT DISTINCT uid FROM (
           SELECT chair_id AS uid FROM meetings WHERE organization_id = $1 AND start_datetime::date = CURRENT_DATE AND status <> 'ยกเลิก'
           UNION
           SELECT ma.user_id FROM meeting_attendees ma JOIN meetings m ON m.id = ma.meeting_id
             WHERE m.organization_id = $1 AND m.start_datetime::date = CURRENT_DATE AND m.status <> 'ยกเลิก'
         ) x WHERE uid IS NOT NULL`, [orgId]);
      mt.forEach((r: any) => inMeeting.add(r.uid));
    } catch { /* ไม่มีข้อมูลประชุม */ }

    const annotate = (u: any) => ({ ...u, status: onLeave.has(u.id) ? 'ลา' : inMeeting.has(u.id) ? 'ประชุม' : 'มา' });
    for (const g of tree) for (const d of g.departments) {
      d.users = d.users.map(annotate);
      for (const v of d.divisions) v.users = v.users.map(annotate);
    }
    return tree;
  }

  /** C5 — ปฏิทินบุคลากร: ใครลา/ประชุมวันนี้ + การลาที่กำลังจะมาถึง */
  async staffAway(orgId: string) {
    const q = (sql: string) => this.userRepo.manager.query(sql, [orgId]).catch(() => []);
    const [leaveToday, meetingToday, upcomingLeave] = await Promise.all([
      q(`SELECT e.title, e.first_name_th AS "firstName", e.last_name_th AS "lastName",
                lt.name_th AS type, lr.start_date AS "startDate", lr.end_date AS "endDate"
         FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
         LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
         WHERE lr.organization_id = $1 AND lr.status = 'อนุมัติแล้ว'
           AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date ORDER BY lr.end_date`),
      q(`SELECT m.title, m.start_datetime AS "startDatetime", m.location, u.full_name_th AS chair
         FROM meetings m LEFT JOIN users u ON u.id = m.chair_id
         WHERE m.organization_id = $1 AND m.start_datetime::date = CURRENT_DATE AND m.status <> 'ยกเลิก'
         ORDER BY m.start_datetime`),
      q(`SELECT e.title, e.first_name_th AS "firstName", e.last_name_th AS "lastName",
                lt.name_th AS type, lr.start_date AS "startDate", lr.end_date AS "endDate"
         FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
         LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
         WHERE lr.organization_id = $1 AND lr.status = 'อนุมัติแล้ว'
           AND lr.start_date > CURRENT_DATE AND lr.start_date <= CURRENT_DATE + 7 ORDER BY lr.start_date`),
    ]);
    return { leaveToday, meetingToday, upcomingLeave };
  }

  /**
   * โปรไฟล์บุคลากร (ทุกคนดูได้) — เฉพาะข้อมูลที่เปิดเผยได้ + สถานะวันนี้
   * ไม่รวมข้อมูลส่วนตัว (เลขบัตร/เงินเดือน/ที่อยู่/วันเกิด) — มีเบอร์/อีเมล/รูปได้
   */
  async getPublicProfile(id: string, orgId: string) {
    const u = await this.userRepo.findOne({
      where: { id, organizationId: orgId },
      relations: ['department', 'division'],
    });
    if (!u) throw new NotFoundException('ไม่พบบุคลากร');

    const isToday = async (sql: string) => {
      try { const r = await this.userRepo.manager.query(sql, [id]); return r.length > 0; } catch { return false; }
    };
    const onLeave = await isToday(
      `SELECT 1 FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
       WHERE e.user_id = $1 AND lr.status = 'อนุมัติแล้ว' AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date LIMIT 1`);
    const inMeeting = onLeave ? false : await isToday(
      `SELECT 1 FROM meetings m WHERE (m.chair_id = $1 OR EXISTS (
         SELECT 1 FROM meeting_attendees ma WHERE ma.meeting_id = m.id AND ma.user_id = $1))
       AND m.start_datetime::date = CURRENT_DATE AND m.status <> 'ยกเลิก' LIMIT 1`);

    return {
      id: u.id,
      titleTh: u.titleTh,
      fullNameTh: u.fullNameTh,
      fullNameEn: u.fullNameEn,
      positionName: u.positionName,
      avatarUrl: u.avatarUrl,
      phone: u.phone,
      email: u.email,
      department: u.department ? { id: u.department.id, nameTh: u.department.nameTh, groupLabel: (u.department as any).groupLabel } : null,
      division: u.division ? { id: u.division.id, nameTh: u.division.nameTh } : null,
      status: onLeave ? 'ลา' : inMeeting ? 'ประชุม' : 'มา',
    };
  }

  async findOne(id: string, orgId: string) {
    const user = await this.userRepo.findOne({
      where: { id, organizationId: orgId },
      relations: ['department', 'division', 'organization'],
    });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้');
    return this.sanitize(user);
  }

  async create(dto: CreateUserDto, orgId: string, createdBy: string) {
    const email = dto.email?.trim() || `${dto.username}@smartgov.local`;
    const existing = await this.userRepo.findOne({
      where: [{ username: dto.username }, { email }],
    });
    if (existing) throw new ConflictException('ชื่อผู้ใช้หรืออีเมลนี้มีในระบบแล้ว');

    // Purge any soft-deleted user that would block the unique constraint
    // (ปลดลิงก์ employees.user_id ก่อน ไม่งั้น DELETE ติด FK)
    const em = this.userRepo.manager;
    await em.query(
      `UPDATE employees SET user_id = NULL WHERE user_id IN (
         SELECT id FROM users WHERE (username = $1 OR email = $2) AND deleted_at IS NOT NULL)`,
      [dto.username, email],
    );
    await em.query(
      `DELETE FROM users WHERE (username = $1 OR email = $2) AND deleted_at IS NOT NULL`,
      [dto.username, email],
    );

    const passwordHash = await hashPassword(dto.password);
    const user = this.userRepo.create({
      ...dto,
      email,
      passwordHash,
      organizationId: orgId,
      createdBy,
    });

    const saved = await this.userRepo.save(user);
    // ถ้าสร้าง employee ไม่สำเร็จ ไม่ต้อง fail ทั้งก้อน — admin ผูกเองได้ในหน้า HR
    await this.ensureEmployee(saved, dto).catch((e) =>
      console.error(`สร้างข้อมูลพนักงานอัตโนมัติให้ ${dto.username} ไม่สำเร็จ:`, e?.message),
    );
    return this.sanitize(saved);
  }

  /**
   * สร้างข้อมูลพนักงาน (HR) ผูกกับบัญชีให้อัตโนมัติ + โควตาวันลาปีปัจจุบัน
   * ระบบลาหา employee จาก user_id — บัญชีที่ไม่มีจะยื่นใบลาไม่ได้ ("ไม่พบข้อมูลพนักงาน")
   * เลขบัตร/รหัสพนักงานใส่ค่าชั่วคราวไว้ก่อน ให้แก้จริงในหน้า HR ภายหลัง
   */
  private async ensureEmployee(user: User, dto: CreateUserDto) {
    const em = this.userRepo.manager;
    const empRepo = em.getRepository(Employee);
    if (await empRepo.findOne({ where: { userId: user.id } })) return;

    const [firstNameTh, ...rest] = (dto.fullNameTh || '').trim().split(/\s+/);
    const base: Partial<Employee> = {
      organizationId: user.organizationId,
      userId: user.id,
      title: dto.titleTh,
      firstNameTh: firstNameTh || dto.username,
      lastNameTh: rest.join(' ') || '-',
      departmentId: dto.departmentId,
      divisionId: dto.divisionId,
      positionName: dto.positionName,
      phone: dto.phone,
      employeeType: 'พนักงานส่วนตำบล',
      hireDate: new Date(),
    };
    let emp: Employee;
    try {
      // national_id เป็น VARCHAR(13) UNIQUE — Date.now() ได้ 13 หลักพอดี
      emp = await empRepo.save(empRepo.create({
        ...base,
        employeeCode: `EMP-${dto.username}`.slice(0, 50),
        nationalId: String(Date.now()),
      }));
    } catch {
      // รหัสพนักงาน/เลขบัตรชน (เช่น เคยมี EMP-<username> ค้าง) — ลองอีกครั้งด้วยค่าจาก timestamp
      emp = await empRepo.save(empRepo.create({
        ...base,
        employeeCode: `EMP-${Date.now()}`,
        nationalId: String(Date.now() + Math.floor(Math.random() * 86400000)).slice(0, 13),
      }));
    }

    // โควตาวันลาปีปัจจุบัน (แบบเดียวกับ seed) — พลาดได้ไม่ต้อง fail การสร้างผู้ใช้
    try {
      const types = await em.getRepository(LeaveType).find({
        where: [
          { organizationId: user.organizationId, isActive: true },
          { organizationId: null as any, isActive: true },
        ],
      });
      const year = getCurrentThaiYear();
      const quotaRepo = em.getRepository(LeaveQuota);
      if (types.length) {
        await quotaRepo.save(types.map((lt) => quotaRepo.create({
          employeeId: emp.id, leaveTypeId: lt.id, year,
          totalDays: lt.maxDaysYear || 10, usedDays: 0,
        })));
      }
    } catch {}
  }

  async update(id: string, dto: UpdateUserDto, orgId: string) {
    const user = await this.userRepo.findOne({ where: { id, organizationId: orgId } });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้');

    if (dto.password) {
      (dto as any).passwordHash = await hashPassword(dto.password);
      delete dto.password;
    }

    Object.assign(user, dto);
    const saved = await this.userRepo.save(user);
    return this.sanitize(saved);
  }

  async remove(id: string, orgId: string) {
    const user = await this.userRepo.findOne({ where: { id, organizationId: orgId } });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้');

    const adminUser = await this.userRepo.findOne({ where: { username: 'admin' } });

    // เคลียร์ FK ทั้งหมดในทรานแซกชันเดียว — ถ้าพังกลางทางจะ rollback ทั้งก้อน
    // (กันสภาพข้อมูลค้างครึ่งๆ กลางๆ)
    await this.userRepo.manager.transaction(async (em) => {
      // Delete records owned by / linked to this user
      await em.query(`DELETE FROM user_permissions WHERE user_id = $1`, [id]);
      await em.query(`DELETE FROM user_roles WHERE user_id = $1`, [id]);
      await em.query(`DELETE FROM notifications WHERE recipient_id = $1`, [id]);
      await em.query(`DELETE FROM signature_logs WHERE user_id = $1`, [id]);
      await em.query(`DELETE FROM user_signatures WHERE user_id = $1`, [id]);
      await em.query(`DELETE FROM meeting_attendees WHERE user_id = $1`, [id]);

      // Nullify nullable FK columns that reference this user
      await em.query(`UPDATE user_permissions SET granted_by = NULL WHERE granted_by = $1`, [id]);
      await em.query(`UPDATE user_roles SET assigned_by = NULL WHERE assigned_by = $1`, [id]);
      await em.query(`UPDATE meetings SET secretary_id = NULL WHERE secretary_id = $1`, [id]);
      if (adminUser) {
        await em.query(`UPDATE meetings SET chair_id = $2 WHERE chair_id = $1`, [id, adminUser.id]);
      }
      await em.query(`UPDATE approval_requests SET current_approver_id = NULL WHERE current_approver_id = $1`, [id]);
      await em.query(`UPDATE leave_requests SET current_approver_id = NULL WHERE current_approver_id = $1`, [id]);
      await em.query(`UPDATE incoming_documents SET assigned_to = NULL WHERE assigned_to = $1`, [id]);
      await em.query(`UPDATE outgoing_documents SET signer_id = NULL WHERE signer_id = $1`, [id]);
      await em.query(`UPDATE complaints SET user_id = NULL WHERE user_id = $1`, [id]);
      await em.query(`UPDATE complaints SET assigned_user_id = NULL WHERE assigned_user_id = $1`, [id]);
      await em.query(`UPDATE complaints SET received_by = NULL WHERE received_by = $1`, [id]);
      await em.query(`UPDATE meeting_agenda_items SET presenter_id = NULL WHERE presenter_id = $1`, [id]);
      await em.query(`UPDATE meeting_resolutions SET responsible_id = NULL WHERE responsible_id = $1`, [id]);
      await em.query(`UPDATE asset_transfers SET approved_by = NULL WHERE approved_by = $1`, [id]);
      await em.query(`UPDATE system_settings SET updated_by = NULL WHERE updated_by = $1`, [id]);
      await em.query(`UPDATE departments SET head_user_id = NULL WHERE head_user_id = $1`, [id]);
      await em.query(`UPDATE employees SET user_id = NULL WHERE user_id = $1`, [id]);

      // ตารางใหม่ (เดิมตกหล่น) — budget/project/tax/welfare/procurement
      await em.query(`UPDATE budgets SET created_by = NULL WHERE created_by = $1`, [id]);
      await em.query(`UPDATE budgets SET approved_by = NULL WHERE approved_by = $1`, [id]);
      await em.query(`UPDATE projects SET created_by = NULL WHERE created_by = $1`, [id]);
      await em.query(`UPDATE projects SET project_manager_id = NULL WHERE project_manager_id = $1`, [id]);
      await em.query(`UPDATE tax_records SET collected_by = NULL WHERE collected_by = $1`, [id]);
      await em.query(`UPDATE welfare_recipients SET registered_by = NULL WHERE registered_by = $1`, [id]);
      await em.query(`UPDATE procurements SET created_by = NULL WHERE created_by = $1`, [id]);
      await em.query(`UPDATE procurements SET approved_by = NULL WHERE approved_by = $1`, [id]);
    });

    // ลบจริง (single statement, atomic); ถ้ายังติด NOT NULL FK ที่ผู้ใช้เป็นผู้สร้าง → soft delete
    // ทำนอกทรานแซกชันด้านบนเพื่อเลี่ยงปัญหา "transaction aborted" ของ Postgres เมื่อ delete ล้มเหลว
    try {
      await this.userRepo.delete(id);
    } catch {
      await this.userRepo.softDelete(id);
    }

    return { message: 'ลบผู้ใช้สำเร็จ' };
  }

  async assignRole(userId: string, roleId: string, assignedBy: string, actingRoles: string[] = []) {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('ไม่พบบทบาท');

    // กันแตะ root: มีแต่ SUPER_ADMIN ที่แจกบทบาท SUPER_ADMIN ได้ (ADMIN จัดการบทบาทอื่นรวม ADMIN ได้)
    if (role.name === 'SUPER_ADMIN' && !actingRoles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('ไม่มีสิทธิ์กำหนดบทบาทผู้ดูแลระบบสูงสุด');
    }

    const existing = await this.userRoleRepo.findOne({ where: { userId, roleId } });
    if (existing) throw new ConflictException('ผู้ใช้มีบทบาทนี้อยู่แล้ว');

    await this.userRoleRepo.save({ userId, roleId, assignedBy });
    return { message: 'กำหนดบทบาทสำเร็จ' };
  }

  async removeRole(userId: string, roleId: string, actingRoles: string[] = []) {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    // กันถอดบทบาท root (SUPER_ADMIN) เพื่อยึดอำนาจ/ล็อกเอาต์
    if (role && role.name === 'SUPER_ADMIN' && !actingRoles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('ไม่มีสิทธิ์ถอดบทบาทผู้ดูแลระบบสูงสุด');
    }
    await this.userRoleRepo.delete({ userId, roleId });
    return { message: 'ถอดบทบาทสำเร็จ' };
  }

  /** ชุด permissionId ที่ผู้ใช้มีจริง = สิทธิ์บทบาท ∪ override รายคน (ตรงกับ getEffectivePermissions) */
  private async effectivePermIdSet(userId: string): Promise<Set<string>> {
    const direct = await this.userPermRepo.find({ where: { userId } });
    const ids = new Set(direct.map((d) => d.permissionId));
    const roles = await this.userRoleRepo.find({ where: { userId } });
    const roleIds = roles.map((r) => r.roleId);
    if (roleIds.length) {
      const rp = await this.rolePermRepo.find({ where: roleIds.map((id) => ({ roleId: id })) });
      rp.forEach((r) => ids.add(r.permissionId));
    }
    return ids;
  }

  /** ตั้งบทบาทเดียวให้ผู้ใช้ (แทนที่บทบาทเดิมทั้งหมด) — ใช้ในหน้าจัดการผู้ใช้ */
  async setUserRole(userId: string, roleId: string, assignedBy: string, actingRoles: string[] = []) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้');
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('ไม่พบบทบาท');
    if (role.name === 'SUPER_ADMIN' && !actingRoles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('ไม่มีสิทธิ์กำหนดบทบาทผู้ดูแลระบบสูงสุด');
    }
    // กันเปลี่ยนบทบาทของ root (SUPER_ADMIN) ผ่านการ "แทนที่"
    const current = await this.userRoleRepo.find({ where: { userId }, relations: ['role'] });
    const hasSuperRole = current.some((ur) => ur.role.name === 'SUPER_ADMIN');
    if (hasSuperRole && !actingRoles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('ไม่มีสิทธิ์เปลี่ยนบทบาทของผู้ดูแลระบบสูงสุด');
    }
    await this.userRoleRepo.delete({ userId });
    await this.userRoleRepo.save(this.userRoleRepo.create({ userId, roleId, assignedBy }));
    return { message: 'กำหนดบทบาทสำเร็จ' };
  }

  /** ปลดล็อกบัญชีที่ถูกระงับจากการใส่รหัสผิดเกินกำหนด */
  async unlockUser(userId: string, orgId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId, organizationId: orgId } });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้');
    await this.userRepo.update(userId, { failedLoginCount: 0, lockedUntil: null as any });
    return { message: 'ปลดล็อกบัญชีสำเร็จ' };
  }

  async getUserRoles(userId: string) {
    return this.userRoleRepo.find({
      where: { userId },
      relations: ['role'],
    });
  }

  async listRoles() {
    return this.roleRepo.find({ order: { level: 'DESC' } });
  }

  /** สร้างบทบาทใหม่ (custom ขององค์กร) */
  async createRole(dto: { nameTh: string; description?: string; level?: number }, orgId: string) {
    const nameTh = (dto.nameTh || '').trim();
    if (!nameTh) throw new BadRequestException('กรุณาระบุชื่อบทบาท');
    const dup = await this.roleRepo.findOne({ where: { nameTh } });
    if (dup) throw new ConflictException('มีบทบาทชื่อนี้อยู่แล้ว');
    // internal name เป็นรหัสไม่ซ้ำ (ระบบอ้างอิงด้วย nameTh ในหน้าจอ)
    const name = `CUSTOM_${Date.now().toString(36).toUpperCase()}`;
    const role = await this.roleRepo.save(this.roleRepo.create({
      name, nameTh, description: dto.description?.trim() || null as any,
      level: typeof dto.level === 'number' ? dto.level : 20,
      isSystem: false, organizationId: orgId,
    }));
    return { message: 'สร้างบทบาทสำเร็จ', role };
  }

  /** แก้ชื่อ/รายละเอียด/ระดับ ของบทบาท (ห้ามแก้บทบาทระบบ) */
  async updateRoleInfo(id: string, dto: { nameTh?: string; description?: string; level?: number }) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('ไม่พบบทบาท');
    if (role.isSystem) throw new ForbiddenException('บทบาทระบบแก้ไขไม่ได้');
    if (dto.nameTh !== undefined) {
      const nameTh = dto.nameTh.trim();
      if (!nameTh) throw new BadRequestException('ชื่อบทบาทห้ามว่าง');
      const dup = await this.roleRepo.findOne({ where: { nameTh } });
      if (dup && dup.id !== id) throw new ConflictException('มีบทบาทชื่อนี้อยู่แล้ว');
      role.nameTh = nameTh;
    }
    if (dto.description !== undefined) role.description = dto.description.trim() || (null as any);
    if (typeof dto.level === 'number') role.level = dto.level;
    await this.roleRepo.save(role);
    return { message: 'บันทึกบทบาทสำเร็จ', role };
  }

  /** ลบบทบาท (ห้ามลบบทบาทระบบ + ห้ามลบเมื่อมีผู้ใช้ผูกอยู่) */
  async deleteRole(id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('ไม่พบบทบาท');
    if (role.isSystem) throw new ForbiddenException('บทบาทระบบลบไม่ได้');
    const inUse = await this.userRoleRepo.count({ where: { roleId: id } });
    if (inUse > 0) throw new ConflictException(`ลบไม่ได้ — ยังมีผู้ใช้ ${inUse} คนใช้บทบาทนี้อยู่`);
    await this.rolePermRepo.delete({ roleId: id });
    await this.roleRepo.delete({ id });
    return { message: 'ลบบทบาทสำเร็จ' };
  }

  async listPermissions() {
    return this.permRepo.find({ order: { module: 'ASC', action: 'ASC' } });
  }

  /** สิทธิ์ปัจจุบันของบทบาท (คืน array ของ permissionId) */
  async getRolePermissions(roleId: string) {
    const rows = await this.rolePermRepo.find({ where: { roleId } });
    return rows.map((r) => r.permissionId);
  }

  /** ตั้งชุดสิทธิ์ของบทบาทใหม่ทั้งหมด (แทนที่ของเดิม) — มีการป้องกัน role สำคัญ */
  async setRolePermissions(roleId: string, permissionIds: string[], actingRoles: string[]) {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('ไม่พบบทบาท');
    if (role.name === 'SUPER_ADMIN') {
      throw new ForbiddenException('แก้ไขสิทธิ์ของผู้ดูแลระบบสูงสุดไม่ได้ (มีสิทธิ์ทั้งหมดเสมอ)');
    }
    const ids = Array.isArray(permissionIds) ? permissionIds : [];
    const valid = ids.length ? await this.permRepo.find({ where: { id: In(ids) } }) : [];
    await this.rolePermRepo.delete({ roleId });
    if (valid.length) {
      await this.rolePermRepo.save(valid.map((p) => this.rolePermRepo.create({ roleId, permissionId: p.id })));
    }
    return { message: 'บันทึกสิทธิ์ของบทบาทแล้ว', count: valid.length };
  }

  async getUserPermissions(userId: string) {
    return this.userPermRepo.find({
      where: { userId },
      relations: ['permission'],
    });
  }

  /** สิทธิ์ที่มีผลจริง = สิทธิ์ของบทบาท ∪ สิทธิ์เพิ่มรายคน (override เพิ่มได้อย่างเดียว) */
  async getEffectivePermissions(userId: string) {
    const userRoles = await this.userRoleRepo.find({ where: { userId }, relations: ['role'] });
    const roleIds = userRoles.map(ur => ur.roleId);
    const roleNames = userRoles.map(ur => ur.role.name);

    let rolePerms: any[] = [];
    if (roleIds.length > 0) {
      const rps = await this.rolePermRepo.find({
        where: roleIds.map(id => ({ roleId: id })),
        relations: ['permission'],
      });
      rolePerms = rps.map(rp => rp.permission);
    }
    const directPerms = await this.userPermRepo.find({ where: { userId }, relations: ['permission'] });
    const overridePerms = directPerms.map(p => p.permission);

    const seen = new Set<string>();
    const permissions = [...rolePerms, ...overridePerms].filter(p => {
      const key = `${p.module}:${p.action}:${p.subject}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const source = roleNames.length > 0 ? 'role' : (overridePerms.length > 0 ? 'direct' : 'none');
    return { source, roles: roleNames, permissions, rolePermissions: rolePerms, overridePermissions: overridePerms };
  }

  async setUserPermissions(userId: string, permissionIds: string[], grantedBy: string, actingRoles: string[] = []) {
    const ids = Array.isArray(permissionIds) ? permissionIds : [];
    // กัน privilege amplification: ผู้ที่ไม่ใช่ SUPER_ADMIN ห้ามแจก direct permission
    // ที่ตัวเองไม่มี (ไม่งั้นจะลบล้างการกันสิทธิ์บทบาทใน setRolePermissions)
    if (ids.length && !actingRoles.includes('SUPER_ADMIN')) {
      const mine = await this.effectivePermIdSet(grantedBy);
      const over = ids.filter((id) => !mine.has(id));
      if (over.length) throw new ForbiddenException('ไม่สามารถให้สิทธิ์ที่ตนเองไม่มีได้');
    }
    await this.userPermRepo.delete({ userId });
    if (ids.length === 0) return { message: 'อัปเดตสิทธิ์สำเร็จ' };
    const perms = ids.map((permissionId) =>
      this.userPermRepo.create({ userId, permissionId, grantedBy }),
    );
    await this.userPermRepo.save(perms);
    return { message: 'อัปเดตสิทธิ์สำเร็จ' };
  }

  async resetPassword(userId: string, orgId: string, newPassword?: string) {
    const user = await this.userRepo.findOne({ where: { id: userId, organizationId: orgId } });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้');
    const pw = newPassword || generateTempPassword();
    const passwordHash = await hashPassword(pw);
    await this.userRepo.update(userId, { passwordHash });
    return newPassword
      ? { message: 'เปลี่ยนรหัสผ่านสำเร็จ' }
      : { tempPassword: pw, message: 'รีเซ็ตรหัสผ่านสำเร็จ' };
  }

  private sanitize(user: User) {
    const { passwordHash, twoFaSecret, lineNotifyToken, ...safe } = user as any;
    return safe;
  }
}
