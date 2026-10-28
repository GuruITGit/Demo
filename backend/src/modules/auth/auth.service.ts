import {
  Injectable, UnauthorizedException, BadRequestException,
  NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { RefreshToken } from '../../database/entities/refresh-token.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { UserPermission } from '../../database/entities/user-permission.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { comparePassword, hashPassword, sha256 } from '../../common/utils/hash.util';
import { LoginDto, ChangePasswordDto } from './dto/login.dto';
import { v4 as uuidv4 } from 'uuid';
import * as dayjs from 'dayjs';

@Injectable()
export class AuthService {
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MINUTES = 30;

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(UserRole) private userRoleRepo: Repository<UserRole>,
    @InjectRepository(RolePermission) private rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(UserPermission) private userPermissionRepo: Repository<UserPermission>,
    @InjectRepository(AuditLog) private auditRepo: Repository<AuditLog>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * @param opts.superAdminOnly คอนโซลเจ้าของระบบ (/hub) — ไม่ผูกกับ อบต. ใด และรับเฉพาะบัญชีที่มีบทบาท SUPER_ADMIN
   *   (กันบัญชีเจ้าหน้าที่ อบต. ล็อกอินเข้าคอนโซลผู้ขาย และตัดปัญหาชื่อผู้ใช้ซ้ำข้าม อบต.)
   */
  async login(dto: LoginDto, ip: string, userAgent: string, host?: string, opts?: { superAdminOnly?: boolean }) {
    // multi-tenant: จำกัด user เฉพาะ อบต. เดียว — มาจาก (1) รหัสองค์กรที่ส่งมา หรือ (2) โดเมนที่เปิด (Host)
    let orgId: string | undefined;
    if (opts?.superAdminOnly) {
      // ข้ามการผูก org โดยตั้งใจ — เจ้าของระบบไม่ได้สังกัด อบต. ใด อบต. หนึ่งในเชิงการใช้งาน
    } else if (dto.orgCode?.trim()) {
      const [org] = await this.userRepo.manager.query(
        `SELECT id FROM organizations WHERE UPPER(code) = UPPER($1) AND is_active = true LIMIT 1`,
        [dto.orgCode.trim()],
      );
      if (!org) throw new UnauthorizedException('รหัสองค์กรไม่ถูกต้อง');
      orgId = org.id;
    } else if (host) {
      // ไม่ส่งรหัสองค์กร → resolve จากโดเมน (เช่น sao-lamnangrong.com → ลำนางรอง) · ไม่เจอโดเมน = ปล่อยผ่าน (localhost/IP)
      const h = String(host).toLowerCase().split(':')[0].replace(/^www\./, '').trim();
      if (h) {
        const [org] = await this.userRepo.manager.query(
          `SELECT id FROM organizations WHERE is_active = true AND $1 = ANY(hostnames) LIMIT 1`, [h]);
        if (org) orgId = org.id;
      }
    }

    // passwordHash เป็น select:false ต้อง addSelect เองเฉพาะจุดตรวจรหัสผ่าน
    const qb = this.userRepo.createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('(u.username = :q OR u.email = :q)', { q: dto.username }); // ต้องมีวงเล็บ ไม่งั้น AND org ไม่คุม username (SQL precedence)
    if (orgId) qb.andWhere('u.organizationId = :orgId', { orgId });
    if (opts?.superAdminOnly) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id AND r.name = 'SUPER_ADMIN')`);
    }
    // username/email ซ้ำข้าม อบต. ได้แล้ว — ถ้าไม่ระบุรหัสองค์กรแล้วชนกันหลาย อบต. ต้องให้ระบุ (กันล็อกอินผิดที่)
    const matches = await qb.getMany();
    if (matches.length > 1) {
      throw new UnauthorizedException(opts?.superAdminOnly
        ? 'มีบัญชีผู้ดูแลระบบสูงสุดชื่อนี้มากกว่าหนึ่งบัญชี'
        : 'ชื่อผู้ใช้นี้มีในหลายหน่วยงาน กรุณาระบุรหัสองค์กร');
    }
    const user = matches[0];

    if (!user) {
      throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }

    if (!user.isActive) {
      throw new ForbiddenException('บัญชีนี้ถูกระงับการใช้งาน');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = dayjs(user.lockedUntil).diff(dayjs(), 'minute');
      throw new ForbiddenException(`บัญชีถูกระงับชั่วคราว กรุณารอ ${minutes} นาที`);
    }

    const isPasswordValid = await comparePassword(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }

    await this.userRepo.update(user.id, {
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: ip,
    });

    const { roles, permissions } = await this.getUserRolesAndPermissions(user.id);
    const tokens = await this.generateTokens(user, roles, ip, userAgent);

    await this.logAction(user.id, user.fullNameTh, 'LOGIN', 'auth', ip, userAgent, user.organizationId);

    return { user: { ...this.sanitizeUser(user), roles, permissions }, ...tokens };
  }

  async refreshTokens(refreshToken: string, ip: string, userAgent: string) {
    const tokenHash = sha256(refreshToken);
    const stored = await this.refreshTokenRepo.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh Token ไม่ถูกต้องหรือหมดอายุ');
    }

    if (!stored.user.isActive) {
      throw new ForbiddenException('บัญชีถูกระงับ');
    }

    await this.refreshTokenRepo.update(stored.id, { revokedAt: new Date() });
    const { roles } = await this.getUserRolesAndPermissions(stored.user.id);
    const tokens = await this.generateTokens(stored.user, roles, ip, userAgent);
    return tokens;
  }

  async logout(userId: string, refreshToken: string, ip: string, userAgent: string) {
    if (refreshToken) {
      const tokenHash = sha256(refreshToken);
      await this.refreshTokenRepo.update({ tokenHash }, { revokedAt: new Date() });
    }
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['organizationId', 'fullNameTh'] });
    await this.logAction(userId, user?.fullNameTh, 'LOGOUT', 'auth', ip, userAgent, user?.organizationId);
  }

  async logoutAll(userId: string) {
    await this.refreshTokenRepo.update({ userId, revokedAt: null }, { revokedAt: new Date() });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id: userId })
      .getOne();
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้');

    const isValid = await comparePassword(dto.currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('รหัสผ่านเดิมไม่ถูกต้อง');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    await this.userRepo.update(userId, { passwordHash, passwordChangedAt: new Date() });
    await this.logoutAll(userId);
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['department', 'division', 'organization'],
    });
    if (!user) throw new NotFoundException('ไม่พบผู้ใช้');
    const { roles, permissions } = await this.getUserRolesAndPermissions(userId);
    return { ...this.sanitizeUser(user), roles, permissions };
  }

  async updateMe(userId: string, dto: { fullNameTh?: string; fullNameEn?: string; titleTh?: string; phone?: string; avatarUrl?: string; signatureImage?: string | null }) {
    const allowed: Record<string, any> = {};
    if (dto.fullNameTh) allowed.fullNameTh = dto.fullNameTh;
    if (dto.fullNameEn !== undefined) allowed.fullNameEn = dto.fullNameEn;
    if (dto.titleTh !== undefined) allowed.titleTh = dto.titleTh; // อนุญาตค่าว่าง = ไม่ระบุคำนำหน้า
    if (dto.phone !== undefined) allowed.phone = dto.phone;
    if (dto.avatarUrl !== undefined) allowed.avatarUrl = dto.avatarUrl;
    // ลายเซ็นที่บันทึกไว้ (ใช้เลือกตอนเซ็นเอกสาร) — เก็บใน metadata.signatureImage
    if (dto.signatureImage !== undefined) {
      // controller รับ body แบบ inline (ไม่ผ่าน class-validator) จึงต้องกัน data URL เองที่นี่
      // — ลายเซ็นนี้ถูกนำไปเรนเดอร์ใน PDF จึงต้องเป็นรูปภาพ base64 เท่านั้น (กัน XSS/SSRF)
      if (dto.signatureImage && !/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(dto.signatureImage)) {
        throw new BadRequestException('รูปแบบลายเซ็นไม่ถูกต้อง');
      }
      const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'metadata'] });
      const metadata = { ...(user?.metadata || {}) };
      if (dto.signatureImage) metadata.signatureImage = dto.signatureImage;
      else delete metadata.signatureImage;
      allowed.metadata = metadata;
    }
    if (Object.keys(allowed).length) await this.userRepo.update(userId, allowed);
    return this.getMe(userId);
  }

  private async getUserRolesAndPermissions(userId: string): Promise<{ roles: string[]; permissions: string[] }> {
    const userRoles = await this.userRoleRepo.find({
      where: { userId },
      relations: ['role'],
    });
    const roles = userRoles.map((ur) => ur.role.name);
    const roleIds = userRoles.map((ur) => ur.roleId);

    // Load direct user permissions
    const directPerms = await this.userPermissionRepo.find({
      where: { userId },
      relations: ['permission'],
    });
    const directPermStrings = directPerms.map(
      (p) => `${p.permission.module}:${p.permission.action}:${p.permission.subject}`,
    );

    // SUPER_ADMIN gets all permissions
    if (roles.includes('SUPER_ADMIN')) {
      const allPerms = await this.rolePermissionRepo
        .createQueryBuilder('rp')
        .leftJoinAndSelect('rp.permission', 'permission')
        .getMany();
      const permissions = [...new Set(allPerms.map((rp) => `${rp.permission.module}:${rp.permission.action}:${rp.permission.subject}`))];
      return { roles, permissions };
    }

    // สิทธิ์ = สิทธิ์ของบทบาท ∪ สิทธิ์เพิ่มรายคน (override เพิ่มได้อย่างเดียว — ไม่บดบัง role)
    let rolePermStrings: string[] = [];
    if (roleIds.length > 0) {
      const rps = await this.rolePermissionRepo.find({
        where: roleIds.map((id) => ({ roleId: id })),
        relations: ['permission'],
      });
      rolePermStrings = rps.map((rp) => `${rp.permission.module}:${rp.permission.action}:${rp.permission.subject}`);
    }

    return { roles, permissions: [...new Set([...rolePermStrings, ...directPermStrings])] };
  }

  private async generateTokens(user: User, roles: string[], ip: string, userAgent: string) {
    const payload = { sub: user.id, username: user.username, orgId: user.organizationId, roles };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    });

    const rawRefreshToken = uuidv4();
    const tokenHash = sha256(rawRefreshToken);
    const expiresAt = dayjs().add(7, 'day').toDate();

    await this.refreshTokenRepo.save({
      userId: user.id,
      tokenHash,
      ipAddress: ip,
      deviceInfo: userAgent,
      expiresAt,
    });

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: 900 };
  }

  private async handleFailedLogin(user: User) {
    const failedCount = (user.failedLoginCount || 0) + 1;
    const update: Partial<User> = { failedLoginCount: failedCount };

    if (failedCount >= this.MAX_FAILED_ATTEMPTS) {
      update.lockedUntil = dayjs().add(this.LOCK_DURATION_MINUTES, 'minute').toDate();
    }

    await this.userRepo.update(user.id, update);
  }

  private sanitizeUser(user: User) {
    const { passwordHash, twoFaSecret, lineNotifyToken, ...safe } = user as any;
    return safe;
  }

  /** ประวัติการเข้าสู่ระบบของผู้ใช้ (จาก audit log action=LOGIN) — โปรไฟล์/ความปลอดภัย */
  async getLoginHistory(userId: string) {
    return this.auditRepo.find({
      where: { userId, action: 'LOGIN' },
      order: { actedAt: 'DESC' },
      take: 15,
      select: ['id', 'ipAddress', 'userAgent', 'actedAt'],
    });
  }

  /** กิจกรรมล่าสุดของผู้ใช้ (จาก audit log — ตัด LOGIN/LOGOUT) — โปรไฟล์ */
  async getMyActivity(userId: string) {
    return this.auditRepo.find({
      where: { userId, action: Not(In(['LOGIN', 'LOGOUT'])) },
      order: { actedAt: 'DESC' },
      take: 15,
      select: ['id', 'action', 'module', 'resourceType', 'resourceTitle', 'actedAt'],
    });
  }

  private async logAction(
    userId: string, userName: string, action: string, module: string,
    ip: string, userAgent: string, organizationId?: string,
  ) {
    await this.auditRepo.save({
      userId, userName, action, module, organizationId,
      ipAddress: ip, userAgent,
    });
  }
}
